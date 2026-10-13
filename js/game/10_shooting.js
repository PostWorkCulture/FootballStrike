// ============================================================================
// 11. INTUITIVE DIRECTIONAL SHOOTING, SWIPE CURVE CANVAS & KEEPER REFLEX ENGINE
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
};

// ----------------------------------------------------------------------------
// 2D INTERACTIVE SWIPE CURVE TRAIL RENDERER (<canvas id="swipe-trail">)
// ----------------------------------------------------------------------------
let swipeCanvas = null;
let swipeCtx = null;
let swipeFadeAlpha = 0;
let lastCompletedSwipe = [];
let lastSwipeMeta = { speedKmh: 0, spinRPM: 0, label: '' };

function ensureSwipeCanvas() {
    if (!swipeCanvas) {
        swipeCanvas = document.getElementById('swipe-trail');
        if (swipeCanvas && swipeCanvas.getContext) {
            swipeCtx = swipeCanvas.getContext('2d');
            resizeSwipeCanvas();
        }
    }
    return swipeCtx;
}

function resizeSwipeCanvas() {
    if (!swipeCanvas || !swipeCanvas.getContext) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    swipeCanvas.width = window.innerWidth * dpr;
    swipeCanvas.height = window.innerHeight * dpr;
    if (swipeCtx) swipeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeSwipeCanvas);

function analyzeSwipeCurve(samples) {
    if (!samples || samples.length < 2) {
        return { speedKmh: 95, spinRPM: 0, curlBendMeters: 0, powerNorm: 0.65, label: 'DIRECT' };
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const totalDx = last.x - first.x;
    const totalDy = last.y - first.y;
    const dt = Math.max(0.04, (last.time - first.time) / 1000);
    const strokeSpeed = Math.hypot(totalDx, totalDy) / dt;

    let maxDeflection = 0;
    const chordLen = Math.hypot(totalDx, totalDy);
    if (chordLen > 10) {
        for (let i = 1; i < samples.length - 1; i++) {
            const s = samples[i];
            const defl = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / chordLen;
            if (Math.abs(defl) > Math.abs(maxDeflection)) {
                maxDeflection = defl;
            }
        }
    }

    const fireBoost = (typeof isOnFire !== 'undefined' && isOnFire) ? 1.06 : 1.0;
    const powerNorm = Math.min(1.0, Math.max(0.48, (strokeSpeed / 950) * fireBoost));
    const speedKmh = Math.round((88 + powerNorm * 40) * fireBoost);

    let curlBendMeters = 0;
    let spinRPM = 0;
    const clampedDefl = Math.max(-120, Math.min(120, maxDeflection));
    if (Math.abs(clampedDefl) > 10) {
        const sign = clampedDefl > 0 ? 1 : -1;
        const normDefl = (Math.abs(clampedDefl) - 10) / 65.0;
        const bendMag = Math.min(2.8, normDefl * 1.85 + Math.pow(normDefl, 1.35) * 0.55);
        curlBendMeters = sign * bendMag;
        spinRPM = Math.round(curlBendMeters * 420);
    }

    let label = 'LASER DRIVE';
    if (typeof isOnFire !== 'undefined' && isOnFire) label = '🔥 FIREBALL';
    else if (spinRPM > 260) label = 'CURL INSWING ↻';
    else if (spinRPM < -260) label = 'TRIVELA BEND ↺';
    else if (Math.abs(spinRPM) < 80 && speedKmh >= 108) label = 'KNUCKLEBALL';

    return { speedKmh, spinRPM, curlBendMeters, powerNorm, label };
}

window.renderSwipeOverlay = function(dt) {
    const ctx = ensureSwipeCanvas();
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const activePts = (swipeSamples && swipeSamples.length >= 2) ? swipeSamples : null;
    if (!activePts && swipeFadeAlpha <= 0.01) return;

    const pts = activePts || lastCompletedSwipe;
    if (!pts || pts.length < 2) return;

    const alpha = activePts ? 1.0 : swipeFadeAlpha;
    if (!activePts) {
        swipeFadeAlpha = Math.max(0, swipeFadeAlpha - dt * 2.4);
    }

    const meta = activePts ? analyzeSwipeCurve(pts) : lastSwipeMeta;
    const isFire = (typeof isOnFire !== 'undefined' && isOnFire);
    const hasCurl = Math.abs(meta.spinRPM) > 150;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw tapered segmented neon ribbon along swipe points
    for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const t = i / (pts.length - 1);
        const width = 3 + t * 11;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);

        if (isFire) {
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * (0.25 + t * 0.7)})`;
            ctx.shadowColor = 'rgba(249, 115, 22, 0.9)';
        } else if (hasCurl) {
            ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * (0.25 + t * 0.7)})`;
            ctx.shadowColor = 'rgba(16, 185, 129, 0.85)';
        } else {
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * (0.25 + t * 0.7)})`;
            ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
        }
        ctx.shadowBlur = 16;
        ctx.lineWidth = width;
        ctx.stroke();

        // Bright white core filament
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * (0.35 + t * 0.6)})`;
        ctx.lineWidth = Math.max(1.5, width * 0.36);
        ctx.stroke();
    }

    // Draw tip reticle & live shot telemetry pill at the pointer tip
    const tip = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = isFire ? `rgba(249, 115, 22, ${alpha * 0.9})` : `rgba(56, 189, 248, ${alpha * 0.9})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.stroke();

    if (pts[0].y - tip.y > 18) {
        const pillText = `${meta.label} • ${meta.speedKmh} KM/H`;
        ctx.font = '800 12px system-ui, -apple-system, sans-serif';
        const tw = ctx.measureText(pillText).width + 20;
        const px = Math.max(12, Math.min(window.innerWidth - tw - 12, tip.x - tw * 0.5));
        const py = Math.max(24, tip.y - 38);

        ctx.fillStyle = `rgba(9, 13, 22, ${alpha * 0.88})`;
        ctx.strokeStyle = isFire ? `rgba(250, 204, 21, ${alpha * 0.8})` : `rgba(56, 189, 248, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(px, py, tw, 24, 8);
        } else {
            ctx.rect(px, py, tw, 24);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pillText, px + tw * 0.5, py + 12);
    }

    ctx.restore();
};

const shotTargetScratch = { x: 0, y: 0, z: 0 };
let lastShotRecord = null;

window.executeShot = function(targetScreenX, targetScreenY, speedKmh = 95, spinRPM = 0, powerNorm = 0.7, curlBendMeters = 0, skipAutoKeeperDive = false) {
    if (!isPlaying || !isAiming) return;
    isAiming = false;
    ballInFlight = true;

    if (window.ballSpotRing) window.ballSpotRing.visible = false;
    if (window.resetBallRibbon) window.resetBallRibbon();
    if (window.ballRibbonMat) {
        if (typeof isOnFire !== 'undefined' && isOnFire) {
            window.ballRibbonMat.color.setHex(0xf97316);
        } else if (Math.abs(spinRPM) > 160) {
            window.ballRibbonMat.color.setHex(0x34d399);
        } else {
            window.ballRibbonMat.color.setHex(0x38bdf8);
        }
    }

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

    // Deterministic inverse solve over the game's own fixed-step integrator:
    // ball crosses the goal plane exactly at the aimed point, curl included.
    shotTargetScratch.x = targetWorldX; shotTargetScratch.y = targetWorldY; shotTargetScratch.z = goalPlaneZ;
    const shot = ShotSolver.solve(ballBody.position, shotTargetScratch, Math.abs(vz), curlBendMeters,
        { fixedStep: PHYSICS_STEP, gravity: -world.gravity.y, linearDamping: ballBody.linearDamping, radius: ballRadius });
    currentShotMagnusAx = shot.ax;
    lastShotRecord = { start: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
        target: { x: targetWorldX, y: targetWorldY, z: goalPlaneZ }, speed: Math.abs(vz), curl: curlBendMeters,
        vx: shot.vx, vy: shot.vy, vz: shot.vz, ax: shot.ax, solveErrorM: shot.errorM };
    window.lastShotRecord = lastShotRecord;

    ballBody.velocity.set(shot.vx, shot.vy, shot.vz);

    // Curvature Deflection (Magnus Spin)
    const omegaY = (spinRPM * Math.PI * 2) / 60;
    spinVector.set(0, omegaY, 0);

    // Knuckleball & Trajectory Classification
    const isKnuckle = Math.abs(spinRPM) < 80 && Math.abs(vz) > 28;
    let style = 'Direct Strike';
    if (typeof isOnFire !== 'undefined' && isOnFire) style = '🔥 Fireball Strike';
    else if (isKnuckle) style = 'Laser Knuckleball';
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
    const isPenalty = ((currentGameMode === 'duel' || currentGameMode === 'keeper') && currentRound === 1) ||
                      (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
    const allowWall = ((currentGameMode === 'duel' || currentGameMode === 'keeper') && !isPenalty) ||
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel') ||
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    const diff = (typeof difficultySettings !== 'undefined' && difficultySettings[currentDifficulty])
        ? difficultySettings[currentDifficulty]
        : { gkReactionTime: 0.09, gkSkillBase: 0.78, gkDiveDurationMult: 1.0 };

    if (window.PlayerKinematics) {
        PlayerKinematics.startStrikerRunUp(actualSpeedKmh, spinRPM, powerNorm, curlBendMeters);
        if (allowGk && !skipAutoKeeperDive) {
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
    }

    // Safety timeout for round resolution
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    shotSafetyTimer = setTimeout(() => {
        if (ballInFlight && !shotComplete && isPlaying) {
            if (currentGameMode === 'duel' || currentGameMode === 'practice') {
                finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
            } else if (currentGameMode === 'keeper') {
                finishShot(ballBody.saved ? 'goal' : 'miss', ballBody.saved ? 'SAVED!' : 'GOAL CONCEDED', '', ballBody.saved ? '#22c55e' : '#ef4444');
            } else {
                finishShot('complete');
                setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
            }
        }
    }, 8000);
};

// Player-controlled Goalkeeper Reflex Dive (in Keeper Showdown mode)
window.triggerManualKeeperDive = function(clientX, clientY) {
    if (currentGameMode !== 'keeper' || !isPlaying || shotComplete) return;
    const bounds = getGoalScreenProjected();
    const normX = (clientX - bounds.centerX) / (bounds.goalWidthPx * 0.5);
    const normY = (bounds.groundY - clientY) / bounds.goalHeightPx;

    const targetWorldX = Math.max(-3.3, Math.min(3.3, normX * 3.66));
    const targetWorldY = Math.max(0.25, Math.min(2.38, normY * 2.44));

    if (window.PlayerKinematics) {
        PlayerKinematics.startManualGoalkeeperDive(targetWorldX, targetWorldY, 0.46);
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
};

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying) return;
    if (e.target && e.target.closest && e.target.closest('button, select, #next-round-btn, #next-shot-btn, #practice-toolbar')) {
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
    sfx.init();

    // In Keeper Showdown mode, tapping/clicking dives the Goalkeeper immediately!
    if (currentGameMode === 'keeper') {
        window.triggerManualKeeperDive(e.clientX, e.clientY);
        swipeSamples = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
        return;
    }

    if (!isAiming) return;
    swipeSamples = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
});

window.addEventListener('pointermove', (e) => {
    if (!isPlaying || swipeSamples.length === 0) return;
    if (currentGameMode === 'keeper') {
        swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
        window.triggerManualKeeperDive(e.clientX, e.clientY);
        return;
    }
    if (!isAiming) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
});

window.addEventListener('pointerup', (e) => {
    if (!isPlaying || swipeSamples.length === 0) {
        swipeSamples = [];
        return;
    }
    if (currentGameMode === 'keeper') {
        window.triggerManualKeeperDive(e.clientX, e.clientY);
        lastCompletedSwipe = swipeSamples.slice();
        swipeFadeAlpha = 0.85;
        swipeSamples = [];
        return;
    }
    if (!isAiming) {
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
        const meta = analyzeSwipeCurve(swipeSamples);

        lastCompletedSwipe = swipeSamples.slice();
        lastSwipeMeta = meta;
        swipeFadeAlpha = 1.0;

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

        // Apply subtle stadium crosswind offset on user swipe shots in Duel mode
        if (currentGameMode === 'duel' && typeof windSpeedKmh !== 'undefined' && windSpeedKmh > 0) {
            const windDriftPx = (windSpeedKmh / 22) * windDirSign * (bounds.goalWidthPx * 0.14);
            targetScreenX += windDriftPx;
        }

        window.executeShot(targetScreenX, targetScreenY, meta.speedKmh, meta.spinRPM, meta.powerNorm, meta.curlBendMeters);
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
