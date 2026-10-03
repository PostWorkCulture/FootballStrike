const THREE = require('../../js/three.min.js');

const ballRadius = 0.22;
const phi = (1 + Math.sqrt(5)) / 2;
function generatePoints(seed) {
    const pts = [];
    const signs = [ [1, 1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, -1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1] ];
    for (let s of signs) {
        let x = seed[0] * s[0], y = seed[1] * s[1], z = seed[2] * s[2];
        pts.push(new THREE.Vector3(x, y, z)); pts.push(new THREE.Vector3(y, z, x)); pts.push(new THREE.Vector3(z, x, y));
    }
    return pts;
}

let rawVertices = [];
rawVertices.push(...generatePoints([0, 1, 3 * phi]));
rawVertices.push(...generatePoints([1, 2 + phi, 2 * phi]));
rawVertices.push(...generatePoints([phi, 2, 2 * phi + 1]));
const uniqueVertices = [];
rawVertices.forEach(p => {
    if (!uniqueVertices.some(u => u.distanceTo(p) < 0.001)) { p.normalize().multiplyScalar(ballRadius); uniqueVertices.push(p); }
});

let rawPCenters = generatePoints([0, 1, phi]);
const pentagonCenters = [];
rawPCenters.forEach(p => { if (!pentagonCenters.some(u => u.distanceTo(p) < 0.001)) pentagonCenters.push(p.normalize()); });
let rawHCenters = [];
rawHCenters.push(...generatePoints([1, 1, 1])); rawHCenters.push(...generatePoints([0, 1 / phi, phi]));
const hexagonCenters = [];
rawHCenters.forEach(p => { if (!hexagonCenters.some(u => u.distanceTo(p) < 0.001)) hexagonCenters.push(p.normalize()); });

const pentagonFaces = Array(pentagonCenters.length).fill().map(() => []);
uniqueVertices.forEach(v => {
    let maxDot = -Infinity, bestIdx = -1;
    pentagonCenters.forEach((c, i) => { let d = v.clone().normalize().dot(c); if (d > maxDot) { maxDot = d; bestIdx = i; } });
    pentagonFaces[bestIdx].push(v);
});
const hexagonFaces = Array(hexagonCenters.length).fill().map(() => []);
uniqueVertices.forEach(v => {
    let maxDot = -Infinity, bestIdx = -1;
    hexagonCenters.forEach((c, i) => { let d = v.clone().normalize().dot(c); if (d > maxDot) { maxDot = d; bestIdx = i; } });
    hexagonFaces[bestIdx].push(v);
});

const positions = [], normals = [], colors = [];
const black = new THREE.Color(0x111111), white = new THREE.Color(0xeeeeee);
function getFaceCenter(vertices) { const c = new THREE.Vector3(); vertices.forEach(v => c.add(v)); return c.divideScalar(vertices.length); }
function addFaceTriangles(faceVertices, color) {
    if(faceVertices.length < 3) return;
    const center = getFaceCenter(faceVertices);
    const normal = center.clone().normalize();
    const u = new THREE.Vector3();
    if (Math.abs(normal.x) > 0.5) u.set(0, 1, 0).cross(normal).normalize(); else u.set(1, 0, 0).cross(normal).normalize();
    const vAxis = normal.clone().cross(u).normalize();
    faceVertices.sort((a, b) => {
        const da = a.clone().sub(center), db = b.clone().sub(center);
        return Math.atan2(da.dot(vAxis), da.dot(u)) - Math.atan2(db.dot(vAxis), db.dot(u));
    });
    const v0 = faceVertices[0], v1 = faceVertices[1], v2 = faceVertices[2];
    const cb = new THREE.Vector3().subVectors(v2, v1), ab = new THREE.Vector3().subVectors(v0, v1);
    if (new THREE.Vector3().crossVectors(cb, ab).normalize().dot(normal) < 0) faceVertices.reverse();
    for (let i = 1; i < faceVertices.length - 1; i++) {
        const pts = [faceVertices[0], faceVertices[i], faceVertices[i + 1]];
        const faceNormal = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(pts[2], pts[1]), new THREE.Vector3().subVectors(pts[0], pts[1])).normalize();
        pts.forEach(p => { positions.push(p.x, p.y, p.z); normals.push(faceNormal.x, faceNormal.y, faceNormal.z); colors.push(color.r, color.g, color.b); });
    }
}
pentagonFaces.forEach(face => addFaceTriangles(face, black));
hexagonFaces.forEach(face => addFaceTriangles(face, white));
console.log('SUCCESS', positions.length);
