// Headless unit tests for js/strikePhysics.js — run: node tools/verify/test_physics.js
const assert = require('assert');
const P = require('../../js/strikePhysics.js');

function makeWorld() {
    const w = new P.World();
    w.gravity.set(0, -9.81, 0);
    const ballM = new P.Material('ball'), pitchM = new P.Material('pitch'), postM = new P.Material('post');
    w.addContactMaterial(new P.ContactMaterial(ballM, pitchM, { friction: 0.75, restitution: 0.45 }));
    w.addContactMaterial(new P.ContactMaterial(ballM, postM, { friction: 0.2, restitution: 0.75 }));
    const ground = new P.Body({ mass: 0, shape: new P.Plane(), material: pitchM });
    ground.quaternion.setFromAxisAngle(new P.Vec3(1, 0, 0), -Math.PI / 2);
    w.addBody(ground);
    const ball = new P.Body({ mass: 0.38, shape: new P.Sphere(0.11), material: ballM, linearDamping: 0.008, angularDamping: 0.04 });
    w.addBody(ball);
    return { w, ball, postM };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

test('determinism: identical inputs -> identical trajectory', () => {
    const run = () => {
        const { w, ball } = makeWorld();
        ball.position.set(0, 0.11, 0); ball.velocity.set(3.1, 6.2, -24.7);
        for (let i = 0; i < 240; i++) w.step(1 / 60, 1 / 60, 3);
        return [ball.position.x, ball.position.y, ball.position.z].join(',');
    };
    assert.strictEqual(run(), run());
});

test('ball rests on ground (no sinking)', () => {
    const { w, ball } = makeWorld();
    ball.position.set(0, 2, 0);
    for (let i = 0; i < 600; i++) w.step(1 / 60, 1 / 60, 3);
    assert.ok(Math.abs(ball.position.y - 0.11) < 0.01, 'y=' + ball.position.y);
    assert.ok(Math.abs(ball.velocity.y) < 0.2);
});

test('bounce restitution ~0.45', () => {
    const { w, ball } = makeWorld();
    ball.position.set(0, 0.5, 0); ball.velocity.set(0, -10, 0);
    let maxUp = 0;
    for (let i = 0; i < 30; i++) { w.step(1 / 120, 1 / 120, 1); maxUp = Math.max(maxUp, ball.velocity.y); }
    assert.ok(maxUp > 3.5 && maxUp < 5.5, 'rebound=' + maxUp);
});

test('vertical post deflects ball and fires collide', () => {
    const { w, ball, postM } = makeWorld();
    const post = new P.Body({ mass: 0, material: postM });
    post.addShape(new P.Cylinder(0.06, 0.06, 2.44, 16));
    post.position.set(3.66, 1.22, -20);
    let hits = 0; post.addEventListener('collide', () => hits++);
    w.addBody(post);
    ball.position.set(3.66, 1.0, -18); ball.velocity.set(0, 0, -20);
    w.gravity.set(0, 0, 0);
    for (let i = 0; i < 60; i++) w.step(1 / 120, 1 / 120, 1);
    assert.ok(hits > 0, 'no collide event');
    assert.ok(ball.velocity.z > 0, 'ball not deflected: vz=' + ball.velocity.z);
});

test('crossbar (rotZ 90deg) spans X axis', () => {
    const { w, ball, postM } = makeWorld();
    const bar = new P.Body({ mass: 0, material: postM });
    bar.addShape(new P.Cylinder(0.06, 0.06, 7.32, 16));
    bar.position.set(0, 2.44, -20);
    bar.quaternion.setFromAxisAngle(new P.Vec3(0, 0, 1), Math.PI / 2);
    let hits = 0; bar.addEventListener('collide', () => hits++);
    w.addBody(bar); w.gravity.set(0, 0, 0);
    ball.position.set(2.5, 2.44, -18); ball.velocity.set(0, 0, -20);
    for (let i = 0; i < 60; i++) w.step(1 / 120, 1 / 120, 1);
    assert.ok(hits > 0, 'crossbar miss');
});

test('collisionResponse=0 fires event but no deflection', () => {
    const { w, ball } = makeWorld();
    const box = new P.Body({ mass: 0, type: P.Body.KINEMATIC, shape: new P.Box(new P.Vec3(0.75, 1.15, 0.45)), position: new P.Vec3(0, 1.15, -19.6) });
    box.collisionResponse = 0;
    let hits = 0; box.addEventListener('collide', () => hits++);
    w.addBody(box); w.gravity.set(0, 0, 0);
    ball.position.set(0, 1, -17); ball.velocity.set(0, 0, -20);
    for (let i = 0; i < 30; i++) w.step(1 / 120, 1 / 120, 1);
    assert.ok(hits > 0); assert.ok(ball.velocity.z < -19);
});

test('wall box blocks ball', () => {
    const { w, ball, postM } = makeWorld();
    const box = new P.Body({ mass: 0, shape: new P.Box(new P.Vec3(0.38, 0.95, 0.24)), position: new P.Vec3(0, 0.95, -13.5), material: postM });
    w.addBody(box); w.gravity.set(0, 0, 0);
    ball.position.set(0, 1, -11); ball.velocity.set(0, 0, -20);
    for (let i = 0; i < 60; i++) w.step(1 / 120, 1 / 120, 1);
    assert.ok(ball.position.z > -13.5, 'tunnelled: z=' + ball.position.z);
});

console.log(`\n${passed} physics tests passed`);
