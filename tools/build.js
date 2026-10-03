// Zero-dependency production build: copies only runtime files into dist/.
// Assets are tree-shaken: only files referenced as 'assets/<name>' in index.html or js/ ship.
// Run: node tools/build.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function walk(dir, out = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
    }
    return out;
}

const codeFiles = [path.join(root, 'index.html'), ...walk(path.join(root, 'js')).filter(f => f.endsWith('.js'))];
const referenced = new Set();
for (const f of codeFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/assets\/([\w.\-\/]+\.(?:glb|gltf|png|jpg|jpeg|webp|ktx2|hdr|mp3|ogg|wav|json))/g)) referenced.add(m[1]);
}

fs.rmSync(dist, { recursive: true, force: true });
let files = 0, bytes = 0;
function put(src, rel) {
    const dst = path.join(dist, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    files++; bytes += fs.statSync(src).size;
}

put(path.join(root, 'index.html'), 'index.html');
for (const f of walk(path.join(root, 'js'))) put(f, path.relative(root, f));
const missing = [];
for (const rel of referenced) {
    const src = path.join(root, 'assets', rel);
    if (fs.existsSync(src)) put(src, path.join('assets', rel)); else missing.push(rel);
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log(`dist/ built: ${files} files, ${(bytes / 1048576).toFixed(1)} MB (${referenced.size} assets referenced)`);
if (missing.length) { console.error('Missing assets:', missing.join(', ')); process.exit(1); }
