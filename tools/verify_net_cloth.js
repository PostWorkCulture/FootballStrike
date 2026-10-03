// tools/verify_net_cloth.js
// Verification script testing js/netClothPhysics.js

const NetClothPhysics = require('../js/netClothPhysics.js');

console.log('=== VERIFYING NET CLOTH PHYSICS MODULE ===\n');

// 1. Initialize Module
const net = new NetClothPhysics({
    goalWidth: 7.32,
    postHeight: 2.44,
    goalDepth: 2.0,
    ballRadius: 0.22,
    goalZ: -20.0
});

console.log(`[1] Mesh Grid & Topology:`);
console.log(`    Total Cloth Nodes: ${net.totalNodes}`);
console.log(`    Total Springs: ${net.springCount}`);
console.log(`    Total Seam Stitches: ${net.seamCount}`);

let testsPassed = 0;
let testsTotal = 0;

function assert(condition, testName, details = '') {
    testsTotal++;
    if (condition) {
        testsPassed++;
        console.log(`PASS: ${testName} ${details}`);
    } else {
        console.error(`FAIL: ${testName} ${details}`);
    }
}

// Check Anchors (Pinned Nodes)
let pinnedCount = 0;
for (let i = 0; i < net.totalNodes; i++) {
    if (net.pinned[i]) pinnedCount++;
}
console.log(`    Pinned Boundary Nodes: ${pinnedCount}`);
assert(pinnedCount > 100 && pinnedCount < 300, 'Boundary Anchor Points Pinned', `(${pinnedCount} pinned)`);

// 2. Idle Wind Flutter Test
console.log('\n[2] Idle Wind Flutter:');
let maxWindDisp = 0;
for (let step = 0; step < 120; step++) {
    net.update(1/60, null, null);
    for (let i = 0; i < net.totalNodes; i++) {
        const d = Math.abs(net.pos[i*3 + 2] - net.restPos[i*3 + 2]);
        if (d > maxWindDisp) maxWindDisp = d;
    }
}
const windCm = maxWindDisp * 100;
console.log(`    Max Idle Wind Displacement: ${windCm.toFixed(2)} cm (Expected 1.0 - 3.0 cm)`);
assert(windCm >= 1.0 && windCm <= 3.2, 'Natural Subtle Wind Flutter', `(${windCm.toFixed(2)} cm)`);

// 3. Dynamic Localized Ball Impact Deformation (Pouching)
console.log('\n[3] Dynamic Localized Ball Impact & Pouching:');
net.reset();

const mockBall = {
    position: { x: 0.8, y: 1.6, z: -21.60 },
    velocity: {
        x: 0,
        y: -1.2,
        z: -26.0, // 94 km/h strike
        set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    },
    angularVelocity: {
        x: 0, y: 0, z: 0,
        scale(s, out) { out.x *= s; out.y *= s; out.z *= s; },
        set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    },
    inNet: false
};

let peakPouchDepth = 0;
let shockwavesTriggered = 0;

for (let step = 0; step < 60; step++) {
    mockBall.position.x += mockBall.velocity.x * (1/60);
    mockBall.position.y += mockBall.velocity.y * (1/60);
    mockBall.position.z += mockBall.velocity.z * (1/60);

    const res = net.update(1/60, mockBall, null);
    if (res.shockwavesActive > shockwavesTriggered) {
        shockwavesTriggered = res.shockwavesActive;
    }

    for (let i = 0; i < net.panels.back.nodeCount; i++) {
        const gi3 = (net.panels.back.globalOffset + i) * 3;
        const bulge = Math.abs(net.pos[gi3 + 2] - net.restPos[gi3 + 2]);
        if (bulge > peakPouchDepth) peakPouchDepth = bulge;
    }
}

const pouchCm = peakPouchDepth * 100;
console.log(`    Peak Pouch Deformation: ${pouchCm.toFixed(2)} cm (Expected 30 - 75 cm)`);
console.log(`    Shockwaves Generated: ${shockwavesTriggered}`);
assert(pouchCm >= 30.0 && pouchCm <= 75.0, 'Dynamic Pocketing Pouch Bulge', `(${pouchCm.toFixed(2)} cm)`);
assert(shockwavesTriggered >= 1, 'Shockwave Generated on Impact', `(${shockwavesTriggered} triggered)`);

// 4. Deterministic Ball Entrapment & Smooth Slide to Turf
console.log('\n[4] Deterministic Ball Entrapment & Turf Rest:');
for (let step = 0; step < 180; step++) {
    mockBall.position.x += mockBall.velocity.x * (1/60);
    mockBall.position.y += mockBall.velocity.y * (1/60);
    mockBall.position.z += mockBall.velocity.z * (1/60);
    net.update(1/60, mockBall, null);
}

const finalSpeed = Math.hypot(mockBall.velocity.x, mockBall.velocity.y, mockBall.velocity.z);
console.log(`    Final Ball Pos: X=${mockBall.position.x.toFixed(3)}, Y=${mockBall.position.y.toFixed(3)}, Z=${mockBall.position.z.toFixed(3)}`);
console.log(`    Final Ball Speed: ${finalSpeed.toFixed(4)} m/s`);

const clipped = mockBall.position.z < -22.46 || mockBall.position.z > -20.24;
const restingTurf = Math.abs(mockBall.position.y - 0.22) <= 0.02;
const zeroRebound = mockBall.velocity.z <= 0.001;
const fullyStopped = finalSpeed < 0.01;

assert(!clipped, 'Zero Clipping through Netting', `(Z = ${mockBall.position.z.toFixed(2)})`);
assert(zeroRebound, 'Zero Rebound towards Pitch', `(Vz = ${mockBall.velocity.z.toFixed(2)})`);
assert(restingTurf, 'Smooth Slide to Rest on Turf', `(Y = ${mockBall.position.y.toFixed(3)}, turf = 0.220)`);
assert(fullyStopped, 'Velocity Fully Arrested inside Pocket', `(Speed = ${finalSpeed.toFixed(4)} m/s)`);

// 5. Performance Benchmark (<2ms CPU budget per frame)
console.log('\n[5] Performance Benchmark over 1,000 Simulation Steps:');
net.reset();
net.stats.totalFrames = 0;
net.stats.totalTimeMs = 0;
net.stats.maxTimeMs = 0;

const tBenchStart = performance.now();
for (let f = 0; f < 1000; f++) {
    net.update(1/60, mockBall, null);
}
const benchTotal = performance.now() - tBenchStart;
const avgFrameTime = benchTotal / 1000;
const maxStep = net.stats.maxTimeMs;

console.log(`    1,000 Frames Total Duration: ${benchTotal.toFixed(2)} ms`);
console.log(`    Average Step Time: ${avgFrameTime.toFixed(3)} ms`);
console.log(`    Max Step Time: ${maxStep.toFixed(3)} ms`);

assert(avgFrameTime < 2.0, 'Performance Budget < 2.0 ms/frame', `(${avgFrameTime.toFixed(3)} ms/step)`);
assert(avgFrameTime < 1.0, 'Ultra-High Performance Margin < 1.0 ms/frame', `(${avgFrameTime.toFixed(3)} ms/step)`);

console.log(`\n========================================`);
console.log(`RESULTS: ${testsPassed} / ${testsTotal} CHECKS PASSED`);
console.log(`========================================`);

if (testsPassed === testsTotal) {
    process.exit(0);
} else {
    process.exit(1);
}
