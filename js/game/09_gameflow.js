// ============================================================================
// 10. DIFFICULTY SETTINGS, PRACTICE ARENA & GAMEPLAY FLOW
// ============================================================================
let currentDifficulty = 'semipro';
const difficultySettings = {
    amateur: {
        name: 'Amateur',
        gkReactionTime: 0.16,
        gkSkillBase: 0.58,
        gkDiveDurationMult: 1.20,
        wallJumpMaxH: 0.28,
        targetRaceSeconds: 60,
        targetSpeedMult: 1.0
    },
    semipro: {
        name: 'Semi-Pro',
        gkReactionTime: 0.09,
        gkSkillBase: 0.78,
        gkDiveDurationMult: 1.0,
        wallJumpMaxH: 0.48,
        targetRaceSeconds: 45,
        targetSpeedMult: 1.5
    },
    worldclass: {
        name: 'World Class',
        gkReactionTime: 0.04,
        gkSkillBase: 0.94,
        gkDiveDurationMult: 0.85,
        wallJumpMaxH: 0.62,
        targetRaceSeconds: 35,
        targetSpeedMult: 2.2
    }
};

window.setDifficulty = function(diffKey) {
    if (!difficultySettings[diffKey]) return;
    currentDifficulty = diffKey;
    const selectEl = document.getElementById('difficulty-select');
    if (selectEl && selectEl.value !== diffKey) selectEl.value = diffKey;

    const diff = difficultySettings[currentDifficulty];
    wallDefenderConfigs.forEach(cfg => {
        cfg.maxH = diff.wallJumpMaxH * (cfg.id === 1 ? 1.05 : 0.95);
    });
};

let shotOutcomeTimer = null;

const practiceSpots = [
    { name: 'Penalty Spot (11m)', x: 0, z: -9.0, isPenalty: true },
    { name: 'Center Free Kick (19m)', x: 0, z: -0.5, isPenalty: false },
    { name: 'Left Angle (21m)', x: -4.5, z: 1.0, isPenalty: false },
    { name: 'Right Angle (21m)', x: 4.5, z: 1.0, isPenalty: false },
    { name: 'Long Range (26m)', x: 0, z: 6.0, isPenalty: false }
];

let practiceSettings = {
    targets: true,
    wall: true,
    keeper: true,
    spotIndex: 0
};

window.togglePracticeMenu = function() {
    const panel = document.getElementById('practice-menu-panel');
    const arrow = document.getElementById('practice-menu-arrow');
    if (!panel) return;
    const isShown = panel.style.display !== 'none';
    panel.style.display = isShown ? 'none' : 'flex';
    if (arrow) arrow.innerText = isShown ? '▾' : '▴';
};

window.togglePracticeOption = function(type) {
    if (practiceSettings[type] === undefined) return;
    practiceSettings[type] = !practiceSettings[type];
    
    const btn = document.getElementById(`toggle-${type}-btn`);
    if (btn) {
        btn.innerText = practiceSettings[type] ? 'ON' : 'OFF';
        btn.classList.toggle('active', practiceSettings[type]);
    }

    if (type === 'targets') {
        if (practiceSettings.targets) {
            spawnTargets();
        } else {
            activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
            activeTargets = [];
        }
    } else if (type === 'wall') {
        const isPenalty = practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty;
        const allowWall = practiceSettings.wall && !isPenalty;
        wallGroup.visible = allowWall;
        if (allowWall) {
            wallBodies.forEach((b, idx) => {
                const cfg = wallDefenderConfigs[idx];
                b.position.set(wallGroup.position.x + cfg.xOffset, 0.95, wallGroup.position.z);
                b.collisionResponse = 1;
            });
        } else {
            wallBodies.forEach(b => {
                b.position.set(0, -999, 0);
                b.collisionResponse = 0;
            });
        }
    } else if (type === 'keeper') {
        gkGroup.visible = practiceSettings.keeper;
        if (gkShadow) gkShadow.visible = practiceSettings.keeper;
        if (practiceSettings.keeper) {
            gkBodyCollider.position.copy(gkGroup.position);
            gkBodyCollider.position.y += 1.15;
            if (gkShadow) gkShadow.position.set(gkGroup.position.x, 0.015, gkGroup.position.z);
        } else {
            gkBodyCollider.position.set(0, -999, 0);
            if (gkShadow) gkShadow.position.set(0, -999, 0);
        }
    }
};

window.cyclePracticeSpot = function() {
    practiceSettings.spotIndex = (practiceSettings.spotIndex + 1) % practiceSpots.length;
    const spot = practiceSpots[practiceSettings.spotIndex];
    const btn = document.getElementById('practice-spot-btn');
    if (btn) {
        btn.innerText = spot.name.split(' ')[0];
    }
    resetBall();
};

function finishShot(outcome, bannerMain, bannerSub, bannerColor) {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    if (bannerMain) {
        showBanner(bannerMain, bannerSub, bannerColor);
    }

    if (outcome === 'goal') {
        bloomPass.strength = 1.0;
        setTimeout(() => { bloomPass.strength = 0.30; }, 800);
    }

    if (window.PlayerKinematics) {
        PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'goal' : 'miss');
    }

    if (currentGameMode === 'duel') {
        duelResults[currentRound - 1] = outcome;
        updateDuelPills();
        updateHUD();
    }

    if (currentGameMode === 'practice') {
        shotOutcomeTimer = setTimeout(() => {
            if (shotComplete && isPlaying && currentGameMode === 'practice') {
                resetBall();
            }
        }, 2200);
        return;
    }

    // Display Next Shot Button in Unified Top-Right Unit
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn && currentGameMode === 'duel') {
        if (currentRound >= maxDuelShots) {
            topNextBtn.innerHTML = `<span>RESULTS</span><span style="font-size: 14px;">➔</span>`;
        } else {
            topNextBtn.innerHTML = `<span>NEXT SHOT</span><span style="font-size: 14px;">➔</span>`;
        }
        topNextBtn.style.display = 'inline-flex';
    }

    // Ample time for user to review shot and press NEXT SHOT
    shotOutcomeTimer = setTimeout(() => {
        if (shotComplete && isPlaying) {
            triggerNextShot();
        }
    }, 12000);
}

function spawnTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];

    if (currentGameMode === 'targets') {
        wallGroup.visible = false;
        wallBodies.forEach(b => { b.collisionResponse = 0; });
        gkGroup.visible = false;
        gkBodyCollider.collisionResponse = 0;
        [0, 1, 2].forEach(slotId => spawnSingleTarget(slotId));
    } else if (currentGameMode === 'practice') {
        wallGroup.visible = practiceSettings.wall;
        wallBodies.forEach(b => { b.collisionResponse = practiceSettings.wall ? 1 : 0; });
        gkGroup.visible = practiceSettings.keeper;
        gkBodyCollider.collisionResponse = 0;
        if (practiceSettings.targets) {
            [0, 1, 2].forEach(slotId => spawnSingleTarget(slotId));
        }
    } else {
        wallGroup.visible = true;
        wallBodies.forEach(b => { b.collisionResponse = 1; });
        gkGroup.visible = true;
        gkBodyCollider.collisionResponse = 0;
    }
}

function updateDuelPills() {
    const container = document.getElementById('shot-pills');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < maxDuelShots; i++) {
        const pill = document.createElement('div');
        pill.style.width = '24px';
        pill.style.height = '24px';
        pill.style.borderRadius = '50%';
        pill.style.display = 'flex';
        pill.style.alignItems = 'center';
        pill.style.justifyContent = 'center';
        pill.style.fontSize = '12px';
        pill.style.fontWeight = 'bold';
        
        if (duelResults[i] === 'goal') {
            pill.style.background = '#22c55e';
            pill.style.color = '#fff';
            pill.innerText = '✓';
            pill.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.6)';
        } else if (duelResults[i] === 'miss') {
            pill.style.background = '#ef4444';
            pill.style.color = '#fff';
            pill.innerText = '✕';
        } else if (i === currentRound - 1) {
            pill.style.border = '2px solid #38bdf8';
            pill.style.background = 'rgba(56, 189, 248, 0.2)';
            pill.innerText = (i + 1).toString();
            pill.style.color = '#38bdf8';
        } else {
            pill.style.background = 'rgba(255, 255, 255, 0.1)';
            pill.style.color = '#64748b';
            pill.innerText = (i + 1).toString();
        }
        container.appendChild(pill);
    }
}

window.showMatchResults = function(title) {
    isPlaying = false;
    isAiming = false;
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    
    sfx.playCheer();
    
    document.getElementById('modal-title').innerText = title;
    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        document.getElementById('modal-final-score').innerText = `${goalsCount} / ${maxDuelShots} GOALS`;
        document.getElementById('stat-modal-accuracy').innerText = `${Math.round((goalsCount / maxDuelShots) * 100)}%`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = `${goalsCount} Scored`;
    } else {
        document.getElementById('modal-final-score').innerText = `${targetsShattered} TARGETS HIT`;
        document.getElementById('stat-modal-accuracy').innerText = `${targetsShattered} Hits`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = 'Completed';
    }
    
    document.getElementById('stat-modal-speed').innerText = `${maxSpeedRecord || 85} KM/H`;
    document.getElementById('stat-modal-spin').innerText = `${maxSpinRecord || 0} RPM`;
    
    document.getElementById('results-modal').style.display = 'flex';
};

window.restartCurrentMode = function() {
    document.getElementById('results-modal').style.display = 'none';
    selectMode(currentGameMode);
};

// Dynamic Goalkeeper & Wall Motion State
let gkDiving = false;
let gkDiveTimer = 0;
let gkDiveType = 'mid_parry';
let gkTargetX = 0;
let gkTargetY = 1.15;
let gkTargetRotZ = 0;
let gkStartX = 0;
let gkStartY = 0;
let gkDiveDuration = 0.52;
let gkReactionTime = 0.08;
let wallJumping = false;
let wallJumpTimer = 0;

Object.defineProperty(window, 'gkDiving', { get: () => gkDiving, set: (v) => { gkDiving = v; } });
Object.defineProperty(window, 'gkDiveType', { get: () => gkDiveType, set: (v) => { gkDiveType = v; } });
Object.defineProperty(window, 'wallJumping', { get: () => wallJumping, set: (v) => { wallJumping = v; } });
Object.defineProperty(window, 'wallJumpTimer', { get: () => wallJumpTimer, set: (v) => { wallJumpTimer = v; } });
Object.defineProperty(window, 'currentRound', { get: () => currentRound, set: (v) => { currentRound = v; } });
Object.defineProperty(window, 'ballBody', { get: () => ballBody });
Object.defineProperty(window, 'shotComplete', { get: () => shotComplete });

// Magnus Aerodynamic Spin & Ball Physics
let spinVector = new THREE.Vector3();
let currentShotMagnusAx = 0;
let swipeSamples = [];
let ballInFlight = false;
let slowMo = false;

window.resetBall = function() {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    swipeSamples = [];
    spotX = 0;
    spotZ = -9.0;
    let isPenalty = false;

    if (currentGameMode === 'duel') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
    } else if (currentGameMode === 'practice') {
        const spot = practiceSpots[practiceSettings.spotIndex];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
    }

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    spinVector.set(0, 0, 0);
    currentShotMagnusAx = 0;
    ballInFlight = false;
    slowMo = false;
    ballBody.scored = false;
    ballBody.saved = false;
    ballBody.blocked = false;
    ballBody.inNet = false;
    shotComplete = false;
    if (netClothPhysics) {
        netClothPhysics.reset();
    }

    // Reset Goalkeeper & Wall Postures
    gkDiving = false;
    gkDiveTimer = 0;
    gkDiveType = 'mid_parry';
    gkStartX = 0;
    gkStartY = 0;
    gkGroup.position.set(0, 0, -19.6);
    gkSpine.position.set(0, 0, 0);
    gkSpine.rotation.set(0, 0, 0);
    gkMesh.rotation.set(0, 0, 0);
    setGkPose('idle');

    wallJumping = false;
    wallJumpTimer = 0;
    wallGroup.position.y = 0;

    wallDefenders.forEach((def, idx) => {
        const cfg = wallDefenderConfigs[idx];
        def.position.set(cfg.xOffset, 0, 0);
        def.rotation.set(0, cfg.inwardYaw * 0.2, 0);
    });
    wallShadows.forEach(s => {
        s.scale.set(1, 1, 1);
        s.material.opacity = 0.75;
    });


    const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel') || 
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    wallGroup.visible = allowWall;
    if (allowWall) {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = Math.min(-11.0, spotZ - 9.15);
        wallGroup.position.set(wallX, 0, wallZ);
        wallBodies.forEach((b, idx) => {
            const cfg = wallDefenderConfigs[idx];
            b.position.set(wallX + cfg.xOffset, 0.95, wallZ);
            b.collisionResponse = 1;
        });
    } else {
        wallGroup.position.set(0, -999, 0);
        wallBodies.forEach(b => {
            b.position.set(0, -999, 0);
            b.collisionResponse = 0;
        });
    }

    gkGroup.visible = allowGk;
    if (gkShadow) gkShadow.visible = allowGk;
    if (allowGk) {
        const wallSide = (-spotX >= 0) ? 1 : -1;
        const gkStartX = allowWall ? (-wallSide * 0.95) : 0;
        gkGroup.position.set(gkStartX, 0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkSpine.rotation.set(0, 0, 0);
        gkMesh.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartX, 1.15, -19.6);
        if (gkShadow) {
            gkShadow.position.set(gkStartX, 0.015, -19.6);
            gkShadow.scale.set(1, 1, 1);
            gkShadow.material.opacity = 0.75;
        }
    } else {
        gkGroup.position.set(0, -999, 0);
        gkBodyCollider.position.set(0, -999, 0);
        if (gkShadow) gkShadow.position.set(0, -999, 0);
    }

    if (window.PlayerKinematics) {
        PlayerKinematics.resetStriker(spotX, spotZ, isPenalty, currentGameMode);
        PlayerKinematics.resetGoalkeeper(spotX, allowGk, allowWall);
        PlayerKinematics.resetWall(spotX, spotZ, allowWall);
    }

    // Dynamic Camera Framing (Hero Sports Broadcast Angle - Elevated TV broadcast perspective)
    camera.position.set(spotX, 1.45, spotZ + 3.0); // first-person: striker's eye line behind the ball
    camera.lookAt(0, -0.25, -20.0);

    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) topNextBtn.style.display = 'none';

    const banner = document.getElementById('banner');
    if (banner) {
        banner.classList.remove('show');
    }

    isAiming = true;
    sfx.playWhistle();
};

window.selectMode = function(mode) {
    sfx.init();
    sfx.startAmbient();
    currentGameMode = mode;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    isPlaying = true;
    score = 0;
    goalsScored = 0;
    streak = 0;
    maxSpeedRecord = 0;
    maxSpinRecord = 0;
    highestStreak = 0;
    targetsShattered = 0;
    updateHUD();

    if (targetRaceTimer) clearInterval(targetRaceTimer);

    const practiceToolbar = document.getElementById('practice-toolbar');

    if (mode === 'duel') {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        currentRound = 1;
        duelResults = [];
        document.getElementById('tracker-label').innerText = 'ROUND';
        document.getElementById('shot-pills').style.display = 'flex';
        document.getElementById('timer-display').style.display = 'none';
        updateDuelPills();
    } else if (mode === 'practice') {
        if (practiceToolbar) practiceToolbar.style.display = 'flex';
        document.getElementById('tracker-label').innerText = 'PRACTICE';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'none';
    } else {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        targetRaceTimeLeft = 45;
        document.getElementById('tracker-label').innerText = 'TIME';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'block';
        document.getElementById('timer-display').style.color = '#38bdf8';
        document.getElementById('timer-display').innerText = '45s';

        targetRaceTimer = setInterval(() => {
            if (!isPlaying) { clearInterval(targetRaceTimer); return; }
            targetRaceTimeLeft--;
            document.getElementById('timer-display').innerText = targetRaceTimeLeft + 's';
            if (targetRaceTimeLeft <= 5 && targetRaceTimeLeft > 0) {
                sfx.playWhistle();
                document.getElementById('timer-display').style.color = '#ef4444';
            }
            if (targetRaceTimeLeft <= 0) {
                clearInterval(targetRaceTimer);
                showMatchResults('TARGET RACE COMPLETE!');
            }
        }, 1000);
    }

    spawnTargets();
    resetBall();
};

window.resetToMenu = function() {
    isPlaying = false;
    sfx.stopAmbient();
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
    const practiceToolbar = document.getElementById('practice-toolbar');
    if (practiceToolbar) practiceToolbar.style.display = 'none';
};

window.triggerNextShot = function() {
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    if (!isPlaying && document.getElementById('results-modal').style.display === 'flex') return;

    if (currentGameMode === 'duel') {
        if (currentRound >= maxDuelShots) {
            showMatchResults('MATCH FINISHED!');
            return;
        }
        currentRound++;
        updateDuelPills();
        resetBall();
    } else {
        resetBall();
    }
};

function updateHUD() {
    const scoreLbl = document.getElementById('score-label');
    const scoreDisp = document.getElementById('score-display');
    const streakBadge = document.getElementById('streak-badge');
    if (streakBadge) streakBadge.style.display = 'none';

    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        if (scoreLbl) scoreLbl.innerText = 'GOALS';
        if (scoreDisp) scoreDisp.innerText = `${goalsCount}`;
    } else if (currentGameMode === 'practice') {
        if (scoreLbl) scoreLbl.innerText = 'GOALS';
        if (scoreDisp) scoreDisp.innerText = `${goalsScored}`;
    } else {
        if (scoreLbl) scoreLbl.innerText = 'TARGETS';
        if (scoreDisp) scoreDisp.innerText = `${targetsShattered}`;
    }
}

function showBanner(main, sub = '', color = '#22c55e') {
    const banner = document.getElementById('banner');
    const mainEl = document.getElementById('banner-main');
    const subEl = document.getElementById('banner-sub');
    if (!banner || !mainEl) return;

    mainEl.innerText = main;
    mainEl.style.color = color;
    
    if (subEl) {
        if (sub && sub.trim().length > 0 && !sub.includes('PTS')) {
            subEl.innerText = sub;
            subEl.style.display = 'block';
        } else {
            subEl.innerText = '';
            subEl.style.display = 'none';
        }
    }

    // Position dynamically directly above the goal crossbar
    const goalTopVec = new THREE.Vector3(0, 3.25, -20.0).project(camera);
    const screenX = (goalTopVec.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-goalTopVec.y * 0.5 + 0.5) * window.innerHeight;

    banner.style.left = `${screenX}px`;
    banner.style.top = `${Math.max(65, Math.min(window.innerHeight * 0.38, screenY))}px`;
    banner.classList.add('show');
}

// ============================================================================
