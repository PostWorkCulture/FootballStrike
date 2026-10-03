// Character asset pipeline: Blender build -> glTF-Transform optimise -> assets/<role>.glb
// Run: node tools/build_characters.js [player|goalkeeper ...]
// Requires: Blender 4.2 with MPFB2 (+ system assets) and CMU BVH files in assets/source/mocap.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const blender = process.env.BLENDER ||
    path.join(process.env.LOCALAPPDATA || '', 'BlenderPortable', 'blender-4.2.3-windows-x64', 'blender.exe');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const roles = process.argv.slice(2).length ? process.argv.slice(2) : ['player', 'goalkeeper'];
const BUDGET_MB = 1.5;

function gt(...args) {
    execFileSync(npx, ['-y', '@gltf-transform/cli', ...args], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], shell: true });
}

let failed = false;
for (const role of roles) {
    const raw = path.join('assets', 'source', `${role}_raw.glb`);
    const tmp = path.join('assets', 'source', `${role}_tmp.glb`);
    const out = path.join('assets', `${role}.glb`);
    console.log(`[${role}] Blender build...`);
    execFileSync(blender, ['-b', '--python', 'tools/blender/build_characters.py', '--', role, raw,
        '--preview', path.join(root, 'tools', 'verify', 'out', `m2_${role}.png`)],
        { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

    console.log(`[${role}] optimise...`);
    gt('copy', raw, tmp);
    gt('resize', tmp, tmp, '--width', '256', '--height', '256', '--pattern', '"*(eye|brown|blue|green|lash|brow)*"');
    gt('resize', tmp, tmp, '--width', '512', '--height', '512', '--pattern', '"*(short|hair|afro|bob)*"');
    gt('resize', tmp, tmp, '--width', '1024', '--height', '1024');
    gt('webp', tmp, tmp, '--quality', '92');
    gt('dedup', tmp, tmp);
    gt('prune', tmp, tmp);
    gt('resample', tmp, tmp);          // drop redundant animation keys
    gt('quantize', tmp, out);
    fs.unlinkSync(path.join(root, tmp));
    const mb = fs.statSync(path.join(root, out)).size / 1048576;
    const ok = mb <= BUDGET_MB;
    if (!ok) failed = true;
    console.log(`[${role}] ${out}: ${mb.toFixed(2)} MB ${ok ? 'OK' : `OVER BUDGET (${BUDGET_MB} MB)`}`);
}
process.exit(failed ? 1 : 0);
