/**
 * CharacterAnimator — drives a single skinned, mocap-animated GLB character.
 *
 * Replaces the legacy "one static GLB per pose, toggle visibility" approach.
 * PlayerKinematics keeps calling setPose('<legacy pose>') and moving the parent group;
 * this class maps each legacy pose onto a mocap clip (with optional start offset,
 * loop mode, speed and mirroring) and crossfades between them.
 *
 * Kit materials exported by tools/blender/build_characters.py:
 *   kit_shirt, kit_shorts, kit_socks, kit_boots, gk_gloves  -> tinted per team at runtime.
 */
(function (root) {
    'use strict';

    const KIT_SLOTS = ['kit_shirt', 'kit_shorts', 'kit_socks', 'kit_boots', 'gk_gloves'];

    class CharacterAnimator {
        /**
         * @param {THREE.Object3D} model   scene graph (already cloned if shared)
         * @param {THREE.AnimationClip[]} clips
         * @param {Object} poseMap  legacy pose -> { clip, loop, offset, speed, mirror, fade }
         */
        constructor(model, clips, poseMap) {
            this.model = model;
            this.mixer = new THREE.AnimationMixer(model);
            this.poseMap = poseMap;
            this.actions = {};
            this.current = null;
            this.currentPose = null;
            this.baseScaleLat = model.scale.z; // lateral axis (model forward is local -X)
            for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
            this.kitMaterials = {};
            model.traverse(n => {
                if (!n.isMesh) return;
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false; // skinned bounds don't follow animation
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m, i) => {
                    if (!m) return;
                    const key = KIT_SLOTS.find(k => m.name && m.name.indexOf(k) === 0);
                    if (key) {
                        // Per-character material instance so teams can differ
                        const inst = m.clone();
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        (this.kitMaterials[key] || (this.kitMaterials[key] = [])).push(inst);
                    }
                });
            });
        }

        hasClip(name) { return !!this.actions[name]; }

        /** Tint kit: { shirt: 0xff0000, shorts: 0xffffff, socks: 0xff0000, boots: 0x111111, gloves: 0xeeeeee } */
        setKit(kit) {
            const map = { shirt: 'kit_shirt', shorts: 'kit_shorts', socks: 'kit_socks', boots: 'kit_boots', gloves: 'gk_gloves' };
            for (const k in kit) {
                const list = this.kitMaterials[map[k]];
                if (list) list.forEach(m => { m.color.setHex(kit[k]); m.needsUpdate = true; });
            }
        }

        setPose(pose) {
            const spec = this.poseMap[pose];
            if (!spec || pose === this.currentPose) return;
            if (spec.keep && this.current) { this.currentPose = pose; return; } // continue current clip
            const action = this.actions[spec.clip];
            if (!action) return;
            this.currentPose = pose;
            action.reset();
            action.setLoop(spec.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = spec.loop === false;
            action.timeScale = spec.speed || 1;
            action.time = spec.offset || 0;
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

        update(dt) { this.mixer.update(dt); }
    }

    // Legacy pose -> clip maps
    CharacterAnimator.STRIKER_POSES = {
        idle:           { clip: 'idle' },
        run:            { clip: 'run', speed: 1.1 },
        plant:          { clip: 'kick_power', loop: false, offset: 1.05, fade: 0.12 },
        strike_instep:  { keep: true },
        strike_laces:   { keep: true },
        follow_through: { keep: true },
        celebrate:      { clip: 'celebrate', fade: 0.3 },
        disbelief:      { clip: 'dejected', fade: 0.3 }
    };
    CharacterAnimator.GK_POSES = {
        idle:            { clip: 'idle' },
        dive_right:      { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08 },
        dive_left:       { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08, mirror: true },
        low_sweep_right: { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08 },
        low_sweep_left:  { clip: 'side_jump', loop: false, offset: 0.45, fade: 0.08, mirror: true },
        parry:           { clip: 'catch', loop: false, offset: 0.6, fade: 0.1 },
        recovery_roll:   { clip: 'idle', fade: 0.4 }
    };
    CharacterAnimator.WALL_POSES = {
        idle: { clip: 'idle' },
        jump: { clip: 'wall_jump', loop: false, fade: 0.08 }
    };

    root.CharacterAnimator = CharacterAnimator;
})(typeof window !== 'undefined' ? window : globalThis);
