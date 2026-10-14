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
            this.garmentUniforms = {
                uSkinColor:   { value: new THREE.Color(0xc68863) },
                uShirtColor:  { value: new THREE.Color(0x1e3a8a) },
                uShortsColor: { value: new THREE.Color(0xe2e8f0) },
                uSocksColor:  { value: new THREE.Color(0xb91c1c) },
                uGlovesColor: { value: new THREE.Color(0xe2e8f0) },
                uIsGk:        { value: this.role === 'gk' ? 1.0 : 0.0 },
                uWireframe:   { value: root.__wireframeMode ? 1.0 : 0.0 }
            };

            const attachGarmentShader = (mat, uniforms) => {
                mat.onBeforeCompile = (shader) => {
                    shader.uniforms.uSkinColor   = uniforms.uSkinColor;
                    shader.uniforms.uShirtColor  = uniforms.uShirtColor;
                    shader.uniforms.uShortsColor = uniforms.uShortsColor;
                    shader.uniforms.uSocksColor  = uniforms.uSocksColor;
                    shader.uniforms.uGlovesColor = uniforms.uGlovesColor;
                    shader.uniforms.uIsGk        = uniforms.uIsGk;
                    shader.uniforms.uWireframe   = uniforms.uWireframe;

                    shader.vertexShader = 'varying vec3 vRestPos;\n' + shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        '#include <begin_vertex>\nvRestPos = position;'
                    );

                    shader.fragmentShader = `
                        uniform vec3 uSkinColor;
                        uniform vec3 uShirtColor;
                        uniform vec3 uShortsColor;
                        uniform vec3 uSocksColor;
                        uniform vec3 uGlovesColor;
                        uniform float uIsGk;
                        uniform float uWireframe;
                        varying vec3 vRestPos;
                    \n` + shader.fragmentShader.replace(
                        '#include <color_fragment>',
                        `#include <color_fragment>
                        // Rest-pose normalized coordinates [-1..+1]:
                        //   y  = vertical height (-1.0 feet to +1.0 head)
                        //   ax = abs(vRestPos.x) is LATERAL width (0 at spine, ~0.24 at hips/thighs, >0.26 out on arms/hands)
                        //   rz = vRestPos.z is FRONT/BACK depth
                        float ry = vRestPos.y;
                        float ax = abs(vRestPos.x);
                        float rz = vRestPos.z;

                        // Start with smooth skin tone
                        vec3 gCol = uSkinColor;

                        // 1. Football Socks: below knee (ry < -0.505) with crisp 2cm turnover cuff stripe
                        float sockMask = 1.0 - smoothstep(-0.512, -0.500, ry);
                        float sockStripe = smoothstep(-0.542, -0.535, ry) * (1.0 - smoothstep(-0.520, -0.513, ry));
                        vec3 sockCol = mix(uSocksColor, uShortsColor, sockStripe * 0.88);
                        gCol = mix(gCol, sockCol, sockMask);

                        // 2. Authentic Football Shorts: lower-mid thigh (ry > -0.315) up into waist (ry < 0.080), confined to pelvis/thighs (ax < 0.255)
                        float inTorsoOrThighX = 1.0 - smoothstep(0.248, 0.262, ax);
                        float shortsBot = smoothstep(-0.320, -0.308, ry);
                        float shortsTop = 1.0 - smoothstep(0.070, 0.085, ry);
                        float shortsMask = shortsBot * shortsTop * inTorsoOrThighX;
                        float shortsHemStripe = smoothstep(-0.318, -0.311, ry) * (1.0 - smoothstep(-0.298, -0.291, ry));
                        vec3 shortsFinal = mix(uShortsColor, uShirtColor, shortsHemStripe * 0.65);
                        gCol = mix(gCol, shortsFinal, shortsMask);

                        // 3. Jersey Shirt & Sleeves: overlaps shorts waistband seamlessly at ry = 0.030 (flat 360-degree horizontal hem, zero bare skin!)
                        float collarCurve = 0.722 - 0.032 * (1.0 - clamp(ax / 0.110, 0.0, 1.0)) * step(0.0, rz + 0.04);
                        float belowCollar = 1.0 - smoothstep(collarCurve - 0.006, collarCurve + 0.006, ry);
                        float aboveWaist = smoothstep(0.025, 0.035, ry);

                        // Separate torso (ax < 0.235) from arms (ax >= 0.235):
                        // Torso is 100% covered from ry = 0.030 to collarCurve; arms have short-sleeve bicep cuffs (or long sleeves for GK)
                        float isArm = smoothstep(0.220, 0.250, ax);
                        float armDist = (ax - 0.210) * 0.85 + max(0.0, 0.560 - ry) * 0.55;
                        float sleeveLimit = mix(0.185, 0.435, uIsGk);
                        float armSleeveMask = 1.0 - smoothstep(sleeveLimit - 0.008, sleeveLimit + 0.008, armDist);
                        float inGarmentSpan = mix(1.0, armSleeveMask, isArm);
                        float shirtMask = aboveWaist * belowCollar * inGarmentSpan;

                        // Subtle collar & sleeve cuff trim + jersey bottom hem drop-shadow on shorts
                        float cuffBand = smoothstep(sleeveLimit - 0.024, sleeveLimit - 0.016, armDist) * armSleeveMask * isArm;
                        float collarBand = smoothstep(collarCurve - 0.022, collarCurve - 0.015, ry) * belowCollar * (1.0 - step(0.13, ax));
                        vec3 shirtFinal = mix(uShirtColor, uShortsColor, clamp(cuffBand + collarBand, 0.0, 1.0) * 0.75);
                        float hemDropShadow = smoothstep(0.014, 0.025, ry) * (1.0 - smoothstep(0.025, 0.038, ry)) * inTorsoOrThighX;
                        gCol = mix(gCol, gCol * 0.78, hemDropShadow);
                        gCol = mix(gCol, shirtFinal, shirtMask);

                        // 4. Goalkeeper Gloves on hands/wrists when uIsGk > 0.5
                        if (uIsGk > 0.5) {
                            float gloveMask = smoothstep(0.420, 0.438, armDist) * isArm * step(-0.08, ry) * (1.0 - step(0.65, ry));
                            gCol = mix(gCol, uGlovesColor, gloveMask);
                        }

                        // 5. Micro-fabric knit weave & athletic fold shading (matches 2K Nano Banana close-up render)
                        float isFabric = clamp(shirtMask + shortsMask + sockMask, 0.0, 1.0);
                        float weaveX = sin(vRestPos.x * 520.0 + vRestPos.z * 240.0);
                        float weaveY = cos(vRestPos.y * 640.0 - vRestPos.z * 180.0);
                        float microWeave = 1.0 + (weaveX * weaveY) * 0.045 * isFabric;
                        float foldShade = 1.0 + 0.06 * sin(vRestPos.y * 38.0 + vRestPos.x * 24.0) * isFabric;
                        gCol *= microWeave * foldShade;

                        // 6. High-contrast topology lattice in diagnostic wireframe mode so high-poly skinned characters show crisp mesh lines
                        if (uWireframe > 0.5) {
                            float gx = abs(fract(vRestPos.x * 22.0) - 0.5);
                            float gy = abs(fract(vRestPos.y * 28.0) - 0.5);
                            float gz = abs(fract((vRestPos.x + vRestPos.y + vRestPos.z) * 18.0) - 0.5);
                            float lineMask = 1.0 - smoothstep(0.05, 0.16, min(min(gx, gy), gz));
                            gCol = mix(vec3(0.03, 0.06, 0.12), mix(gCol, vec3(0.22, 0.88, 1.0), 0.72), lineMask);
                        }

                        diffuseColor.rgb = gCol;
                        `
                    );
                };
                mat.customProgramCacheKey = () => 'garment_v7_' + this.role;
                mat.needsUpdate = true;
            };

            model.traverse(n => {
                if (n.isBone && n.name) {
                    this.bones[n.name] = n;
                }
                if (!n.isMesh) return;
                n.castShadow = true;
                // Disable self-shadow reception on SkinnedMesh to prevent directional shadow-map staircase acne on limbs
                n.receiveShadow = false;
                n.frustumCulled = false; // skinned bounds don't follow animation
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m, i) => {
                    if (!m) return;
                    const key = KIT_SLOTS.find(k => m.name && m.name.indexOf(k) === 0);
                    if (key === 'kit_boots') {
                        const inst = m.clone();
                        inst.roughness = 0.36;
                        inst.metalness = 0.12;
                        inst.wireframe = !!root.__wireframeMode;
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        (this.kitMaterials[key] || (this.kitMaterials[key] = [])).push(inst);
                    } else if (key || (m.name && /Human\.body/i.test(m.name))) {
                        const inst = m.clone();
                        inst.map = null; inst.aoMap = null; inst.normalMap = null; inst.roughnessMap = null; inst.metalnessMap = null;
                        inst.transparent = false; inst.opacity = 1; inst.depthWrite = true; inst.alphaTest = 0;
                        inst.roughness = 0.64; inst.metalness = 0.02;
                        inst.color.setHex(0xffffff);
                        inst.wireframe = !!root.__wireframeMode;
                        attachGarmentShader(inst, this.garmentUniforms);
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        if (key) {
                            (this.kitMaterials[key] || (this.kitMaterials[key] = [])).push(inst);
                        } else {
                            this.skinMaterials.push(inst);
                        }
                    } else if (m.name && /short02|short04|hair/i.test(m.name)) {
                        const inst = m.clone();
                        inst.map = null;
                        inst.transparent = false; inst.opacity = 1; inst.depthWrite = true;
                        inst.roughness = 0.78; inst.metalness = 0.04;
                        inst.color.setHex(0x18120e);
                        inst.wireframe = !!root.__wireframeMode;
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        this.hairMaterials.push(inst);
                    } else if (m.name && /eyebrow|eyelash/i.test(m.name)) {
                        const inst = m.clone();
                        inst.transparent = true; inst.alphaTest = 0.22; inst.depthWrite = false;
                        inst.color.setHex(0x18120e);
                        inst.wireframe = !!root.__wireframeMode;
                        if (Array.isArray(n.material)) n.material[i] = inst; else n.material = inst;
                        this.hairMaterials.push(inst);
                    } else if (m.name && /low-poly|eye/i.test(m.name)) {
                        m.transparent = false; m.opacity = 1; m.depthWrite = true;
                        m.roughness = 0.15; m.color.setHex(0xffffff);
                        m.wireframe = !!root.__wireframeMode;
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
            if (kit.shirt !== undefined)  this.garmentUniforms.uShirtColor.value.setHex(kit.shirt);
            if (kit.shorts !== undefined) this.garmentUniforms.uShortsColor.value.setHex(kit.shorts);
            if (kit.socks !== undefined)  this.garmentUniforms.uSocksColor.value.setHex(kit.socks);
            if (kit.gloves !== undefined) this.garmentUniforms.uGlovesColor.value.setHex(kit.gloves);
            if (kit.skin !== undefined)   this.garmentUniforms.uSkinColor.value.setHex(kit.skin);

            if (kit.boots !== undefined && this.kitMaterials.kit_boots) {
                this.kitMaterials.kit_boots.forEach(m => { m.color.setHex(kit.boots); m.needsUpdate = true; });
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
                    // Wide athletic goalkeeper ready crouch + raised gloves + lateral split-step shuffle
                    const pulse = Math.sin(this.animTime * 4.2) * 0.03;
                    const sway = Math.sin(this.animTime * 2.1) * 0.035;
                    applyBoneEulerDelta(b.LeftUpLeg, -0.22 - pulse, 0, -0.27 + sway * 0.4);
                    applyBoneEulerDelta(b.RightUpLeg, -0.22 - pulse, 0, 0.27 + sway * 0.4);
                    applyBoneEulerDelta(b.LeftLeg, 0.36 + pulse * 1.5, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.36 + pulse * 1.5, 0, 0);
                    applyBoneEulerDelta(b.Spine, 0.12, sway * 0.5, -sway * 0.35);
                    applyBoneEulerDelta(b.LeftArm, 0.22, 0, 0.28 + pulse * 0.5);
                    applyBoneEulerDelta(b.RightArm, 0.22, 0, -0.28 - pulse * 0.5);
                    applyBoneEulerDelta(b.LeftForeArm, 0.52, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, 0.52, 0, 0);
                } else if (pose === 'dive_right' || pose === 'dive_left') {
                    // Top-corner flying fingertip extension: full overhead arm reach, arched spine, and counter-scissor trail leg
                    applyBoneEulerDelta(b.Spine, -0.08, 0, 0.14);
                    applyBoneEulerDelta(b.LeftArm, 0.42, 0, 0.94);
                    applyBoneEulerDelta(b.RightArm, 0.42, 0, -0.94);
                    applyBoneEulerDelta(b.LeftForeArm, -0.24, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, -0.24, 0, 0);
                    applyBoneEulerDelta(b.LeftUpLeg, -0.18, 0, -0.15);
                    applyBoneEulerDelta(b.RightUpLeg, 0.12, 0, 0.22);
                    applyBoneEulerDelta(b.LeftLeg, 0.45, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.18, 0, 0);
                } else if (pose === 'low_sweep_right' || pose === 'low_sweep_left') {
                    // Low turf-skimming ground scoop: deep lateral lunge, low sweeping arms, and tucked trail knee
                    applyBoneEulerDelta(b.Spine, 0.24, 0, 0.18);
                    applyBoneEulerDelta(b.LeftArm, 0.55, 0.20, 0.62);
                    applyBoneEulerDelta(b.RightArm, 0.55, -0.20, -0.62);
                    applyBoneEulerDelta(b.LeftForeArm, 0.12, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, 0.12, 0, 0);
                    applyBoneEulerDelta(b.LeftUpLeg, -0.35, 0, -0.20);
                    applyBoneEulerDelta(b.RightUpLeg, -0.10, 0, 0.15);
                    applyBoneEulerDelta(b.LeftLeg, 0.62, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.25, 0, 0);
                } else if (pose === 'parry') {
                    // Explosive two-handed reflex parry punch above chest/head
                    applyBoneEulerDelta(b.Spine, -0.06, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.68, 0.22, 0.55);
                    applyBoneEulerDelta(b.RightArm, 0.68, -0.22, -0.55);
                    applyBoneEulerDelta(b.LeftForeArm, 0.18, 0, 0);
                    applyBoneEulerDelta(b.RightForeArm, 0.18, 0, 0);
                } else if (pose === 'recovery_roll') {
                    // Athletic turf landing absorption crouch
                    applyBoneEulerDelta(b.Spine, 0.28, 0, 0);
                    applyBoneEulerDelta(b.LeftUpLeg, -0.38, 0, -0.18);
                    applyBoneEulerDelta(b.RightUpLeg, -0.38, 0, 0.18);
                    applyBoneEulerDelta(b.LeftLeg, 0.65, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.65, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.30, 0, 0.25);
                    applyBoneEulerDelta(b.RightArm, 0.30, 0, -0.25);
                }
            } else if (this.role === 'wall') {
                if (pose === 'idle') {
                    // In the raw idle clip, RightLeg is bent +0.42 rad more than LeftLeg (lifting the right boot ~4cm).
                    // Extend RightLeg (-0.38) and lower RightUpLeg (+0.18) so BOTH boots plant 100% flush on Y = 0!
                    applyBoneEulerDelta(b.LeftUpLeg, -0.02, 0, -0.05);
                    applyBoneEulerDelta(b.RightUpLeg, 0.18, 0, 0.05);
                    applyBoneEulerDelta(b.LeftLeg, 0.04, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, -0.38, 0, 0);
                    applyBoneEulerDelta(b.RightFoot, 0.16, 0, 0);

                    // Authentic free-kick wall stance: upper arms tucked into torso, forearms angled inward across pelvis
                    applyBoneEulerDelta(b.LeftArm, 0.04, 0.42, 0.14);
                    applyBoneEulerDelta(b.RightArm, 0.04, -0.42, -0.14);
                    applyBoneEulerDelta(b.LeftForeArm, 0.28, 0.38, -0.16);
                    applyBoneEulerDelta(b.RightForeArm, 0.28, -0.38, 0.16);
                } else if (pose === 'jump') {
                    // Mid-air wall jump with tucked knees & groin-guard arms
                    applyBoneEulerDelta(b.LeftUpLeg, -0.24, 0, -0.08);
                    applyBoneEulerDelta(b.RightUpLeg, -0.12, 0, 0.08);
                    applyBoneEulerDelta(b.LeftLeg, 0.42, 0, 0);
                    applyBoneEulerDelta(b.RightLeg, 0.12, 0, 0);
                    applyBoneEulerDelta(b.LeftArm, 0.06, 0.42, 0.14);
                    applyBoneEulerDelta(b.RightArm, 0.06, -0.42, -0.14);
                    applyBoneEulerDelta(b.LeftForeArm, 0.30, 0.38, -0.16);
                    applyBoneEulerDelta(b.RightForeArm, 0.30, -0.38, 0.16);
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
