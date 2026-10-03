/**
 * StrikePhysics — deterministic, allocation-free rigid-body core for Football Strike.
 *
 * Replaces cannon.js (132 KB). Only simulates what the game needs:
 *   - One or more dynamic spheres (the ball)
 *   - Static / kinematic colliders: Plane, Box, Cylinder (local Y axis)
 *   - Fixed-step integration with accumulator (identical inputs -> identical output)
 *   - 'collide' events on both bodies every substep while in contact
 *   - Restitution / Coulomb friction via ContactMaterial pairs
 *
 * Exposes a cannon-compatible API surface (Vec3, Quaternion, Body, World, shapes)
 * so existing gameplay code keeps working. Published as window.StrikePhysics and
 * aliased to window.CANNON.
 */
(function (root) {
    'use strict';

    // ------------------------------------------------------------------ Vec3
    class Vec3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        clone() { return new Vec3(this.x, this.y, this.z); }
        vadd(v, t = new Vec3()) { return t.set(this.x + v.x, this.y + v.y, this.z + v.z); }
        vsub(v, t = new Vec3()) { return t.set(this.x - v.x, this.y - v.y, this.z - v.z); }
        scale(s, t = new Vec3()) { return t.set(this.x * s, this.y * s, this.z * s); }
        mult(s, t) { return this.scale(s, t); }
        dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
        cross(v, t = new Vec3()) {
            const x = this.y * v.z - this.z * v.y, y = this.z * v.x - this.x * v.z, z = this.x * v.y - this.y * v.x;
            return t.set(x, y, z);
        }
        length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
        norm() { return this.length(); }
        lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
        normalize() { const l = this.length(); if (l > 0) { this.x /= l; this.y /= l; this.z /= l; } return l; }
        distanceTo(v) { const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
    }

    // ------------------------------------------------------------ Quaternion
    class Quaternion {
        constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
        set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
        copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
        setFromAxisAngle(axis, angle) {
            const s = Math.sin(angle * 0.5);
            this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(angle * 0.5);
            return this;
        }
        normalize() {
            let l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
            if (l === 0) { this.x = this.y = this.z = 0; this.w = 1; } else { l = 1 / l; this.x *= l; this.y *= l; this.z *= l; this.w *= l; }
            return this;
        }
        /** Rotate vector v by this quaternion. */
        vmult(v, t = new Vec3()) {
            const x = v.x, y = v.y, z = v.z, qx = this.x, qy = this.y, qz = this.z, qw = this.w;
            const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z;
            const iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
            return t.set(
                ix * qw + iw * -qx + iy * -qz - iz * -qy,
                iy * qw + iw * -qy + iz * -qx - ix * -qz,
                iz * qw + iw * -qz + ix * -qy - iy * -qx
            );
        }
        /** Rotate vector v by the inverse of this quaternion. */
        vmultInverse(v, t = new Vec3()) {
            const sx = this.x, sy = this.y, sz = this.z;
            this.x = -sx; this.y = -sy; this.z = -sz;
            this.vmult(v, t);
            this.x = sx; this.y = sy; this.z = sz;
            return t;
        }
        /** Integrate angular velocity w over dt (in place). */
        integrateInPlace(w, dt) {
            const hx = w.x * dt * 0.5, hy = w.y * dt * 0.5, hz = w.z * dt * 0.5;
            const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
            this.x += hx * qw + hy * qz - hz * qy;
            this.y += hy * qw + hz * qx - hx * qz;
            this.z += hz * qw + hx * qy - hy * qx;
            this.w += -hx * qx - hy * qy - hz * qz;
            return this.normalize();
        }
    }

    // ---------------------------------------------------------------- Shapes
    const SHAPE = { SPHERE: 1, PLANE: 2, BOX: 4, CYLINDER: 8 };
    class Sphere { constructor(r) { this.type = SHAPE.SPHERE; this.radius = r; } }
    /** Plane with local normal +Z (cannon convention). */
    class Plane { constructor() { this.type = SHAPE.PLANE; } }
    class Box { constructor(halfExtents) { this.type = SHAPE.BOX; this.halfExtents = new Vec3().copy(halfExtents); } }
    /** Solid cylinder aligned to local Y axis. */
    class Cylinder {
        constructor(radiusTop, radiusBottom, height) {
            this.type = SHAPE.CYLINDER;
            this.radius = Math.max(radiusTop, radiusBottom);
            this.halfHeight = height * 0.5;
        }
    }

    // ------------------------------------------------------------- Materials
    let materialId = 0;
    class Material { constructor(name) { this.name = name || ''; this.id = materialId++; } }
    class ContactMaterial {
        constructor(m1, m2, opts = {}) {
            this.materials = [m1, m2];
            this.friction = opts.friction !== undefined ? opts.friction : 0.3;
            this.restitution = opts.restitution !== undefined ? opts.restitution : 0.3;
        }
    }
    class NaiveBroadphase { }

    // ------------------------------------------------------------------ Body
    let bodyId = 0;
    class Body {
        constructor(opts = {}) {
            this.id = bodyId++;
            this.mass = opts.mass || 0;
            this.type = opts.type || (this.mass > 0 ? Body.DYNAMIC : Body.STATIC);
            this.position = new Vec3(); if (opts.position) this.position.copy(opts.position);
            this.velocity = new Vec3(); if (opts.velocity) this.velocity.copy(opts.velocity);
            this.angularVelocity = new Vec3();
            this.quaternion = new Quaternion(); if (opts.quaternion) this.quaternion.copy(opts.quaternion);
            this.linearDamping = opts.linearDamping !== undefined ? opts.linearDamping : 0.01;
            this.angularDamping = opts.angularDamping !== undefined ? opts.angularDamping : 0.01;
            this.material = opts.material || null;
            this.collisionResponse = true;
            this.shapes = [];
            this._listeners = null;
            if (opts.shape) this.addShape(opts.shape);
        }
        addShape(shape) { this.shapes.push(shape); return this; }
        addEventListener(type, fn) {
            if (!this._listeners) this._listeners = {};
            (this._listeners[type] || (this._listeners[type] = [])).push(fn);
            return this;
        }
        removeEventListener(type, fn) {
            const l = this._listeners && this._listeners[type];
            if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
            return this;
        }
        dispatchEvent(evt) {
            const l = this._listeners && this._listeners[evt.type];
            if (!l) return;
            for (let i = 0; i < l.length; i++) l[i].call(this, evt);
        }
    }
    Body.DYNAMIC = 1; Body.STATIC = 2; Body.KINEMATIC = 4;

    // ----------------------------------------------- Narrowphase scratch data
    const _local = new Vec3(), _closest = new Vec3(), _normal = new Vec3(), _tmp = new Vec3();
    const _vt = new Vec3(), _axis = new Vec3(0, 0, 1);
    const _contact = { normal: new Vec3(), depth: 0 };
    const _evtA = { type: 'collide', body: null, target: null, contact: _contact };
    const _evtB = { type: 'collide', body: null, target: null, contact: _contact };

    /** Sphere (center c, radius r) vs static shape on body b. Writes _contact. Returns true on penetration. */
    function sphereVsShape(c, r, b, shape) {
        const q = b.quaternion;
        if (shape.type === SHAPE.PLANE) {
            q.vmult(_axis, _normal);
            const d = c.vsub(b.position, _tmp).dot(_normal) - r;
            if (d >= 0) return false;
            _contact.normal.copy(_normal); _contact.depth = -d;
            return true;
        }
        // Transform center into body-local space
        q.vmultInverse(c.vsub(b.position, _tmp), _local);
        let inside = false;
        if (shape.type === SHAPE.BOX) {
            const h = shape.halfExtents;
            _closest.set(
                Math.max(-h.x, Math.min(h.x, _local.x)),
                Math.max(-h.y, Math.min(h.y, _local.y)),
                Math.max(-h.z, Math.min(h.z, _local.z))
            );
            if (_closest.x === _local.x && _closest.y === _local.y && _closest.z === _local.z) {
                inside = true;
                const dx = h.x - Math.abs(_local.x), dy = h.y - Math.abs(_local.y), dz = h.z - Math.abs(_local.z);
                if (dx <= dy && dx <= dz) _normal.set(Math.sign(_local.x) || 1, 0, 0), _contact.depth = dx + r;
                else if (dy <= dz) _normal.set(0, Math.sign(_local.y) || 1, 0), _contact.depth = dy + r;
                else _normal.set(0, 0, Math.sign(_local.z) || 1), _contact.depth = dz + r;
            }
        } else if (shape.type === SHAPE.CYLINDER) {
            const R = shape.radius, H = shape.halfHeight;
            const rho = Math.hypot(_local.x, _local.z);
            const cy = Math.max(-H, Math.min(H, _local.y));
            if (rho > R) {
                const k = R / rho;
                _closest.set(_local.x * k, cy, _local.z * k);
            } else if (cy !== _local.y) {
                _closest.set(_local.x, cy, _local.z);
            } else {
                inside = true;
                const dSide = R - rho, dCap = H - Math.abs(_local.y);
                if (dSide < dCap && rho > 1e-9) _normal.set(_local.x / rho, 0, _local.z / rho), _contact.depth = dSide + r;
                else _normal.set(0, Math.sign(_local.y) || 1, 0), _contact.depth = dCap + r;
            }
        } else {
            return false;
        }
        if (!inside) {
            _local.vsub(_closest, _normal);
            const dist = _normal.normalize();
            if (dist >= r || dist === 0) return false;
            _contact.depth = r - dist;
        }
        q.vmult(_normal, _contact.normal);
        return true;
    }

    // ----------------------------------------------------------------- World
    class World {
        constructor() {
            this.gravity = new Vec3(0, -9.82, 0);
            this.broadphase = null;
            this.solver = { iterations: 10 };
            this.bodies = [];
            this.contactMaterials = [];
            this.defaultContactMaterial = new ContactMaterial(null, null, { friction: 0.3, restitution: 0.3 });
            this.accumulator = 0;
            this.time = 0;
            this.stepnumber = 0;
        }
        addBody(b) { if (this.bodies.indexOf(b) < 0) this.bodies.push(b); }
        removeBody(b) { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); }
        addContactMaterial(cm) { this.contactMaterials.push(cm); }
        getContactMaterial(m1, m2) {
            for (let i = 0; i < this.contactMaterials.length; i++) {
                const cm = this.contactMaterials[i], a = cm.materials[0], b = cm.materials[1];
                if ((a === m1 && b === m2) || (a === m2 && b === m1)) return cm;
            }
            return this.defaultContactMaterial;
        }
        /** Fixed-step advance. Mirrors cannon's step(fixed, dt, maxSubSteps) semantics. */
        step(fixed, dt, maxSubSteps) {
            if (dt === undefined) { this.internalStep(fixed); return; }
            maxSubSteps = maxSubSteps || 10;
            this.accumulator += dt;
            let n = 0;
            while (this.accumulator >= fixed && n < maxSubSteps) {
                this.internalStep(fixed);
                this.accumulator -= fixed;
                n++;
            }
            if (this.accumulator > fixed) this.accumulator %= fixed;
        }
        internalStep(h) {
            const bodies = this.bodies, g = this.gravity;
            for (let i = 0; i < bodies.length; i++) {
                const b = bodies[i];
                if (b.type !== Body.DYNAMIC) continue;
                // Integrate (semi-implicit Euler)
                b.velocity.x += g.x * h; b.velocity.y += g.y * h; b.velocity.z += g.z * h;
                const ld = Math.pow(1 - b.linearDamping, h), ad = Math.pow(1 - b.angularDamping, h);
                b.velocity.x *= ld; b.velocity.y *= ld; b.velocity.z *= ld;
                b.angularVelocity.x *= ad; b.angularVelocity.y *= ad; b.angularVelocity.z *= ad;
                b.position.x += b.velocity.x * h; b.position.y += b.velocity.y * h; b.position.z += b.velocity.z * h;
                b.quaternion.integrateInPlace(b.angularVelocity, h);

                const s = b.shapes[0];
                if (!s || s.type !== SHAPE.SPHERE) continue;
                for (let j = 0; j < bodies.length; j++) {
                    const o = bodies[j];
                    if (o === b || o.type === Body.DYNAMIC) continue;
                    for (let k = 0; k < o.shapes.length; k++) {
                        if (!sphereVsShape(b.position, s.radius, o, o.shapes[k])) continue;
                        if (b.collisionResponse && o.collisionResponse) this.resolve(b, s.radius, o);
                        _evtA.body = o; _evtA.target = b; b.dispatchEvent(_evtA);
                        _evtB.body = b; _evtB.target = o; o.dispatchEvent(_evtB);
                        break;
                    }
                }
            }
            this.time += h;
            this.stepnumber++;
        }
        resolve(b, r, o) {
            const n = _contact.normal, cm = this.getContactMaterial(b.material, o.material);
            // Positional correction
            b.position.x += n.x * _contact.depth; b.position.y += n.y * _contact.depth; b.position.z += n.z * _contact.depth;
            const v = b.velocity, vn = v.dot(n);
            if (vn >= 0) return;
            // Tangential component
            _vt.set(v.x - n.x * vn, v.y - n.y * vn, v.z - n.z * vn);
            const e = Math.abs(vn) < 0.5 ? 0 : cm.restitution; // kill micro-bounce jitter
            const jn = -(1 + e) * vn;
            v.x += n.x * jn; v.y += n.y * jn; v.z += n.z * jn;
            // Coulomb friction: reduce tangential speed, bounded by mu * normal impulse
            const vtLen = _vt.length();
            if (vtLen > 1e-9) {
                const dv = Math.min(vtLen, cm.friction * Math.abs(vn) * (1 + e) * 0.5);
                const k = dv / vtLen;
                v.x -= _vt.x * k; v.y -= _vt.y * k; v.z -= _vt.z * k;
                // Rolling spin: w = n x v / r
                n.cross(v, b.angularVelocity).scale(1 / r, b.angularVelocity);
            }
        }
    }

    const StrikePhysics = {
        Vec3, Quaternion, Body, World, Material, ContactMaterial, NaiveBroadphase,
        Sphere, Plane, Box, Cylinder, SHAPE_TYPES: SHAPE, version: '1.0.0'
    };
    root.StrikePhysics = StrikePhysics;
    root.CANNON = StrikePhysics; // compatibility alias for existing gameplay code
    if (typeof module !== 'undefined' && module.exports) module.exports = StrikePhysics;
})(typeof window !== 'undefined' ? window : globalThis);
