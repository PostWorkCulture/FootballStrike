// ============================================================================
// 11. INTUITIVE DIRECTIONAL SHOOTING, SWIPE CURVE CANVAS & KEEPER REFLEX ENGINE
// ============================================================================
window.getGoalScreenProjected = function getGoalScreenProjected() {
    camera.updateMatrixWorld(true);
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
        return { speedKmh: 95, spinRPM: 0, curlBendMeters: 0, powerNorm: 0.65, label: 'DIRECT', initDx: 0, initDy: -100, endDx: 0, endDy: -100, apexX: 0 };
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const totalDx = last.x - first.x;
    const totalDy = last.y - first.y;
    const dt = Math.max(0.055, (last.time - first.time) / 1000);
    const strokeDist = Math.hypot(totalDx, totalDy);
    const strokeSpeed = strokeDist / dt;

    // Measure initial launch tangent (first 40% of swipe) vs final curve hook (last 60% of swipe)
    const splitIdx = Math.max(1, Math.min(samples.length - 1, Math.floor(samples.length * 0.40)));
    const splitPt = samples[splitIdx];
    const initDx = splitPt.x - first.x;
    const initDy = splitPt.y - first.y;
    const lateDx = last.x - splitPt.x;
    const lateDy = last.y - splitPt.y;

    // 1. Mid-path perpendicular bow:
    //    `signedBow > 0`: mid-point is to the LEFT of the chord, meaning the finger bowed left and hooked RIGHT (+X).
    //    `signedBow < 0`: mid-point is to the RIGHT of the chord, meaning the finger bowed right and hooked LEFT (-X).
    let maxBow = 0;
    let apexPt = splitPt;
    if (strokeDist > 12) {
        for (let i = 1; i < samples.length - 1; i++) {
            const s = samples[i];
            const bow = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / strokeDist;
            if (Math.abs(bow) > Math.abs(maxBow)) {
                maxBow = bow;
                apexPt = s;
            }
        }
    }

    // 2. Angular hook between early tangent and late tangent:
    //    Positive when the second half of the swipe turns rightward (+X); negative when turning leftward (-X).
    const initLen = Math.hypot(initDx, initDy) || 1;
    const lateLen = Math.hypot(lateDx, lateDy) || 1;
    const turnRightPx = ((lateDx / lateLen) - (initDx / initLen)) * Math.min(180, strokeDist * 0.65);

    // 3. Natural directional curl assist:
    //    When a player swipes diagonally toward the right or left without drawing an exaggerated C-shape,
    //    blend a gentle natural bend in the direction of their swipe so the ball visibly curls toward their aim!
    const diagonalAimCurlPx = (totalDx / Math.max(120, window.innerWidth * 0.25)) * 22;

    // Combined effective curve signal:
    // Prioritize explicit curve bow/hook if drawn; otherwise follow the natural direction of the swipe!
    let effectiveCurvePx = (maxBow * 0.65) + (turnRightPx * 0.45);
    if (Math.abs(effectiveCurvePx) < 12) {
        effectiveCurvePx += diagonalAimCurlPx;
    } else if (Math.sign(effectiveCurvePx) !== Math.sign(totalDx) && Math.abs(maxBow) < 22) {
        // Prevent accidental micro-jitter on a straight diagonal swipe from reversing the expected curl direction!
        effectiveCurvePx = diagonalAimCurlPx;
    }

    const fireBoost = (typeof isOnFire !== 'undefined' && isOnFire) ? 1.05 : 1.0;
    const distFactor = Math.min(1.0, Math.max(0.0, (-totalDy - 20) / (window.innerHeight * 0.42)));
    const velFactor = Math.min(1.0, Math.max(0.0, (strokeSpeed - 220) / 1450));
    const powerNorm = Math.min(1.0, Math.max(0.38, (distFactor * 0.55 + velFactor * 0.45) * fireBoost));
    const speedKmh = Math.round((82 + powerNorm * 36) * fireBoost);

    const clampedCurve = Math.max(-135, Math.min(135, effectiveCurvePx));
    let curlBendMeters = 0;
    let spinRPM = 0;
    if (Math.abs(clampedCurve) > 4) {
        const sign = clampedCurve > 0 ? 1 : -1;
        const normDefl = (Math.abs(clampedCurve) - 4) / 52.0;
        const bendMag = Math.min(2.75, normDefl * 1.85 + Math.pow(normDefl, 1.25) * 0.55);
        curlBendMeters = sign * bendMag;
        spinRPM = Math.round(curlBendMeters * 430);
    }

    let label = 'PLACED STRIKE';
    if (typeof isOnFire !== 'undefined' && isOnFire) label = '🔥 FIREBALL';
    else if (spinRPM > 160) label = 'CURL RIGHT ↻';
    else if (spinRPM < -160) label = 'CURL LEFT ↺';
    else if (Math.abs(spinRPM) < 85 && speedKmh >= 106) label = 'POWER DRIVE';

    return { speedKmh, spinRPM, curlBendMeters, powerNorm, label, initDx, initDy, endDx: totalDx, endDy: totalDy, apexX: apexPt.x };
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

    // Forward velocity: -22.5 to -34 m/s (~81 to 122 km/h)
    const vz = -Math.max(22.5, speedKmh / 3.6);
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
    if (window.prevBallPos) {
        window.prevBallPos.copy(ballBody.position);
    }

    // Curvature Deflection (Magnus Spin)
    const omegaY = (spinRPM * Math.PI * 2) / 60;
    spinVector.set(0, omegaY, 0);

    // Knuckleball & Trajectory Classification
    const isKnuckle = Math.abs(spinRPM) < 80 && Math.abs(vz) > 28;
    let style = 'Placed Strike';
    if (typeof isOnFire !== 'undefined' && isOnFire) style = '🔥 Fireball Strike';
    else if (isKnuckle) style = 'Power Knuckleball';
    else if (spinRPM > 120) style = 'Curling Inswing';
    else if (spinRPM < -120) style = 'Curling Outswing';

    // Telemetry Update
    const actualSpeedKmh = Math.round(Math.abs(vz) * 3.6);
    maxSpeedRecord = Math.max(maxSpeedRecord, actualSpeedKmh);
    maxSpinRecord = Math.max(maxSpinRecord, Math.round(Math.abs(spinRPM)));

    const speedEl = document.getElementById('stat-speed');
    const spinEl = document.getElementById('stat-spin');
    const styleEl = document.getElementById('stat-style');
    const telEl = document.getElementById('telemetry');
    if (speedEl) speedEl.innerText = actualSpeedKmh + ' KM/H';
    if (spinEl) spinEl.innerText = Math.round(Math.abs(spinRPM)) + ' RPM';
    if (styleEl) styleEl.innerText = style;
    if (telEl) telEl.classList.add('visible');

    sfx.playKick(powerNorm);

    // Camera screen shake on powerful shots (FIFA-style impact)
    if (powerNorm > 0.78) {
        const shakeIntensity = (powerNorm - 0.78) * 0.06;
        const origX = camera.position.x;
        const origY = camera.position.y;
        let shakeTime = 0;
        const shakeInterval = setInterval(() => {
            shakeTime += 16;
            if (shakeTime > 180) {
                camera.position.x = origX;
                camera.position.y = origY;
                clearInterval(shakeInterval);
                return;
            }
            camera.position.x = origX + (Math.random() - 0.5) * shakeIntensity;
            camera.position.y = origY + (Math.random() - 0.5) * shakeIntensity;
        }, 16);
    }

    // Trigger Striker Run-Up, AI Goalkeeper Dive & Wall Jump via PlayerKinematics (always respecting practiceSettings toggles!)
    const isPenalty = (spotZ <= -8.0) ||
                      (practiceSettings.spotMode === 'fixed' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
    const allowWall = practiceSettings.wall && !isPenalty && (currentGameMode !== 'targets');
    const allowGk = practiceSettings.keeper && (currentGameMode !== 'targets');

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
            if (currentGameMode === 'duel' || currentGameMode === 'practice' || currentGameMode === 'training') {
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
    if (!isPlaying || window.isPaused) return;
    if (e.target && e.target.closest && e.target.closest('button, select, input, #pause-modal, #pause-btn, #next-round-btn, #next-shot-btn, #practice-toolbar, #studio-panel')) {
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
    if (!isPlaying || window.isPaused || swipeSamples.length === 0) return;
    if (currentGameMode === 'keeper') {
        swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
        window.triggerManualKeeperDive(e.clientX, e.clientY);
        return;
    }
    if (!isAiming) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
});

window.addEventListener('pointerup', (e) => {
    if (!isPlaying || window.isPaused || swipeSamples.length === 0) {
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

    // Minimum upward gesture: at least 18px upward
    if (totalDy < -18) {
        const meta = analyzeSwipeCurve(swipeSamples);

        lastCompletedSwipe = swipeSamples.slice();
        lastSwipeMeta = meta;
        swipeFadeAlpha = 1.0;

        const bounds = getGoalScreenProjected();
        const halfGoalW = Math.max(80, bounds.goalWidthPx * 0.5);

        // ====================================================================
        // FOOTBALL STRIKE (MINICLIP) WEIGHTED SWIPE-TO-GOAL MAPPING
        // ====================================================================
        // 1. If the user drags their finger directly onto the goal mouth area,
        //    blend their endpoint directly with soft post-magnetism so aiming at
        //    a corner target hits it reliably without flying 10m wide.
        // 2. If the user performs a shorter upward flick from the ball in the lower
        //    half of the screen, map horizontal displacement (`totalDx`) with damped
        //    angular sensitivity + soft tanh post compression so normal swipes stay
        //    inside the posts unless deliberately whipped hard outside (>42 deg).
        let rawNormX;
        const endedNearGoalY = (last.y <= bounds.groundY + bounds.goalHeightPx * 0.35) &&
                               (last.y >= bounds.crossbarY - bounds.goalHeightPx * 0.65);

        if (endedNearGoalY) {
            rawNormX = (last.x - bounds.centerX) / halfGoalW;
        } else {
            // Relative horizontal drag damped against screen width / goal width
            const dragSensitivity = Math.max(halfGoalW * 1.35, window.innerWidth * 0.24);
            const startOffsetNorm = ((first.x - bounds.centerX) / halfGoalW) * 0.30;
            rawNormX = startOffsetNorm + (totalDx / dragSensitivity);
        }

        // Soft magnetic compression inside [-0.96, +0.96] (within the 3.66m posts):
        // Shots aimed up to |rawNormX| = 1.12 compress smoothly inside the goal frame (|normX| <= 0.94),
        // while only wild extreme angles (|rawNormX| > 1.20) miss wide outside the post!
        const signX = rawNormX >= 0 ? 1 : -1;
        const absX = Math.abs(rawNormX);
        let compressedNormX;
        if (absX <= 1.12) {
            compressedNormX = signX * (absX / 1.12) * 0.92;
        } else {
            compressedNormX = signX * (0.92 + (absX - 1.12) * 0.65);
        }

        // Elevation mapping:
        // If finger ends on the goal mouth vertically, respect that height with gentle clamping;
        // otherwise map upward drag length & power smoothly from low driven (0.22) to top corner (0.86).
        let normY;
        if (endedNearGoalY) {
            const rawNormY = (bounds.groundY - last.y) / Math.max(40, bounds.goalHeightPx);
            if (rawNormY <= 1.05) {
                normY = Math.max(0.14, rawNormY * 0.90);
            } else {
                normY = 0.94 + (rawNormY - 1.05) * 0.45;
            }
        } else {
            const dragUpNorm = Math.min(1.25, Math.max(0.15, -totalDy / (window.innerHeight * 0.44)));
            normY = 0.16 + dragUpNorm * 0.68;
        }

        let targetScreenX = bounds.centerX + compressedNormX * halfGoalW;
        let targetScreenY = bounds.groundY - normY * bounds.goalHeightPx;

        // Subtle crosswind drift in higher progressive stages
        if (typeof windSpeedKmh !== 'undefined' && windSpeedKmh > 0) {
            const windDriftPx = (windSpeedKmh / 22) * windDirSign * (bounds.goalWidthPx * 0.08);
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
