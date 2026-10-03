// ============================================================================
// 11. INTUITIVE DIRECTIONAL SHOOTING ENGINE & SCREEN BOUNDS PROJECTION
// ============================================================================
window.getGoalScreenProjected = function getGoalScreenProjected() {
    const pCenter = new THREE.Vector3(0, 1.22, -20.0).project(camera);
    const pTopLeft = new THREE.Vector3(-3.66, 2.44, -20.0).project(camera);
    const pTopRight = new THREE.Vector3(3.66, 2.44, -20.0).project(camera);
    const pBottomLeft = new THREE.Vector3(-3.66, 0.0, -20.0).project(camera);
    const pBottomRight = new THREE.Vector3(3.66, 0.0, -20.0).project(camera);

    const toScreen = (v) => ({
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight
    });

    const sCenter = toScreen(pCenter);
    const sTopL = toScreen(pTopLeft);
    const sTopR = toScreen(pTopRight);
    const sBotL = toScreen(pBottomLeft);
    const sBotR = toScreen(pBottomRight);

    return {
        centerX: sCenter.x,
        centerY: sCenter.y,
        crossbarY: (sTopL.y + sTopR.y) * 0.5,
        groundY: (sBotL.y + sBotR.y) * 0.5,
        leftX: sTopL.x,
        rightX: sTopR.x,
        goalWidthPx: Math.abs(sTopR.x - sTopL.x),
        goalHeightPx: Math.abs((sBotL.y + sBotR.y) * 0.5 - (sTopL.y + sTopR.y) * 0.5)
    };
}

window.executeShot = function(targetScreenX, targetScreenY, speedKmh = 95, spinRPM = 0, powerNorm = 0.7, curlBendMeters = 0) {
    if (!isPlaying || !isAiming) return;
    isAiming = false;
    ballInFlight = true;

    const bounds = getGoalScreenProjected();
    const goalPlaneZ = -20.0;

    // Convert screen coordinates to world coordinates on the goal plane
    const normX = (targetScreenX - bounds.centerX) / (bounds.goalWidthPx * 0.5);
    const normY = (bounds.groundY - targetScreenY) / bounds.goalHeightPx;

    const targetWorldX = normX * 3.66;
    const targetWorldY = Math.max(0.25, normY * 2.44);

    // Forward velocity: -24 to -36 m/s (~88 to 130 km/h)
    const vz = -Math.max(24, speedKmh / 3.6);
    const distZ = Math.abs(goalPlaneZ - ballBody.position.z);
    const flightTime = distZ / Math.abs(vz);

    // If curlBendMeters was not passed directly, infer from spinRPM
    if (curlBendMeters === 0 && Math.abs(spinRPM) > 30) {
        curlBendMeters = (spinRPM / 380);
    }

    // Scale curl bend with distance to goal: ~1.2m at penalty spot, up to ~2.6m at 25m free kicks
    const maxCurlForDist = Math.max(1.2, Math.min(2.8, distZ * 0.11));
    if (Math.abs(curlBendMeters) > maxCurlForDist) {
        curlBendMeters = Math.sign(curlBendMeters) * maxCurlForDist;
    }

    // Dynamic lateral Magnus acceleration required to achieve organic aerodynamic curl:
    const ax = flightTime > 0.05 ? (1.5 * curlBendMeters) / (flightTime * flightTime) : 0;
    currentShotMagnusAx = ax;

    // Natural launch velocity with balanced lateral offset: ball leaves boot smoothly and curves visibly into target
    const vx = (targetWorldX - ballBody.position.x - 0.5 * curlBendMeters) / flightTime;

    // Exact gravity compensation for realistic buoyant lift (no drooping)
    const gravityComp = 0.5 * 9.81 * flightTime * flightTime;
    const vy = (targetWorldY - ballBody.position.y + gravityComp) / flightTime;

    ballBody.velocity.set(vx, vy, vz);

    // Curvature Deflection (Magnus Spin)
    const omegaY = (spinRPM * Math.PI * 2) / 60;
    spinVector.set(0, omegaY, 0);

    // Knuckleball & Trajectory Classification
    const isKnuckle = Math.abs(spinRPM) < 80 && Math.abs(vz) > 28;
    let style = 'Direct Strike';
    if (isKnuckle) style = 'Laser Knuckleball';
    else if (spinRPM > 120) style = 'Curling Inswing';
    else if (spinRPM < -120) style = 'Curling Outswing';

    // Telemetry Update
    const actualSpeedKmh = Math.round(Math.abs(vz) * 3.6);
    maxSpeedRecord = Math.max(maxSpeedRecord, actualSpeedKmh);
    maxSpinRecord = Math.max(maxSpinRecord, Math.round(Math.abs(spinRPM)));

    document.getElementById('stat-speed').innerText = actualSpeedKmh + ' KM/H';
    document.getElementById('stat-spin').innerText = Math.round(Math.abs(spinRPM)) + ' RPM';
    document.getElementById('stat-style').innerText = style;
    document.getElementById('telemetry').classList.add('visible');

    sfx.playKick(powerNorm);

    // Camera screen shake on powerful shots (FIFA-style impact)
    if (powerNorm > 0.75) {
        const shakeIntensity = (powerNorm - 0.75) * 0.08;
        const origX = camera.position.x;
        const origY = camera.position.y;
        let shakeTime = 0;
        const shakeInterval = setInterval(() => {
            shakeTime += 16;
            if (shakeTime > 200) {
                camera.position.x = origX;
                camera.position.y = origY;
                clearInterval(shakeInterval);
                return;
            }
            camera.position.x = origX + (Math.random() - 0.5) * shakeIntensity;
            camera.position.y = origY + (Math.random() - 0.5) * shakeIntensity;
        }, 16);
    }

    // Trigger Striker Run-Up, AI Goalkeeper Dive & Wall Jump via PlayerKinematics
    const isPenalty = (currentGameMode === 'duel' && currentRound === 1) || 
                      (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
    const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel') || 
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    const diff = (typeof difficultySettings !== 'undefined' && difficultySettings[currentDifficulty]) 
        ? difficultySettings[currentDifficulty] 
        : { gkReactionTime: 0.09, gkSkillBase: 0.78, gkDiveDurationMult: 1.0 };

    if (window.PlayerKinematics) {
        PlayerKinematics.startStrikerRunUp(actualSpeedKmh, spinRPM, powerNorm, curlBendMeters);
        if (allowGk) {
            PlayerKinematics.startGoalkeeperDive(targetWorldX, targetWorldY, actualSpeedKmh, flightTime, diff);
            gkDiving = true;
            gkDiveTimer = 0;
            gkStartX = gkGroup.position.x;
            gkStartY = gkGroup.position.y;
            gkDiveDuration = PlayerKinematics.gkState.diveDuration;
            gkReactionTime = PlayerKinematics.gkState.reactionTime;
            gkTargetX = PlayerKinematics.gkState.targetX;
            gkTargetY = PlayerKinematics.gkState.targetY;
            gkTargetRotZ = PlayerKinematics.gkState.targetRotZ;
            gkDiveType = PlayerKinematics.gkState.diveType;
        }
        if (allowWall) {
            PlayerKinematics.startWallJump();
            wallJumping = true;
            wallJumpTimer = 0;
        }
    } else {
        if (allowWall) {
            wallJumping = true;
            wallJumpTimer = 0;
        }
        if (allowGk) {
            gkDiving = true;
            gkDiveTimer = 0;
            gkStartX = gkGroup.position.x;
            gkStartY = gkGroup.position.y;
            gkDiveDuration = Math.min(0.68, Math.max(0.42, flightTime * 0.90)) * (diff.gkDiveDurationMult || 1.0);
            gkReactionTime = diff.gkReactionTime || 0.09;
            const speedRatio = Math.min(1.0, actualSpeedKmh / 115);
            const keeperSkill = Math.max(0.40, (diff.gkSkillBase || 0.78) - speedRatio * 0.18);
            gkTargetX = Math.max(-3.3, Math.min(3.3, targetWorldX * keeperSkill));
            const diveDir = (gkTargetX >= gkGroup.position.x) ? 1 : -1;

            if (targetWorldY < 0.95 && Math.abs(gkTargetX) > 1.2) {
                gkDiveType = 'low_sweep';
                gkTargetY = 0.28;
                gkTargetRotZ = diveDir > 0 ? -1.42 : 1.42;
                setGkPose(diveDir > 0 ? 'low_sweep_right' : 'low_sweep_left');
            } else if (targetWorldY > 1.65 && Math.abs(gkTargetX) > 1.1) {
                gkDiveType = 'top_corner_flight';
                gkTargetY = Math.min(2.35, targetWorldY * 0.96);
                gkTargetRotZ = diveDir > 0 ? -0.92 : 0.92;
                setGkPose(diveDir > 0 ? 'dive_right' : 'dive_left');
            } else {
                gkDiveType = 'mid_parry';
                gkTargetY = Math.max(0.85, Math.min(1.85, targetWorldY * 0.90));
                gkTargetRotZ = diveDir > 0 ? -0.65 : 0.65;
                if (Math.abs(gkTargetX) > 0.8) {
                    setGkPose(diveDir > 0 ? 'dive_right' : 'dive_left');
                } else {
                    setGkPose('parry');
                }
            }
        }
    }

    // Safety timeout for round resolution
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    shotSafetyTimer = setTimeout(() => {
        if (ballInFlight && !shotComplete && isPlaying) {
            if (currentGameMode === 'duel' || currentGameMode === 'practice') {
                finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
            } else {
                finishShot('complete');
                setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
            }
        }
    }, 8000);
};

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying) return;
    if (e.target && e.target.closest && e.target.closest('button, #next-round-btn, #next-shot-btn, #practice-toolbar')) {
        return;
    }
    if (shotComplete) {
        if (currentGameMode === 'practice') {
            resetBall();
        } else {
            triggerNextShot();
        }
        return;
    }
    if (!isAiming) return;
    sfx.init();
    swipeSamples = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
});

window.addEventListener('pointermove', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length === 0) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
});

window.addEventListener('pointerup', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length === 0) {
        swipeSamples = [];
        return;
    }
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
    if (swipeSamples.length < 2) {
        swipeSamples = [];
        return;
    }

    const first = swipeSamples[0];
    const last = swipeSamples[swipeSamples.length - 1];
    const totalDx = last.x - first.x;
    const totalDy = last.y - first.y;

    // Minimum upward gesture: at least 15px upward
    if (totalDy < -15) {
        const dt = Math.max(0.04, (last.time - first.time) / 1000);
        const strokeSpeed = Math.hypot(totalDx, totalDy) / dt;

        // Calculate maximum lateral curvature/deflection from chord
        let maxDeflection = 0;
        const chordLen = Math.hypot(totalDx, totalDy);
        if (chordLen > 10) {
            for (let i = 1; i < swipeSamples.length - 1; i++) {
                const s = swipeSamples[i];
                const defl = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / chordLen;
                if (Math.abs(defl) > Math.abs(maxDeflection)) {
                    maxDeflection = defl;
                }
            }
        }

        // Snappy, buoyant power response (lighter ball feel)
        const powerNorm = Math.min(1.0, Math.max(0.48, strokeSpeed / 950));
        const speedKmh = Math.round(88 + powerNorm * 40); // 88 to 128 km/h

        // Natural Aerodynamic Curl Calculation:
        // Bowing right (positive deflection) curves right (+X bend, Inswing)
        // Bowing left (negative deflection) curves left (-X bend, Outswing)
        let curlBendMeters = 0;
        let spinRPM = 0;
        const clampedDefl = Math.max(-120, Math.min(120, maxDeflection));

        if (Math.abs(clampedDefl) > 10) {
            const sign = clampedDefl > 0 ? 1 : -1;
            const normDefl = (Math.abs(clampedDefl) - 10) / 65.0;
            const bendMag = Math.min(2.8, normDefl * 1.85 + Math.pow(normDefl, 1.35) * 0.55);
            // Sign directly matches swipe arc direction: positive curves right (+X), negative curves left (-X)
            curlBendMeters = sign * bendMag;
            spinRPM = Math.round(curlBendMeters * 420); // -1100 to +1100 RPM
        }

        const bounds = getGoalScreenProjected();
        let targetScreenX, targetScreenY;

        if (last.y <= bounds.groundY + 30) {
            // Full swipe directly onto or above the goal
            targetScreenX = last.x;
            targetScreenY = last.y;
        } else {
            // Quick upward flick: project ray to goal height with buoyant lift
            const elevationNorm = Math.min(1.18, Math.max(0.26, strokeSpeed / 900));
            targetScreenY = bounds.groundY - elevationNorm * bounds.goalHeightPx;
            const t = (targetScreenY - first.y) / totalDy;
            targetScreenX = first.x + t * totalDx;
        }

        window.executeShot(targetScreenX, targetScreenY, speedKmh, spinRPM, powerNorm, curlBendMeters);
    }
    swipeSamples = [];
});

// Direct Event Binding for Prominent Next Shot Buttons
const bindNextShotButtons = () => {
    let lastHandledTime = 0;
    const handleNext = (e) => {
        const now = performance.now();
        if (now - lastHandledTime < 500) return;
        lastHandledTime = now;
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        triggerNextShot();
    };
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.onclick = handleNext;
    }
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) {
        topNextBtn.onclick = handleNext;
    }
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindNextShotButtons);
} else {
    bindNextShotButtons();
}

