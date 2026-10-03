// Golden trajectory + solver accuracy tests — run: node tools/verify/test_trajectory.js
// Regenerate golden file after an intentional physics change: node tools/verify/test_trajectory.js --update
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../../js/strikePhysics.js');
const S = require('../../js/shotSolver.js');

const STEP = 1 / 120;
const GOLDEN = path.join(__dirname, 'golden_trajectories.json');
const opts = { fixedStep: STEP, gravity: 9.81, linearDamping: 0.008, radius: 0.11 };

// Canonical shot set: penalty + free kicks, straight/curl/chip/power
const SHOTS = [
    { name: 'penalty_center_low',   start: [0, 0.11, -9],     target: [0, 0.4, -20],     speed: 26, curl: 0 },
    { name: 'penalty_top_right',    start: [0, 0.11, -9],     target: [3.2, 2.1, -20],   speed: 30, curl: 0.6 },
    { name: 'penalty_bottom_left',  start: [0, 0.11, -9],     target: [-3.3, 0.3, -20],  speed: 28, curl: -0.4 },
    { name: 'fk_20m_curl_in',       start: [-4, 0.11, 0],     target: [2.9, 2.0, -20],   speed: 27, curl: 2.2 },
    { name: 'fk_25m_outswing',      start: [5, 0.11, -0.5],   target: [-3.0, 1.9, -20],  speed: 29, curl: -2.6 },
    { name: 'fk_22m_knuckle',       start: [0, 0.11, 2],      target: [0.8, 2.2, -20],   speed: 34, curl: 0 },
    { name: 'chip_slow',            start: [0, 0.11, -9],     target: [0, 2.3, -20],     speed: 24, curl: 0 },
];

function v(a) { return { x: a[0], y: a[1], z: a[2] }; }

/** Run the shot through a real game-configured World (ground + preStep Magnus), return crossing point. */
function simulateInWorld(start, sol, planeZ) {
    const w = new P.World();
    w.gravity.set(0, -9.81, 0);
    const ground = new P.Body({ mass: 0, shape: new P.Plane() });
    ground.quaternion.setFromAxisAngle(new P.Vec3(1, 0, 0), -Math.PI / 2);
    w.addBody(ground);
    const ball = new P.Body({ mass: 0.38, shape: new P.Sphere(0.11), linearDamping: 0.008 });
    ball.preStep = function (h) { if (this.position.z > planeZ) this.velocity.x += sol.ax * h; };
    ball.position.set(start.x, start.y, start.z);
    ball.velocity.set(sol.vx, sol.vy, sol.vz);
    w.addBody(ball);
    // Uneven frame times exercise the accumulator; result must be identical to predict()
    const frames = [1 / 60, 1 / 75, 1 / 144, 1 / 30, 1 / 90];
    let px = ball.position.x, py = ball.position.y, pz = ball.position.z;
    const origStep = w.internalStep.bind(w);
    let hit = null;
    w.internalStep = function (h) {
        px = ball.position.x; py = ball.position.y; pz = ball.position.z;
        origStep(h);
        if (!hit && ball.position.z <= planeZ) {
            const f = (pz - planeZ) / (pz - ball.position.z);
            hit = { x: px + (ball.position.x - px) * f, y: py + (ball.position.y - py) * f };
        }
    };
    for (let i = 0; i < 2000 && !hit; i++) w.step(STEP, frames[i % frames.length], 8);
    return hit;
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const results = {};

for (const s of SHOTS) {
    test(`solver hits target: ${s.name}`, () => {
        const sol = S.solve(v(s.start), v(s.target), s.speed, s.curl, opts);
        assert.ok(sol.errorM < 0.001, `solve error ${sol.errorM.toFixed(4)} m`);
        const r = S.predict(v(s.start), { x: sol.vx, y: sol.vy, z: sol.vz }, sol.ax, s.target[2], opts);
        assert.ok(Math.hypot(r.x - s.target[0], r.y - s.target[1]) < 0.001);
        results[s.name] = { vx: +sol.vx.toFixed(6), vy: +sol.vy.toFixed(6), vz: +sol.vz.toFixed(6), ax: +sol.ax.toFixed(6), t: +r.t.toFixed(6) };
    });
    test(`prediction == in-game world sim (variable frame rate): ${s.name}`, () => {
        const sol = S.solve(v(s.start), v(s.target), s.speed, s.curl, opts);
        const hit = simulateInWorld(v(s.start), sol, s.target[2]);
        assert.ok(hit, 'never crossed goal plane');
        const d = Math.hypot(hit.x - s.target[0], hit.y - s.target[1]);
        assert.ok(d < 0.001, `world sim landed ${(d * 1000).toFixed(2)} mm off target`);
    });
}

test('curl actually bends: mid-flight lateral deviation matches requested curl', () => {
    const s = SHOTS[3];
    const sol = S.solve(v(s.start), v(s.target), s.speed, s.curl, opts);
    // Deviation from straight launch line at the plane = 0.5*ax*T^2 = curl
    const r = S.predict(v(s.start), { x: sol.vx, y: sol.vy, z: sol.vz }, sol.ax, s.target[2], opts);
    const straightX = s.start[0] + sol.vx * r.t;
    assert.ok(Math.abs((r.x - straightX) - s.curl) < 0.05, `bend ${(r.x - straightX).toFixed(3)} vs ${s.curl}`);
});

const update = process.argv.includes('--update');
if (update || !fs.existsSync(GOLDEN)) {
    fs.writeFileSync(GOLDEN, JSON.stringify(results, null, 2) + '\n');
    console.log(`golden file ${update ? 'updated' : 'created'}: ${path.basename(GOLDEN)}`);
} else {
    test('golden launch vectors unchanged (±1e-5)', () => {
        const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
        for (const k of Object.keys(results)) {
            assert.ok(g[k], `missing golden ${k}`);
            for (const f of ['vx', 'vy', 'vz', 'ax', 't']) {
                assert.ok(Math.abs(g[k][f] - results[k][f]) < 1e-5, `${k}.${f}: ${results[k][f]} != golden ${g[k][f]}`);
            }
        }
    });
}
console.log(`\n${passed} trajectory tests passed`);
