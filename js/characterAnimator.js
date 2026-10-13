/**
 * CharacterAnimator — drives a single skinned, mocap-animated GLB character
 * with biomechanical football posture overrides (Goalkeeper wide crouch & outstretched dive,
 * Defensive Wall groin-guard stance, and Striker wide power stance) + customizable team kits,
 * skin tones, hair colors, and 3D jersey back numbers.
 */
(function (root) {
    'use strict';

    const KIT_SLOTS = ['kit_shirt', 'kit_shorts', 'kit_socks', 'kit_boots', 'gk_gloves'];

    // Pre-allocated quaternion scratchpad (zero allocation in update loop)
    const _qDelta = new THREE.Quaternion();
    const _euler = new THREE.Euler();

    function applyBoneEulerDelta(bone, rx, ry, rz) {
        if (!bone) return;
        _euler.set(rx, ry, rz, 'XYZ');
        _qDelta.setFromEuler(_euler);
        bone.quaternion.multiply(_qDelta);
    }

    function createJerseyNumberTexture(numberStr, nameStr, textColor, bgColor) {
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);

        if (nameStr) {
            ctx.font = '900 34px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.strokeText(nameStr.toUpperCase(), 128, 42);
            ctx.fillStyle = textColor || '#ffffff';
            ctx.fillText(nameStr.toUpperCase(), 128, 42);
        }

        ctx.font = '900 156px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(String(numberStr), 128, 152);
        ctx.fillStyle = textColor || '#ffffff';
        ctx.fillText(String(numberStr), 128, 152);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    class CharacterAnimator {
        /**
         * @param {THREE.Object3D} model   scene graph (already cloned if shared)
         * @param {THREE.AnimationClip[]} clips
         * @param {Object} poseMap  legacy pose -> { clip, loop, offset, speed, mirror, fade }
         * @param {String} role     'gk' | 'wall' | 'striker'
         */
        constructor(model, clips, poseMap, role = 'striker') {
            this.model = model;
            this.role = role;
            this.mixer = new THREE.AnimationMixer(model);
            this.poseMap = poseMap;
            this.actions = {};
            this.current = null;
            this.currentPose = null;
            this.animTime = Math.random() * 3.0;
            this.baseScaleLat = model.scale.z; // lateral axis (model forward is local -X)

            // Fix frame-0 glTF export reset pose artifact (frame 0 was T-pose in exported clips)
            for (const clip of clips) {
                if (!clip._frame0Fixed) {
                    for (let t = 0; t < clip.tracks.length; t++) {
                        const tr = clip.tracks[t];
                        const stride = tr.getValueSize();
                        if (tr.times.length >= 2 && tr.values.length >= stride * 2) {
                            for (let s = 0; s < stride; s++) {
                                tr.values[s] = tr.values[stride + s];
                            }
                        }
                    }
                    clip._frame0Fixed = true;
                }
                this.actions[clip.name] = this.mixer.clipAction(clip);
            }

            // Cache skeleton bones for zero-alloc biomechanical posture adjustments
            this.bones = {};
            this.kitMaterials = {};
            this.skinMaterials = [];
            this.hairMaterials = [];

            model.traverse(n => {
                if (n.isBone && n.name) {
                    this.bones[n.name] = n;
                }
                if (!n.isMesh) return;
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false; // skinned bounds don't follow animation
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m, i) => {
                    if (!m) return;
                    const key = KIT_SLOTS.find(k => m.name && m.name.indexOf(k) === 0);
                    if (key) {
                        const inst = m.clone();
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        (this.kitMaterials[key] || (this.kitMaterials[key] = [])).push(inst);
                    } else if (m.name && /Human\.body/i.test(m.name)) {
                        const inst = m.clone();
                        inst.map = null; inst.aoMap = null;
                        inst.transparent = false; inst.opacity = 1; inst.depthWrite = true;
                        inst.roughness = 0.52; inst.metalness = 0.0;
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        this.skinMaterials.push(inst);
                    } else if (m.name && /short02|short04|hair/i.test(m.name)) {
                        const inst = m.clone();
                        inst.map = null;
                        inst.transparent = false; inst.opacity = 1; inst.depthWrite = true;
                        inst.roughness = 0.78; inst.metalness = 0.04;
                        inst.color.setHex(0x18120e);
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        this.hairMaterials.push(inst);
                    } else if (m.name && /eyebrow|eyelash/i.test(m.name)) {
                        const inst = m.clone();
                        inst.transparent = true; inst.alphaTest = 0.22; inst.depthWrite = false;
                        inst.color.setHex(0x18120e);
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        this.hairMaterials.push(inst);
                    } else if (m.name && /low-poly|eye/i.test(m.name)) {
                        m.transparent = false; m.opacity = 1; m.depthWrite = true;
                        m.roughness = 0.15; m.color.setHex(0xffffff);
                        m.needsUpdate = true;
                    }
                });
            });
        }

        hasClip(name) { return !!this.actions[name]; }

        /**
         * Tint kit, skin, hair, and optionally attach/update 3D back number decal:
         * { shirt, shorts, socks, boots, gloves, skin, hair, number, name, numberColor }
         */
        setKit(kit) {
            const map = { shirt: 'kit_shirt', shorts: 'kit_shorts', socks: 'kit_socks', boots: 'kit_boots', gloves: 'gk_gloves' };
            for (const k in map) {
                if (kit[k] !== undefined) {
                    const list = this.kitMaterials[map[k]];
                    if (list) list.forEach(m => { m.color.setHex(kit[k]); m.needsUpdate = true; });
                }
            }
            if (kit.skin !== undefined) {
                this.skinMaterials.forEach(m => { m.color.setHex(kit.skin); m.needsUpdate = true; });
            }
            if (kit.hair !== undefined) {
                this.hairMaterials.forEach(m => { m.color.setHex(kit.hair); m.needsUpdate = true; });
            }
            if (kit.number !== undefined && this.bones.Spine1) {
                const tex = createJerseyNumberTexture(kit.number, kit.name || '', kit.numberColor || '#ffffff');
                if (tex) {
                    if (!this.numberMesh) {
                        const geo = new THREE.PlaneGeometry(0.25, 0.25);
                        const mat = new THREE.MeshBasicMaterial({
                            map: tex,
                            transparent: true,
                            depthWrite: false,
                            side: THREE.DoubleSide
                        });
                        this.numberMesh = new THREE.Mesh(geo, mat);
                        // Spine1 bone local space: -Z is back normal, -X shifts toward right shoulder to center on torso
                        this.numberMesh.position.set(-0.052, 0.04, -0.148);
                        this.numberMesh.rotation.set(0.14, Math.PI, 0);
                        this.bones.Spine1.add(this.numberMesh);
                    } else {
                        this.numberMesh.material.map = tex;
                        this.numberMesh.material.needsUpdate = true;
                    }
                }
            }
        }

        setPose(pose) {
            const spec = this.poseMap[pose];
            if (!spec || pose === this.currentPose) return;
            if (spec.keep && this.current) { this.currentPose = pose; return; }
            const action = this.actions[spec.clip];
            if (!action) return;
            this.currentPose = pose;
            action.reset();
            action.setLoop(spec.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = spec.loop === false;
            action.timeScale = spec.speed || 1;
            action.time = Math.max(0.05, spec.offset || 0.05);
            action.enabled = true;
            action.setEffectiveWeight(1);
            const fade = spec.fade !== undefined ? spec.fade : 0.18;
            if (this.current && this.current !== action) {
                action.crossFadeFrom(this.current, fade, false);
            }
            action.play();
            this.current = action;
            this.model.scale.z = spec.mirror ? -Math.abs(this.baseScaleLat) : Math.abs(this.baseScaleLat);
        }

        update(dt) {
            this.animTime += dt;
            this.mixer.update(dt);
            this.applyAthleticPosture();
        }

        applyAthleticPosture() {
            const b = this.bones;
            if (!b.LeftUpLeg || !b.RightUpLeg) return;
            const pose = this.currentPose || 'idle';

            if (this.role === 'gk') {
                if (pose === 'idle') {
                    // Wide athletic goalkeeper ready crouch + raised gloves + rhythmic bounce
                    const pulse = Math.sin(this.animTime * 4.2) * 0.03;
                    applyBoneEulerDelta(b.LeftUpLeg, -0.22 - pulse, 0, -0.27);
                    applyBoneEulerDelta(b.RightUpLeg, -0.22 - pulse, 0, 0.27);
                    applyBoneEulerDelta(b.LeftLeg, 0.36 + pulse * 1.5, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.36 + pulse * 1.5, 0, 0);
                    applyBoneEulerDelta(b.Spine, 0.12, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.28, 0, 0.38);
                    applyBoneEulerDelta(b.RightArm, 0.28, 0, -0.38);
                    applyBoneEulerDelta(b.LeftForeArm, 0.68, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, 0.68, 0, 0);
                } else if (pose === 'dive_right' || pose === 'dive_left' || pose === 'low_sweep_right' || pose === 'low_sweep_left') {
                    // Full outstretched fingertip save reach overhead
                    applyBoneEulerDelta(b.LeftArm, 0.35, 0, 0.82);
                    applyBoneEulerDelta(b.RightArm, 0.35, 0, -0.82);
                    applyBoneEulerDelta(b.LeftForeArm, -0.20, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, -0.20, 0, 0);
                }
            } else if (this.role === 'wall') {
                if (pose === 'idle') {
                    // Shoulder-width defensive wall stance + hands protecting groin
                    applyBoneEulerDelta(b.LeftUpLeg, -0.06, 0, -0.15);
                    applyBoneEulerDelta(b.RightUpLeg, -0.06, 0, 0.15);
                    applyBoneEulerDelta(b.LeftLeg, 0.12, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.12, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.22, 0, -0.18);
                    applyBoneEulerDelta(b.RightArm, 0.22, 0, 0.18);
                    applyBoneEulerDelta(b.LeftForeArm, 0.22, 0, -0.35);
                    applyBoneEulerDelta(b.RightForeArm, 0.22, 0, 0.35);
                } else if (pose === 'jump') {
                    // Mid-air wall jump with tucked knees & groin protection
                    applyBoneEulerDelta(b.LeftUpLeg, -0.25, 0, -0.12);
                    applyBoneEulerDelta(b.RightUpLeg, -0.25, 0, 0.12);
                    applyBoneEulerDelta(b.LeftLeg, 0.45, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.45, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.22, 0, -0.18);
                    applyBoneEulerDelta(b.RightArm, 0.22, 0, 0.18);
                    applyBoneEulerDelta(b.LeftForeArm, 0.22, 0, -0.35);
                    applyBoneEulerDelta(b.RightForeArm, 0.22, 0, 0.35);
                }
            } else if (this.role === 'striker') {
                if (pose === 'idle') {
                    // Iconic wide-legged free-kick / penalty power stance
                    const breath = Math.sin(this.animTime * 2.5) * 0.015;
                    applyBoneEulerDelta(b.LeftUpLeg, -0.06, 0, -0.21);
                    applyBoneEulerDelta(b.RightUpLeg, -0.06, 0, 0.21);
                    applyBoneEulerDelta(b.LeftLeg, 0.10, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.10, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.05, 0, 0.16 + breath);
                    applyBoneEulerDelta(b.RightArm, 0.05, 0, -0.16 - breath);
                }
            }
        }
    }

    // Legacy pose -> clip maps
    CharacterAnimator.STRIKER_POSES = {
        idle:           { clip: 'idle', offset: 0.06 },
        run:            { clip: 'run', speed: 1.25, offset: 0.06 },
        plant:          { clip: 'kick_power', loop: false, offset: 1.05, fade: 0.10 },
        strike_instep:  { keep: true },
        strike_laces:   { keep: true },
        follow_through: { keep: true },
        celebrate:      { clip: 'celebrate', fade: 0.25, offset: 0.06 },
        disbelief:      { clip: 'dejected', fade: 0.25, offset: 0.06 }
    };
    CharacterAnimator.GK_POSES = {
        idle:            { clip: 'idle', offset: 0.06 },
        dive_right:      { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08 },
        dive_left:       { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08, mirror: true },
        low_sweep_right: { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08 },
        low_sweep_left:  { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08, mirror: true },
        parry:           { clip: 'catch', loop: false, offset: 0.6, fade: 0.1 },
        recovery_roll:   { clip: 'idle', fade: 0.35, offset: 0.06 }
    };
    CharacterAnimator.WALL_POSES = {
        idle: { clip: 'idle', offset: 0.06 },
        jump: { clip: 'wall_jump', loop: false, offset: 0.20, fade: 0.08 }
    };

    root.CharacterAnimator = CharacterAnimator;
})(typeof window !== 'undefined' ? window : globalThis);
