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

console.log('uniqueVertices:', uniqueVertices.length);
console.log('pentagonCenters:', pentagonCenters.length);
console.log('hexagonCenters:', hexagonCenters.length);

const pentagonFaces = Array(12).fill().map(() => []);
uniqueVertices.forEach(v => {
    let maxDot = -Infinity, bestIdx = -1;
    pentagonCenters.forEach((c, i) => { let d = v.clone().normalize().dot(c); if (d > maxDot) { maxDot = d; bestIdx = i; } });
    if(bestIdx === -1) console.log('bestIdx -1 for pentagon');
    else if (!pentagonFaces[bestIdx]) console.log('pentagonFaces[bestIdx] undefined', bestIdx, pentagonFaces.length);
    else pentagonFaces[bestIdx].push(v);
});
const hexagonFaces = Array(20).fill().map(() => []);
uniqueVertices.forEach(v => {
    let maxDot = -Infinity, bestIdx = -1;
    hexagonCenters.forEach((c, i) => { let d = v.clone().normalize().dot(c); if (d > maxDot) { maxDot = d; bestIdx = i; } });
    if(bestIdx === -1) console.log('bestIdx -1 for hexagon');
    else if (!hexagonFaces[bestIdx]) console.log('hexagonFaces[bestIdx] undefined', bestIdx, hexagonFaces.length);
    else hexagonFaces[bestIdx].push(v);
});

