/**
 * ShotSolver — deterministic inverse trajectory solver.
 *
 * Given a start position, a target point on the goal plane, a forward speed and a
 * desired curl (lateral Magnus bend in metres), returns the launch velocity and the
 * constant lateral Magnus acceleration so the ball crosses the goal plane exactly at
 * the target. Uses a shooting method over the *same* StrikePhysics integrator the
 * game runs, so prediction == simulation (bit-for-bit at equal step size).
 *
 * Also exposes predict() for replays, AI goalkeeper reads and golden tests.
 */
(function (root) {
    'use strict';
    const P = root.StrikePhysics || (typeof require !== 'undefined' ? require('./strikePhysics.js') : null);

    const DEFAULTS = { gravity: 9.81, linearDamping: 0.008, fixedStep: 1 / 120, radius: 0.11, maxTime: 4 };

    // Private sandbox world reused across solves (no per-frame allocation).
    let sandbox = null, sbBall = null, sbAx = 0, sbPlaneZ = -20;
    function getSandbox(cfg) {
        if (!sandbox) {
            sandbox = new P.World();
            sbBall = new P.Body({ mass: 0.43, shape: new P.Sphere(cfg.radius) });
            sbBall.preStep = function (h) { if (this.position.z > sbPlaneZ) this.velocity.x += sbAx * h; };
            sandbox.addBody(sbBall);
        }
        sandbox.gravity.set(0, -cfg.gravity, 0);
        sbBall.linearDamping = cfg.linearDamping;
        return sbBall;
    }

    const out = { x: 0, y: 0, z: 0, t: 0, crossed: false };

    /**
     * Simulate until the ball crosses planeZ (moving -Z). Writes result into `out`.
     * Linear interpolation inside the crossing substep gives sub-step accuracy.
     */
    function predict(start, vel, ax, planeZ, opts) {
        const cfg = Object.assign({}, DEFAULTS, opts);
        const b = getSandbox(cfg);
        sbAx = ax; sbPlaneZ = planeZ;
        b.position.set(start.x, start.y, start.z);
        b.velocity.set(vel.x, vel.y, vel.z);
        b.angularVelocity.set(0, 0, 0);
        const h = cfg.fixedStep, maxN = Math.ceil(cfg.maxTime / h);
        let px = start.x, py = start.y, pz = start.z;
        for (let i = 1; i <= maxN; i++) {
            sandbox.internalStep(h);
            if (b.position.z <= planeZ) {
                const f = (pz - planeZ) / (pz - b.position.z || 1);
                out.x = px + (b.position.x - px) * f;
                out.y = py + (b.position.y - py) * f;
                out.z = planeZ;
                out.t = (i - 1 + f) * h;
                out.crossed = true;
                return out;
            }
            px = b.position.x; py = b.position.y; pz = b.position.z;
        }
        out.x = b.position.x; out.y = b.position.y; out.z = b.position.z; out.t = cfg.maxTime; out.crossed = false;
        return out;
    }

    /**
     * Solve launch velocity.
     * @param start  {x,y,z} ball position
     * @param target {x,y,z} point on goal plane (z = plane)
     * @param speed  forward speed m/s (positive)
     * @param curl   lateral bend in metres (+ = bends toward +X)
     * @returns {vx,vy,vz,ax,flightTime,errorM}
     */
    function solve(start, target, speed, curl, opts) {
        const cfg = Object.assign({}, DEFAULTS, opts);
        const planeZ = target.z;
        const dz = Math.abs(planeZ - start.z);
        const vz = -Math.abs(speed);
        let T = dz / Math.abs(vz);
        // Constant lateral accel producing `curl` metres of deviation from the launch line over T.
        const ax = T > 0.05 ? (2 * curl) / (T * T) : 0;
        // Analytic initial guess
        let vx = (target.x - start.x) / T - 0.5 * ax * T;
        let vy = (target.y - start.y) / T + 0.5 * cfg.gravity * T;
        const vel = { x: vx, y: vy, z: vz };
        let err = Infinity;
        for (let iter = 0; iter < 6; iter++) {
            vel.x = vx; vel.y = vy;
            const r = predict(start, vel, ax, planeZ, cfg);
            if (!r.crossed) { vy += 1; continue; }
            const ex = target.x - r.x, ey = target.y - r.y;
            err = Math.hypot(ex, ey);
            if (err < 1e-4) break;
            vx += ex / r.t;
            vy += ey / r.t;
            T = r.t;
        }
        return { vx, vy, vz, ax, flightTime: T, errorM: err };
    }

    const ShotSolver = { solve, predict, DEFAULTS };
    root.ShotSolver = ShotSolver;
    if (typeof module !== 'undefined' && module.exports) module.exports = ShotSolver;
})(typeof window !== 'undefined' ? window : globalThis);
