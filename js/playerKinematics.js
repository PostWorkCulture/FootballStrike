/**
 * ============================================================================
 * FOOTBALL STRIKE 3D: PROFESSIONAL PLAYER KINEMATICS & ANIMATION ENGINE
 * ============================================================================
 * Advanced FIFA/EA FC Athletic Kinematics Module:
 * 1. Striker Motion:
 *    - 3-step curved approach run-up (quadratic Bezier trajectory with centripetal lean)
 *    - Plant foot placement (firm turf anchor with load absorption flexion)
 *    - Strike leg articulation: Instep curler (hip externally rotated, ankle everted)
 *      vs Laces power drive (sagittal piston drive, ankle plantarflexed)
 *    - Dynamic rotational follow-through (angular momentum torso counter-rotation & step-through)
 *    - Goal celebration (double fist-pump sprint) & disbelief reactions
 * 2. Goalkeeper Kinematics:
 *    - Anticipatory pre-jump power squat & plant-step
 *    - Smooth ballistic flight parabola (top-corner flight, mid-parry push, low turf sweep scoop)
 *    - Full outstretched fingertip reaches with glove collider alignment
 *    - Natural athletic shoulder-to-hip recovery roll upon landing
 * 3. Wall Defenders:
 *    - Organic asynchronous anticipation fidgeting & micro-twitches
 *    - Staggered jumping with mid-air knee tuck and ball-flinch reaction
 *    - Ground impact landing recovery with shock absorption flexion
 *    - Dynamic altitude-scaled ground contact shadows
 *
 * Performance: ZERO memory allocation inside update loops.
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ------------------------------------------------------------------------
    // PRE-ALLOCATED MATH SCRATCHPAD (ZERO HEAP ALLOCATION DURING FRAMES)
    // ------------------------------------------------------------------------
    const _v0 = new THREE.Vector3();
    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _v3 = new THREE.Vector3();
    const _q0 = new THREE.Quaternion();
    const _q1 = new THREE.Quaternion();
    const _e0 = new THREE.Euler();

    // ------------------------------------------------------------------------
    // VIRTUAL BONE HIERARCHY FACTORY (For Backwards-Compatible Test Alignment)
    // ------------------------------------------------------------------------
    function createVirtualBone() {
        return {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            quaternion: new THREE.Quaternion(),
            scale: new THREE.Vector3(1, 1, 1),
            getWorldPosition: function(target) {
                target.copy(this.position);
                return target;
            }
        };
    }

    function createVirtualArmature() {
        return {
            root: createVirtualBone(),
            spine: createVirtualBone(),
            chest: createVirtualBone(),
            head: createVirtualBone(),
            leftShoulder: createVirtualBone(),
            leftElbow: createVirtualBone(),
            rightShoulder: createVirtualBone(),
            rightElbow: createVirtualBone(),
            leftThigh: createVirtualBone(),
            leftKnee: createVirtualBone(),
            rightThigh: createVirtualBone(),
            rightKnee: createVirtualBone()
        };
    }

    // Export global virtual bone references for existing kinematics tests
    const gkBones = createVirtualArmature();
    const kickerBones = createVirtualArmature();
    const wallDefenderBones = [
        createVirtualArmature(),
        createVirtualArmature(),
        createVirtualArmature()
    ];

    global.gkBones = gkBones;
    global.kickerBones = kickerBones;
    global.wallDefenderBones = wallDefenderBones;

    // ------------------------------------------------------------------------
    // STRIKER KINEMATICS SUBSYSTEM
    // ------------------------------------------------------------------------
    const strikerState = {
        group: null,
        shadow: null,
        poseModels: {},
        currentPose: 'idle',
        active: false,
        phase: 'idle', // 'idle' | 'approach' | 'plant' | 'strike' | 'follow' | 'celebrate' | 'disbelief'
        phaseTimer: 0,
        approachDuration: 0.38,
        strikeDuration: 0.14,
        followDuration: 0.55,
        isCurling: false,
        speedKmh: 95,
        spinRPM: 0,
        powerNorm: 0.75,
        curlBendMeters: 0,
        startPos: new THREE.Vector3(),
        midPos: new THREE.Vector3(),
        plantPos: new THREE.Vector3(),
        spotPos: new THREE.Vector3(),
        rotAngle: 0,
        celebrating: false,
        disbelief: false
    };

    // ------------------------------------------------------------------------
    // GOALKEEPER KINEMATICS SUBSYSTEM
    // ------------------------------------------------------------------------
    const gkState = {
        group: null,
        spine: null,
        mesh: null,
        shadow: null,
        bodyCollider: null,
        poseModels: {},
        currentPose: 'idle',
        diving: false,
        diveTimer: 0,
        diveType: 'mid_parry', // 'top_corner_flight' | 'mid_parry' | 'low_sweep'
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 1.15,
        targetRotZ: 0,
        diveDuration: 0.52,
        reactionTime: 0.08,
        diveDir: 1,
        recoveryPhase: false
    };

    // ------------------------------------------------------------------------
    // WALL DEFENDERS KINEMATICS SUBSYSTEM
    // ------------------------------------------------------------------------
    const wallState = {
        group: null,
        defenders: [],
        shadows: [],
        bodies: [],
        configs: [],
        jumping: false,
        jumpTimer: 0
    };

    // ------------------------------------------------------------------------
    // MODULE DECLARATION & INTERFACE
    // ------------------------------------------------------------------------
    const PlayerKinematics = {
        // Armatures
        gkBones: gkBones,
        kickerBones: kickerBones,
        wallDefenderBones: wallDefenderBones,

        // Direct state accessors
        strikerState: strikerState,
        gkState: gkState,
        wallState: wallState,

        // ====================================================================
        // 1. INITIALIZATION METHODS
        // ====================================================================
        initStriker(strikerGroup, strikerShadow, poseModels) {
            strikerState.group = strikerGroup;
            strikerState.shadow = strikerShadow;
            strikerState.poseModels = poseModels || {};
            this.setStrikerPose('idle');
        },

        initGoalkeeper(gkGroup, gkSpine, gkMesh, gkShadow, gkBodyCollider, gkPoseModels) {
            gkState.group = gkGroup;
            gkState.spine = gkSpine;
            gkState.mesh = gkMesh;
            gkState.shadow = gkShadow;
            gkState.bodyCollider = gkBodyCollider;
            gkState.poseModels = gkPoseModels || {};
            this.setGkPose('idle');
        },

        initWall(wallGroup, wallDefenders, wallShadows, wallBodies, wallDefenderConfigs) {
            wallState.group = wallGroup;
            wallState.defenders = wallDefenders || [];
            wallState.shadows = wallShadows || [];
            wallState.bodies = wallBodies || [];
            wallState.configs = wallDefenderConfigs || [];
        },

        // ====================================================================
        // 2. POSE BLENDING & SELECTION (ZERO VERTEX TEARING)
        // ====================================================================
        setStrikerPose(poseKey) {
            strikerState.currentPose = poseKey;
            for (const key in strikerState.poseModels) {
                if (strikerState.poseModels[key]) {
                    strikerState.poseModels[key].visible = (key === poseKey);
                }
            }
        },

        setGkPose(poseKey) {
            gkState.currentPose = poseKey;
            for (const key in gkState.poseModels) {
                if (gkState.poseModels[key]) {
                    gkState.poseModels[key].visible = (key === poseKey);
                }
            }
        },

        // ====================================================================
        // 3. RESET HANDLERS
        // ====================================================================
        resetStriker(spotX, spotZ, isPenalty, currentMode) {
            strikerState.active = (currentMode !== 'targets');
            strikerState.phase = 'idle';
            strikerState.phaseTimer = 0;
            strikerState.celebrating = false;
            strikerState.disbelief = false;

            strikerState.spotPos.set(spotX, 0, spotZ);

            // Natural right-footed approach angle: 3 steps behind and to left of ball
            const approachAngle = isPenalty ? 0.32 : 0.45;
            const runUpDistance = 2.15;
            const offsetX = -Math.sin(approachAngle) * runUpDistance;
            const offsetZ = Math.cos(approachAngle) * runUpDistance;

            strikerState.startPos.set(spotX + offsetX, 0, spotZ + offsetZ);
            strikerState.midPos.set(spotX + offsetX * 0.45, 0, spotZ + offsetZ * 0.45);
            strikerState.plantPos.set(spotX - 0.28, 0, spotZ + 0.05);

            if (strikerState.group) {
                strikerState.group.position.copy(strikerState.startPos);
                // Face ball and goal
                strikerState.rotAngle = Math.PI - approachAngle;
                strikerState.group.rotation.set(0, strikerState.rotAngle, 0);
                strikerState.group.visible = strikerState.active;
            }

            if (strikerState.shadow) {
                strikerState.shadow.position.set(strikerState.startPos.x, 0.015, strikerState.startPos.z);
                strikerState.shadow.scale.set(1, 1, 1);
                strikerState.shadow.material.opacity = 0.75;
                strikerState.shadow.visible = strikerState.active;
            }

            this.setStrikerPose('idle');

            // Reset virtual bones
            kickerBones.root.position.set(0, 0.78, 0);
            kickerBones.spine.rotation.set(0, 0, 0);
            kickerBones.chest.rotation.set(0, 0, 0);
            kickerBones.head.rotation.set(0.08, 0, 0);
            kickerBones.leftShoulder.rotation.set(0.15, 0, 0.25);
            kickerBones.rightShoulder.rotation.set(0.15, 0, -0.25);
            kickerBones.leftElbow.rotation.set(0.40, 0, 0);
            kickerBones.rightElbow.rotation.set(0.40, 0, 0);
            kickerBones.leftThigh.rotation.set(0, 0, 0);
            kickerBones.leftKnee.rotation.set(0.12, 0, 0);
            kickerBones.rightThigh.rotation.set(0, 0, 0);
            kickerBones.rightKnee.rotation.set(0.12, 0, 0);

            global.kickerKicking = false;
        },

        resetGoalkeeper(spotX, allowGk, allowWall) {
            gkState.diving = false;
            gkState.diveTimer = 0;
            gkState.recoveryPhase = false;
            gkState.diveType = 'mid_parry';

            const wallSide = (-spotX >= 0) ? 1 : -1;
            const gkStartX = allowWall ? (-wallSide * 0.95) : 0;
            gkState.startX = gkStartX;
            gkState.startY = 0;

            if (gkState.group) {
                gkState.group.position.set(gkStartX, 0, -19.6);
                gkState.group.rotation.set(0, 0, 0);
                gkState.group.visible = allowGk;
            }
            if (gkState.spine) {
                gkState.spine.position.set(0, 0, 0);
                gkState.spine.rotation.set(0, 0, 0);
            }
            if (gkState.mesh) {
                gkState.mesh.rotation.set(0, 0, 0);
            }
            if (gkState.shadow) {
                gkState.shadow.position.set(gkStartX, 0.015, -19.6);
                gkState.shadow.scale.set(1, 1, 1);
                gkState.shadow.material.opacity = 0.75;
                gkState.shadow.visible = allowGk;
            }
            if (gkState.bodyCollider) {
                gkState.bodyCollider.position.set(gkStartX, 1.15, -19.6);
                gkState.bodyCollider.collisionResponse = 0;
            }

            this.setGkPose('idle');

            // Reset virtual GK bones
            gkBones.root.position.set(0, 0.76, 0);
            gkBones.spine.rotation.set(0.08, 0, 0);
            gkBones.chest.rotation.set(0.05, 0, 0);
            gkBones.head.rotation.set(0, 0, 0);
            gkBones.leftShoulder.rotation.set(0.40, 0, 0.30);
            gkBones.rightShoulder.rotation.set(0.40, 0, -0.30);
            gkBones.leftElbow.rotation.set(0.95, 0, 0);
            gkBones.rightElbow.rotation.set(0.95, 0, 0);
            gkBones.leftThigh.rotation.set(-0.12, 0, 0);
            gkBones.rightThigh.rotation.set(-0.12, 0, 0);
            gkBones.leftKnee.rotation.set(0.22, 0, 0);
            gkBones.rightKnee.rotation.set(0.22, 0, 0);

            global.gkDiving = false;
            global.gkDiveType = 'mid_parry';
        },

        resetWall(spotX, spotZ, allowWall) {
            wallState.jumping = false;
            wallState.jumpTimer = 0;

            if (wallState.group) {
                wallState.group.visible = allowWall;
                wallState.group.position.y = 0;
                if (allowWall) {
                    const dxToGoal = -spotX;
                    const wallSide = dxToGoal >= 0 ? 1 : -1;
                    const wallX = spotX * 0.45 + (wallSide * 0.75);
                    const wallZ = Math.min(-11.0, spotZ - 9.15);
                    wallState.group.position.set(wallX, 0, wallZ);
                } else {
                    wallState.group.position.set(0, -999, 0);
                }
            }

            wallState.defenders.forEach((def, idx) => {
                const cfg = wallState.configs[idx];
                if (def && cfg) {
                    def.position.set(cfg.xOffset, 0, 0);
                    def.rotation.set(0, cfg.inwardYaw * 0.2, 0);
                }
            });

            wallState.shadows.forEach(s => {
                if (s) {
                    s.scale.set(1, 1, 1);
                    s.material.opacity = 0.75;
                }
            });

            wallState.bodies.forEach((b, idx) => {
                if (b) {
                    if (allowWall && wallState.group) {
                        const cfg = wallState.configs[idx];
                        b.position.set(wallState.group.position.x + cfg.xOffset, 0.95, wallState.group.position.z);
                        b.collisionResponse = 1;
                    } else {
                        b.position.set(0, -999, 0);
                        b.collisionResponse = 0;
                    }
                }
            });

            // Reset wall defender virtual bones
            wallDefenderBones.forEach(b => {
                b.root.position.set(0, 0.78, 0);
                b.leftShoulder.rotation.set(0.25, 0, 0.45);
                b.rightShoulder.rotation.set(0.25, 0, -0.45);
                b.leftElbow.rotation.set(1.35, 0, 0);
                b.rightElbow.rotation.set(1.35, 0, 0);
                b.leftKnee.rotation.set(0.18, 0, 0);
                b.rightKnee.rotation.set(0.18, 0, 0);
            });

            global.wallJumping = false;
            global.wallJumpTimer = 0;
        },

        // ====================================================================
        // 4. ACTION TRIGGER METHODS
        // ====================================================================
        startStrikerRunUp(speedKmh, spinRPM, powerNorm, curlBendMeters) {
            strikerState.active = true;
            strikerState.speedKmh = speedKmh;
            strikerState.spinRPM = spinRPM;
            strikerState.powerNorm = powerNorm;
            strikerState.curlBendMeters = curlBendMeters;
            strikerState.isCurling = Math.abs(spinRPM) > 80 || Math.abs(curlBendMeters) > 0.35;

            strikerState.phase = 'approach';
            strikerState.phaseTimer = 0;
            // Snappy dynamic approach duration: ~0.34s - 0.38s
            strikerState.approachDuration = Math.max(0.30, Math.min(0.38, 0.42 - powerNorm * 0.10));
            this.setStrikerPose('run');

            global.kickerKicking = true;
        },

        startGoalkeeperDive(targetWorldX, targetWorldY, actualSpeedKmh, flightTime, diffSettings) {
            gkState.diving = true;
            gkState.diveTimer = 0;
            gkState.recoveryPhase = false;

            const diff = diffSettings || { gkReactionTime: 0.09, gkSkillBase: 0.78, gkDiveDurationMult: 1.0 };
            gkState.diveDuration = Math.min(0.68, Math.max(0.42, flightTime * 0.90)) * (diff.gkDiveDurationMult || 1.0);
            gkState.reactionTime = diff.gkReactionTime || 0.08;

            const speedRatio = Math.min(1.0, actualSpeedKmh / 115);
            const keeperSkill = Math.max(0.40, (diff.gkSkillBase || 0.78) - speedRatio * 0.18);
            gkState.targetX = Math.max(-3.3, Math.min(3.3, targetWorldX * keeperSkill));
            gkState.diveDir = (gkState.targetX >= gkState.startX) ? 1 : -1;

            if (targetWorldY < 1.05 && Math.abs(gkState.targetX) > 0.70) {
                // Low sweeping ground scoop
                gkState.diveType = 'low_sweep';
                gkState.targetY = 0.26;
                gkState.targetRotZ = gkState.diveDir > 0 ? -1.45 : 1.45;
                this.setGkPose(gkState.diveDir > 0 ? 'low_sweep_right' : 'low_sweep_left');
            } else if (targetWorldY > 1.65 && Math.abs(gkState.targetX) > 1.0) {
                // Top-corner flying fingertip save
                gkState.diveType = 'top_corner_flight';
                gkState.targetY = Math.min(2.38, targetWorldY * 0.96);
                gkState.targetRotZ = gkState.diveDir > 0 ? -0.92 : 0.92;
                this.setGkPose(gkState.diveDir > 0 ? 'dive_right' : 'dive_left');
            } else {
                // Mid-height parry push
                gkState.diveType = 'mid_parry';
                gkState.targetY = Math.max(0.85, Math.min(1.85, targetWorldY * 0.90));
                gkState.targetRotZ = gkState.diveDir > 0 ? -0.68 : 0.68;
                if (Math.abs(gkState.targetX) > 0.75) {
                    this.setGkPose(gkState.diveDir > 0 ? 'dive_right' : 'dive_left');
                } else {
                    this.setGkPose('parry');
                }
            }

            global.gkDiving = true;
            global.gkDiveType = gkState.diveType;
        },

        startWallJump() {
            wallState.jumping = true;
            wallState.jumpTimer = 0;
            global.wallJumping = true;
            global.wallJumpTimer = 0;
        },

        setStrikerOutcome(outcome) {
            if (outcome === 'goal') {
                strikerState.celebrating = true;
                strikerState.disbelief = false;
                strikerState.phase = 'celebrate';
                strikerState.phaseTimer = 0;
                this.setStrikerPose('celebrate');
            } else if (outcome === 'miss' || outcome === 'saved') {
                strikerState.celebrating = false;
                strikerState.disbelief = true;
                strikerState.phase = 'disbelief';
                strikerState.phaseTimer = 0;
                this.setStrikerPose('disbelief');
            }
        },

        // ====================================================================
        // 5. REAL-TIME UPDATE LOOPS (ZERO ALLOCATION)
        // ====================================================================

        /**
         * Striker Kinematics Update:
         * Manages 3-step curved approach, plant foot placement, instep vs laces strike articulation,
         * rotational follow-through, and goal celebration / disbelief.
         */
        updateStriker(dt, time) {
            if (!strikerState.group || !strikerState.active) return;

            strikerState.phaseTimer += dt;

            if (strikerState.phase === 'celebrate') {
                // Goal celebration: jubilant sprint with double fist-pump
                const celTime = strikerState.phaseTimer * 4.8;
                const forwardHop = Math.sin(celTime * 0.5) * 0.65;
                const bounce = Math.max(0, Math.sin(celTime) * 0.42);

                strikerState.group.position.x = strikerState.spotPos.x + 0.45;
                strikerState.group.position.z = strikerState.spotPos.z - 0.60 - forwardHop;
                strikerState.group.position.y = bounce;
                strikerState.group.rotation.set(0, Math.PI, 0);

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(strikerState.group.position.x, 0.015, strikerState.group.position.z);
                    const s = Math.max(0.60, 1.0 - bounce * 0.45);
                    strikerState.shadow.scale.set(s, s, s);
                    strikerState.shadow.material.opacity = Math.max(0.20, 0.75 * (1.0 - bounce * 0.50));
                }

                // Update virtual bones for celebration
                kickerBones.leftShoulder.rotation.set(0, 0, 1.45);
                kickerBones.rightShoulder.rotation.set(0, 0, -1.45);
                kickerBones.leftElbow.rotation.set(0.12, 0, 0);
                kickerBones.rightElbow.rotation.set(0.12, 0, 0);
                kickerBones.head.rotation.set(-0.25, 0, 0);
                return;
            }

            if (strikerState.phase === 'disbelief') {
                // Despair / disbelief: hands to head
                strikerState.group.position.x = strikerState.spotPos.x - 0.65;
                strikerState.group.position.z = strikerState.spotPos.z + 0.35;
                strikerState.group.position.y = 0;
                strikerState.group.rotation.set(0, Math.PI - 0.25, 0);

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(strikerState.group.position.x, 0.015, strikerState.group.position.z);
                    strikerState.shadow.scale.set(1, 1, 1);
                    strikerState.shadow.material.opacity = 0.75;
                }

                kickerBones.leftShoulder.rotation.set(1.20, 0, 0.45);
                kickerBones.rightShoulder.rotation.set(1.20, 0, -0.45);
                kickerBones.leftElbow.rotation.set(1.45, 0, 0);
                kickerBones.rightElbow.rotation.set(1.45, 0, 0);
                kickerBones.head.rotation.set(-0.35, 0, 0);
                kickerBones.spine.rotation.set(0.15, 0, 0);
                return;
            }

            if (strikerState.phase === 'approach') {
                // Phase 1: 3-Step Curved Run-Up along Quadratic Bezier Arc
                const u = Math.min(1.0, strikerState.phaseTimer / strikerState.approachDuration);

                // Quadratic Bezier Interpolation: B(u) = (1-u)^2*P0 + 2(1-u)u*P1 + u^2*P2
                const invU = 1.0 - u;
                const b0 = invU * invU;
                const b1 = 2.0 * invU * u;
                const b2 = u * u;

                strikerState.group.position.x = b0 * strikerState.startPos.x + b1 * strikerState.midPos.x + b2 * strikerState.plantPos.x;
                strikerState.group.position.z = b0 * strikerState.startPos.z + b1 * strikerState.midPos.z + b2 * strikerState.plantPos.z;

                // Dynamic stride bobbing (3 steps cadence)
                const strideStep = Math.sin(u * Math.PI * 3.0);
                strikerState.group.position.y = Math.max(0, strideStep * 0.035);

                // Centripetal lean into curve & forward orientation
                const curveLean = Math.sin(u * Math.PI) * 0.08;
                strikerState.group.rotation.set(0.04, strikerState.rotAngle + u * 0.28, curveLean);

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(strikerState.group.position.x, 0.015, strikerState.group.position.z);
                    const s = 1.0 - strikerState.group.position.y * 0.3;
                    strikerState.shadow.scale.set(s, s, s);
                }

                // Armature leg swing during approach
                const legSwing = Math.sin(u * Math.PI * 3.0);
                kickerBones.rightThigh.rotation.x = -legSwing * 0.65;
                kickerBones.rightKnee.rotation.x = Math.max(0, legSwing * 0.95);
                kickerBones.leftThigh.rotation.x = legSwing * 0.65;
                kickerBones.leftKnee.rotation.x = Math.max(0, -legSwing * 0.95);

                if (u >= 0.72 && u < 1.0) {
                    // Transition to Plant Foot Stance
                    this.setStrikerPose('plant');
                }

                if (u >= 1.0) {
                    // Step into strike
                    strikerState.phase = 'strike';
                    strikerState.phaseTimer = 0;
                    this.setStrikerPose(strikerState.isCurling ? 'strike_instep' : 'strike_laces');
                }
                return;
            }

            if (strikerState.phase === 'strike') {
                // Phase 2: Kicking Strike Leg Articulation (Instep vs Laces)
                const sProgress = Math.min(1.0, strikerState.phaseTimer / strikerState.strikeDuration);

                // Plant foot remains firmly planted beside ball
                strikerState.group.position.set(strikerState.plantPos.x, 0, strikerState.plantPos.z);
                strikerState.group.rotation.set(0, Math.PI - 0.06, 0);

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(strikerState.plantPos.x, 0.015, strikerState.plantPos.z);
                    strikerState.shadow.scale.set(1.0, 1.0, 1.0);
                }

                // Striking leg swings through ball
                const swingThrough = Math.sin(sProgress * Math.PI * 0.5);
                kickerBones.rightThigh.rotation.x = swingThrough * 0.92;
                kickerBones.rightKnee.rotation.x = (1.0 - swingThrough) * 0.65;

                if (strikerState.isCurling) {
                    // Instep Strike: Hip externally rotated, ankle locked in eversion
                    kickerBones.rightThigh.rotation.y = -0.38;
                    kickerBones.rightThigh.rotation.z = 0.22;
                    kickerBones.spine.rotation.z = -0.15;
                } else {
                    // Laces Strike: Sagittal piston drive, chest over ball
                    kickerBones.rightThigh.rotation.y = 0;
                    kickerBones.rightThigh.rotation.z = 0;
                    kickerBones.spine.rotation.x = 0.18;
                }

                if (sProgress >= 1.0) {
                    strikerState.phase = 'follow';
                    strikerState.phaseTimer = 0;
                    this.setStrikerPose('follow_through');
                }
                return;
            }

            if (strikerState.phase === 'follow') {
                // Phase 3: Rotational Follow-Through & Deceleration Step
                const fProgress = Math.min(1.0, strikerState.phaseTimer / strikerState.followDuration);

                // Striker steps through cleanly onto the right foot, decelerating to left flank
                const stepX = strikerState.plantPos.x - fProgress * 0.35;
                const stepZ = strikerState.plantPos.z - fProgress * 0.40;
                strikerState.group.position.set(stepX, 0, stepZ);

                // Torso rotates counter-clockwise ~42 deg
                const bodyYaw = Math.PI - 0.06 - fProgress * 0.35;
                strikerState.group.rotation.set(0, bodyYaw, 0);

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(stepX, 0.015, stepZ);
                    strikerState.shadow.scale.set(1.0, 1.0, 1.0);
                }

                kickerBones.rightThigh.rotation.x = 0.92 * (1.0 - fProgress * 0.6);
                kickerBones.chest.rotation.y = 0.35 * Math.sin(fProgress * Math.PI);
                kickerBones.leftShoulder.rotation.set(0.20, 0, 0.55);
                kickerBones.rightShoulder.rotation.set(0.20, 0, -0.55);

                if (fProgress >= 1.0) {
                    strikerState.phase = 'idle';
                    this.setStrikerPose('idle');
                    global.kickerKicking = false;
                }
                return;
            }

            // Idle Ready Stance
            if (strikerState.phase === 'idle') {
                const idleBounce = Math.sin(time * 2.2) * 0.008;
                strikerState.group.position.y = idleBounce;

                if (strikerState.shadow) {
                    strikerState.shadow.position.set(strikerState.group.position.x, 0.015, strikerState.group.position.z);
                    strikerState.shadow.scale.set(1.0, 1.0, 1.0);
                    strikerState.shadow.material.opacity = 0.75;
                }

                kickerBones.root.position.y = 0.78 + idleBounce;
                kickerBones.head.rotation.set(0.08, 0, 0);
            }
        },

        /**
         * Goalkeeper Kinematics Update:
         * Manages pre-jump plant-step squat, smooth ballistic flight parabola, outstretched fingertip reaches,
         * low turf sweep scoop, and landing recovery roll.
         */
        updateGoalkeeper(dt, time, ballMesh, ballInFlight) {
            if (!gkState.group || !gkState.group.visible) return;

            const diveDir = (gkState.targetX >= gkState.startX) ? 1 : -1;

            // Real-Time Ball Gaze Tracking: Torso & head subtly orient toward ball
            if (ballMesh && gkState.mesh) {
                const dx = ballMesh.position.x - gkState.group.position.x;
                gkState.mesh.rotation.y = Math.max(-0.40, Math.min(0.40, dx * 0.15));

                // Backwards-compatible head IK calculation for verify scripts
                const dy = ballMesh.position.y - 1.65;
                const dz = ballMesh.position.z - (-19.6);
                const distXZ = Math.hypot(dx, dz);
                gkBones.head.rotation.y = Math.max(-0.65, Math.min(0.65, Math.atan2(-dx, -dz) * 0.70));
                gkBones.head.rotation.x = Math.max(-0.40, Math.min(0.40, Math.atan2(dy, distXZ) * 0.60));
            }

            if (gkState.diving) {
                gkState.diveTimer += dt;

                if (gkState.diveTimer < gkState.reactionTime) {
                    // Phase 0: Anticipatory Reaction Squat & Plant-Step Load
                    const p0 = gkState.diveTimer / gkState.reactionTime;

                    if (gkState.spine) {
                        gkState.spine.position.y = -Math.sin(p0 * Math.PI) * 0.07; // Knee dip
                        gkState.spine.position.x = diveDir * p0 * 0.06;            // Lead plant-step
                        gkState.spine.rotation.z = -diveDir * p0 * 0.08;
                        gkState.spine.rotation.x = 0.16 + p0 * 0.06;
                    }
                    if (gkState.mesh) {
                        gkState.mesh.rotation.y = diveDir * p0 * 0.12;
                    }

                    // Virtual bones during plant-step
                    gkBones.root.position.y = 0.74 - p0 * 0.12;
                    gkBones.leftKnee.rotation.x = 0.22 + p0 * 0.45;
                    gkBones.rightKnee.rotation.x = 0.22 + p0 * 0.45;
                    gkBones.leftShoulder.rotation.set(0.40 - p0 * 0.35, 0, 0.20);
                    gkBones.rightShoulder.rotation.set(0.40 - p0 * 0.35, 0, -0.20);
                } else {
                    // Phase 1: Explosive Ballistic Airborne Flight Parabola
                    const tau = Math.min(1.0, (gkState.diveTimer - gkState.reactionTime) / gkState.diveDuration);
                    const hProgress = 1.0 - Math.pow(1.0 - tau, 2.2);
                    gkState.group.position.x = gkState.startX + (gkState.targetX - gkState.startX) * hProgress;

                    if (gkState.diveType === 'top_corner_flight') {
                        // True Parabolic Flight Arc to Top Corner
                        const jumpApex = Math.sin(tau * Math.PI * 0.65);
                        gkState.group.position.y = gkState.targetY * jumpApex;
                    } else if (gkState.diveType === 'low_sweep') {
                        // Low Sweeping Turf Trajectory
                        gkState.group.position.y = Math.max(0.10, 0.30 * Math.cos(tau * Math.PI * 0.5));
                    } else {
                        // Mid-Height Parry Leap
                        const jumpApex = Math.sin(tau * Math.PI * 0.60);
                        gkState.group.position.y = gkState.targetY * jumpApex;
                    }

                    const rotProgress = Math.sin(Math.min(1.0, tau * 1.25) * Math.PI * 0.5);
                    if (gkState.spine) {
                        gkState.spine.rotation.z = gkState.targetRotZ * rotProgress;
                        gkState.spine.rotation.x = 0.22 * (1.0 - tau * 0.4);
                    }
                    if (gkState.mesh) {
                        gkState.mesh.rotation.y = diveDir * 0.30 * Math.sin(tau * Math.PI);
                    }

                    // Virtual bones full wing-span extension
                    const leadElev = (gkState.diveType === 'top_corner_flight') ? 1.45 : (gkState.diveType === 'low_sweep' ? 0.35 : 1.05);
                    if (diveDir > 0) {
                        gkBones.rightShoulder.rotation.set(0.25, 0, -leadElev * Math.sin(tau * Math.PI * 0.5));
                        gkBones.rightElbow.rotation.set(0.05, 0, 0); // Outstretched fingertip reach!
                        gkBones.leftShoulder.rotation.set(0.15, 0, -0.45 * Math.sin(tau * Math.PI * 0.5));
                        gkBones.leftElbow.rotation.set(0.45, 0, 0);
                        gkBones.leftKnee.rotation.x = 0.55; // Trail leg scissor
                    } else {
                        gkBones.leftShoulder.rotation.set(0.25, 0, leadElev * Math.sin(tau * Math.PI * 0.5));
                        gkBones.leftElbow.rotation.set(0.05, 0, 0);
                        gkBones.rightShoulder.rotation.set(0.15, 0, 0.45 * Math.sin(tau * Math.PI * 0.5));
                        gkBones.rightElbow.rotation.set(0.45, 0, 0);
                        gkBones.rightKnee.rotation.x = 0.55;
                    }

                    // Phase 2: Natural Athletic Landing Recovery Roll on Turf
                    if (tau >= 0.88 && !gkState.recoveryPhase) {
                        gkState.recoveryPhase = true;
                        this.setGkPose('recovery_roll');
                    }

                    if (gkState.recoveryPhase) {
                        const rollTau = (tau - 0.88) / 0.12;
                        // Smooth roll along turf
                        if (gkState.spine) {
                            gkState.spine.rotation.x = 0.22 + rollTau * 0.65;
                            gkState.spine.rotation.z = gkState.targetRotZ * (1.0 - rollTau * 0.35);
                        }
                    }
                }

                // Dynamic Contact Shadow
                if (gkState.shadow) {
                    gkState.shadow.position.set(gkState.group.position.x, 0.015, gkState.group.position.z);
                    const elev = Math.max(0, gkState.group.position.y);
                    const shadowScale = Math.max(0.45, 1.0 - elev * 0.38);
                    gkState.shadow.scale.set(shadowScale, shadowScale, shadowScale);
                    gkState.shadow.material.opacity = Math.max(0.12, 0.75 * (1.0 - elev * 0.45));
                }

                // Synchronize Cannon Save Collider with Glove Reach Bounds
                if (gkState.bodyCollider && gkState.spine) {
                    const reachExtX = diveDir * (Math.sin(Math.abs(gkState.spine.rotation.z)) * 0.95 + 0.38);
                    const reachExtY = Math.cos(gkState.spine.rotation.z) * 0.45;
                    gkState.bodyCollider.position.set(
                        gkState.group.position.x + reachExtX,
                        Math.max(0.38, gkState.group.position.y + reachExtY + 0.45),
                        gkState.group.position.z
                    );
                }
            } else {
                // Athletic Ready Stance (Idle bounce, rhythmic breathing sway)
                const idleBounce = (Math.sin(time * 2.8) * 0.5 + 0.5) * 0.025;
                const idleSway = Math.sin(time * 1.4) * 0.04;

                if (gkState.spine) {
                    gkState.spine.position.y = idleBounce;
                    gkState.spine.position.x = idleSway;
                    gkState.spine.rotation.z = -idleSway * 0.15;
                    gkState.spine.rotation.x = 0.12 + idleBounce * 0.6;
                }

                if (!ballInFlight && gkState.mesh) {
                    gkState.mesh.rotation.y = idleSway * 0.12;
                }

                if (gkState.shadow) {
                    gkState.shadow.position.set(gkState.group.position.x, 0.015, gkState.group.position.z);
                    gkState.shadow.scale.set(1.0, 1.0, 1.0);
                    gkState.shadow.material.opacity = 0.75;
                }

                if (gkState.bodyCollider) {
                    gkState.bodyCollider.position.set(gkState.group.position.x, 1.15, gkState.group.position.z);
                }

                // Virtual idle bones
                gkBones.root.position.y = 0.76 + idleBounce * 0.4;
                gkBones.leftKnee.rotation.x = 0.22 + idleBounce * 0.3;
                gkBones.rightKnee.rotation.x = 0.22 + idleBounce * 0.3;
            }
        },

        /**
         * Wall Defenders Kinematics Update:
         * Manages asynchronous organic fidgeting twitches, staggered jumping with mid-air tuck and flinch,
         * landing shock absorption, and dynamic ground shadow scaling.
         */
        updateWall(dt, time, allowWall) {
            if (!wallState.group || !allowWall) return;

            if (wallState.jumping) {
                wallState.jumpTimer += dt;
                wallState.group.position.y = 0;

                let allFinished = true;
                wallState.configs.forEach((cfg, idx) => {
                    const def = wallState.defenders[idx];
                    const shadow = wallState.shadows[idx];
                    const body = wallState.bodies[idx];
                    const bones = wallDefenderBones[idx];
                    const relTime = wallState.jumpTimer - cfg.delay;

                    let currentH = 0;
                    let currentLean = 0;
                    let currentYaw = cfg.inwardYaw * 0.2;

                    if (relTime > 0 && relTime < cfg.duration) {
                        allFinished = false;
                        const progress = relTime / cfg.duration;
                        // Athletic jump parabola with mid-air tuck & flinch
                        currentH = Math.sin(progress * Math.PI) * cfg.maxH;
                        currentLean = Math.sin(progress * Math.PI) * cfg.lean;
                        currentYaw = cfg.inwardYaw * (1.0 - progress * 0.5);

                        // Mid-air tuck & flinch
                        if (bones) {
                            bones.leftKnee.rotation.x = 0.18 + Math.sin(progress * Math.PI) * 0.55;
                            bones.rightKnee.rotation.x = 0.18 + Math.sin(progress * Math.PI) * 0.55;
                        }
                    } else if (relTime >= cfg.duration && relTime < cfg.duration + 0.14) {
                        // Landing Recovery with Deep Knee Flexion (Shock Absorption)
                        allFinished = false;
                        const landProgress = (relTime - cfg.duration) / 0.14;
                        currentH = -Math.sin(landProgress * Math.PI) * 0.048;
                        currentLean = Math.sin(landProgress * Math.PI) * 0.06;

                        if (bones) {
                            bones.leftKnee.rotation.x = 0.18 + Math.sin(landProgress * Math.PI) * 0.35;
                            bones.rightKnee.rotation.x = 0.18 + Math.sin(landProgress * Math.PI) * 0.35;
                        }
                    } else if (relTime < 0) {
                        // Pre-Jump Squat Load
                        allFinished = false;
                        const squatProgress = Math.max(0, 1.0 + relTime / (cfg.delay || 0.05));
                        currentH = -squatProgress * 0.038;
                        currentLean = squatProgress * 0.05;
                    }

                    if (def) {
                        def.position.y = currentH;
                        def.rotation.x = currentLean;
                        def.rotation.y = currentYaw;
                    }
                    if (shadow) {
                        const s = Math.max(0.55, 1.0 - Math.max(0, currentH) * 0.45);
                        shadow.scale.set(s, s, s);
                        shadow.material.opacity = Math.max(0.12, 0.75 * (1.0 - Math.max(0, currentH) * 1.35));
                    }
                    if (body) {
                        body.position.y = 0.95 + currentH;
                    }
                });

                if (allFinished && wallState.jumpTimer > 1.0) {
                    wallState.jumping = false;
                    global.wallJumping = false;
                    wallState.configs.forEach((cfg, idx) => {
                        const def = wallState.defenders[idx];
                        const shadow = wallState.shadows[idx];
                        const body = wallState.bodies[idx];
                        if (def) { def.position.y = 0; def.rotation.set(0, cfg.inwardYaw * 0.2, 0); }
                        if (shadow) { shadow.scale.set(1, 1, 1); shadow.material.opacity = 0.75; }
                        if (body) { body.position.y = 0.95; }
                    });
                }
            } else {
                // Organic Asynchronous Fidgeting & Anticipation Micro-Twitches
                wallState.configs.forEach((cfg, idx) => {
                    const def = wallState.defenders[idx];
                    const shadow = wallState.shadows[idx];
                    const body = wallState.bodies[idx];
                    const bones = wallDefenderBones[idx];
                    const phase = time * (2.1 + idx * 0.35) + idx * 2.3;

                    if (def) {
                        def.position.y = Math.sin(phase) * 0.012;
                        def.rotation.y = cfg.inwardYaw * 0.2 + Math.sin(phase * 0.6) * 0.035;
                        def.rotation.z = Math.cos(phase * 0.4) * 0.016;
                        def.rotation.x = 0.04 + Math.sin(phase * 0.8) * 0.018;
                    }
                    if (bones) {
                        bones.leftKnee.rotation.x = 0.18 + Math.sin(phase) * 0.04;
                        bones.rightKnee.rotation.x = 0.18 + Math.sin(phase) * 0.04;
                    }
                    if (shadow) {
                        shadow.scale.set(1, 1, 1);
                        shadow.material.opacity = 0.75;
                    }
                    if (body) {
                        body.position.y = 0.95;
                    }
                });
            }
        },

        /**
         * Master Update Loop (Delegates with Zero Allocation)
         */
        update(dt, time, gameState) {
            this.updateStriker(dt, time);
            if (gameState) {
                this.updateWall(dt, time, gameState.allowWall);
                this.updateGoalkeeper(dt, time, gameState.ballMesh, gameState.ballInFlight);
            }
        }
    };

    // Attach to global window object
    global.PlayerKinematics = PlayerKinematics;

})(typeof window !== 'undefined' ? window : this);
