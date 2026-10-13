// ============================================================================
// 10. DIFFICULTY SETTINGS, TEAM LOCKER ROOM, KEEPER MODE & GAMEPLAY FLOW
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
        targetSpeedMult: 1.0,
        aiAccuracy: 0.55
    },
    semipro: {
        name: 'Semi-Pro',
        gkReactionTime: 0.09,
        gkSkillBase: 0.78,
        gkDiveDurationMult: 1.0,
        wallJumpMaxH: 0.48,
        targetRaceSeconds: 45,
        targetSpeedMult: 1.5,
        aiAccuracy: 0.72
    },
    worldclass: {
        name: 'World Class',
        gkReactionTime: 0.04,
        gkSkillBase: 0.94,
        gkDiveDurationMult: 0.85,
        wallJumpMaxH: 0.62,
        targetRaceSeconds: 35,
        targetSpeedMult: 2.2,
        aiAccuracy: 0.88
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

// Team Locker Room & 1v1 Matchup Selection
const TEAM_KEY_LIST = ['france', 'brazil', 'argentina', 'england', 'spain', 'germany', 'portugal', 'usa'];
const TEAM_FLAG_EMOJI = {
    france: '🇫🇷', brazil: '🇧🇷', argentina: '🇦🇷', england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    spain: '🇪🇸', germany: '🇩🇪', portugal: '🇵🇹', usa: '🇺🇸'
};

window.selectTeamKit = function(teamIdxOrKey) {
    if (!window.TEAM_PRESETS) return;
    let homeIdx = 0;
    if (typeof teamIdxOrKey === 'number') {
        homeIdx = teamIdxOrKey % TEAM_KEY_LIST.length;
    } else if (typeof teamIdxOrKey === 'string') {
        const found = TEAM_KEY_LIST.indexOf(teamIdxOrKey.toLowerCase());
        if (found >= 0) homeIdx = found;
    }
    const awayIdx = (homeIdx + 1) % TEAM_KEY_LIST.length;
    const homeKey = TEAM_KEY_LIST[homeIdx];
    const awayKey = TEAM_KEY_LIST[awayIdx];
    window.selectedHomeTeam = homeKey;
    window.selectedAwayTeam = awayKey;

    if (window.applyMatchKits) {
        window.applyMatchKits(homeKey, awayKey);
    }

    // Update menu team buttons
    const btns = document.querySelectorAll('.team-pill-btn');
    btns.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === homeIdx);
    });

    updateMatchupBadges();
};

function updateMatchupBadges() {
    if (!window.TEAM_PRESETS) return;
    const homeKey = window.selectedHomeTeam || 'france';
    const awayKey = window.selectedAwayTeam || 'brazil';
    const home = window.TEAM_PRESETS[homeKey];
    const away = window.TEAM_PRESETS[awayKey];
    const homeEl = document.getElementById('home-team-badge');
    const awayEl = document.getElementById('away-team-badge');
    if (homeEl && home) homeEl.innerText = `${TEAM_FLAG_EMOJI[homeKey] || '⚽'} ${home.code}`;
    if (awayEl && away) awayEl.innerText = `${TEAM_FLAG_EMOJI[awayKey] || '⚽'} ${away.code}`;
}

// Camera View Toggle ('third_person' | 'broadcast' | 'first_person')
window.toggleCameraView = function() {
    const modes = ['third_person', 'broadcast', 'first_person'];
    const labels = {
        third_person: '🎥 3RD PERSON',
        broadcast: '🎥 TV WIDE',
        first_person: '🎥 1ST PERSON'
    };
    const curIdx = modes.indexOf(window.cameraViewMode || 'third_person');
    window.cameraViewMode = modes[(curIdx + 1) % modes.length];

    const btn = document.getElementById('camera-view-btn');
    if (btn) btn.innerText = labels[window.cameraViewMode];

    if (window.PlayerKinematics && PlayerKinematics.strikerState.group) {
        const showStriker = (window.cameraViewMode !== 'first_person');
        PlayerKinematics.strikerState.active = showStriker;
        PlayerKinematics.strikerState.group.visible = showStriker;
        if (PlayerKinematics.strikerState.shadow) {
            PlayerKinematics.strikerState.shadow.visible = showStriker;
        }
    }
    applyCameraFramingForSpot();
};

function applyCameraFramingForSpot() {
    if (currentGameMode === 'keeper') {
        // Behind-the-Goalkeeper perspective looking out at the striker & pitch
        // Wait: keep standard behind-ball broadcast view or elevated keeper angle?
        // Using elevated behind-ball view with keeper dive reticle ensures getGoalScreenProjected()
        // works identically for direct click/swipe anywhere on the goal mouth!
        camera.position.set(spotX * 0.65, 1.65, spotZ + 2.6);
        camera.lookAt(0, 0.35, -20.0);
        return;
    }
    if (window.cameraViewMode === 'broadcast') {
        camera.position.set(spotX * 0.92, 1.95, spotZ + 4.1);
        camera.lookAt(0, -0.15, -20.0);
    } else {
        // Standard Hero Over-The-Shoulder / First-Person eye line (preserves exact test geometry)
        camera.position.set(spotX, 1.45, spotZ + 3.0);
        camera.lookAt(0, -0.25, -20.0);
    }
}

function rollWindForRound() {
    if (currentGameMode === 'duel' && currentRound > 1) {
        const speeds = [0, 9, 14, 18, 22];
        windSpeedKmh = speeds[(currentRound - 1) % speeds.length];
        windDirSign = (currentRound % 2 === 0) ? 1 : -1;
    } else {
        windSpeedKmh = 0;
        windDirSign = 1;
    }
    updateWindAndFireHUD();
}

function updateWindAndFireHUD() {
    const windValEl = document.getElementById('wind-val');
    if (windValEl) {
        if (windSpeedKmh <= 1) {
            windValEl.innerText = 'CALM 0 KM/H';
            windValEl.style.color = '#94a3b8';
        } else {
            const arrow = windDirSign > 0 ? '➔' : '⬅';
            windValEl.innerText = `${arrow} ${windSpeedKmh} KM/H`;
            windValEl.style.color = windSpeedKmh >= 16 ? '#fbbf24' : '#38bdf8';
        }
    }

    const fireFillEl = document.getElementById('fire-bar-fill');
    const fireLblEl = document.getElementById('fire-status-lbl');
    if (fireFillEl) {
        fireFillEl.style.width = `${Math.min(100, fireballCharge)}%`;
        fireFillEl.style.background = isOnFire
            ? 'linear-gradient(90deg, #f97316, #facc15)'
            : 'linear-gradient(90deg, #0284c7, #38bdf8)';
    }
    if (fireLblEl) {
        if (isOnFire) {
            fireLblEl.innerText = '🔥 ON FIRE x2!';
            fireLblEl.style.color = '#facc15';
        } else {
            fireLblEl.innerText = `⚡ CHARGE ${Math.min(100, fireballCharge)}%`;
            fireLblEl.style.color = '#94a3b8';
        }
    }
}

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
    if (aiShotTimer) clearTimeout(aiShotTimer);
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    const reticle = document.getElementById('keeper-target-reticle');
    if (reticle) reticle.style.display = 'none';

    // Update Fireball / Streak state
    if (outcome === 'goal') {
        streak++;
        highestStreak = Math.max(highestStreak, streak);
        fireballCharge = Math.min(100, fireballCharge + 50);
        if (fireballCharge >= 100 || streak >= 2) {
            isOnFire = true;
            fireballCharge = 100;
        }
        bloomPass.strength = 0.85;
        setTimeout(() => { bloomPass.strength = 0.30; }, 700);
    } else if (outcome === 'miss') {
        streak = 0;
        fireballCharge = 0;
        isOnFire = false;
    }
    updateWindAndFireHUD();

    if (bannerMain) {
        showBanner(bannerMain, bannerSub, bannerColor);
    }

    if (window.PlayerKinematics) {
        if (currentGameMode === 'keeper') {
            // In Keeper mode, 'goal' means the Keeper SAVED the shot; 'miss' means AI scored
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'miss' : 'goal');
        } else {
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'goal' : 'miss');
        }
    }

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        duelResults[currentRound - 1] = outcome;
        // Simulate AI opponent's simultaneous round shot in 1v1 Duel
        if (currentGameMode === 'duel' && duelAiResults[currentRound - 1] === undefined) {
            const diff = difficultySettings[currentDifficulty] || difficultySettings.semipro;
            // Deterministic-ish fair AI conversion based on round & difficulty
            const aiRoll = ((currentRound * 0.37 + (outcome === 'goal' ? 0.21 : 0.43)) % 1.0);
            duelAiResults[currentRound - 1] = (aiRoll < diff.aiAccuracy) ? 'goal' : 'miss';
        }
        updateDuelPills();
        updateHUD();
    }

    if (currentGameMode === 'practice') {
        shotOutcomeTimer = setTimeout(() => {
            if (shotComplete && isPlaying && currentGameMode === 'practice') {
                resetBall();
            }
        }, 2000);
        return;
    }

    // Display Next Shot Button in Unified Top-Right Unit
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn && (currentGameMode === 'duel' || currentGameMode === 'keeper')) {
        if (currentRound >= maxDuelShots) {
            topNextBtn.innerHTML = `<span>RESULTS</span><span style="font-size: 14px;">➔</span>`;
        } else {
            topNextBtn.innerHTML = `<span>NEXT SHOT</span><span style="font-size: 14px;">➔</span>`;
        }
        topNextBtn.style.display = 'inline-flex';
    }

    // Snappy 3.8s auto-advance (keeps button visible at t=2.0s for verify_v9_review.py while avoiding 12s dead wait)
    shotOutcomeTimer = setTimeout(() => {
        if (shotComplete && isPlaying) {
            triggerNextShot();
        }
    }, 3800);
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

    // Update AI Opponent score display if present
    const aiScoreEl = document.getElementById('ai-score-display');
    if (aiScoreEl) {
        const aiGoals = duelAiResults.filter(r => r === 'goal').length;
        aiScoreEl.innerText = `${aiGoals}`;
    }
}

window.showMatchResults = function(title) {
    isPlaying = false;
    isAiming = false;
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);

    sfx.playCheer();

    document.getElementById('modal-title').innerText = title;
    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        const aiGoals = duelAiResults.filter(r => r === 'goal').length;
        document.getElementById('modal-final-score').innerText = `${goalsCount} / ${maxDuelShots} GOALS`;
        document.getElementById('stat-modal-accuracy').innerText = `${Math.round((goalsCount / maxDuelShots) * 100)}%`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) {
            if (goalsCount > aiGoals) streakEl.innerText = `WON ${goalsCount}-${aiGoals} 🏆`;
            else if (goalsCount === aiGoals) streakEl.innerText = `DRAW ${goalsCount}-${aiGoals}`;
            else streakEl.innerText = `LOST ${goalsCount}-${aiGoals}`;
        }
    } else if (currentGameMode === 'keeper') {
        const savesCount = duelResults.filter(r => r === 'goal').length;
        document.getElementById('modal-final-score').innerText = `${savesCount} / ${maxDuelShots} SAVES`;
        document.getElementById('stat-modal-accuracy').innerText = `${Math.round((savesCount / maxDuelShots) * 100)}%`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = savesCount >= 3 ? 'GOLDEN GLOVE 🧤' : `${savesCount} Saved`;
    } else {
        document.getElementById('modal-final-score').innerText = `${targetsShattered} TARGETS HIT`;
        document.getElementById('stat-modal-accuracy').innerText = `${score} PTS`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = `x${Math.max(1, highestStreak)} Max Streak`;
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
    if (aiShotTimer) clearTimeout(aiShotTimer);
    swipeSamples = [];
    spotX = 0;
    spotZ = -9.0;
    let isPenalty = false;

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
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

    rollWindForRound();

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    if (window.ballGroundShadow) {
        window.ballGroundShadow.position.set(spotX, 0.015, spotZ);
        window.ballGroundShadow.scale.set(1, 1, 1);
    }
    if (window.ballSpotRing) {
        window.ballSpotRing.position.set(spotX, 0.016, spotZ);
        window.ballSpotRing.visible = true;
        window.ballSpotRing.material.color.setHex(isOnFire ? 0xf97316 : 0x38bdf8);
    }
    if (window.resetBallRibbon) {
        window.resetBallRibbon();
    }

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

    const allowWall = ((currentGameMode === 'duel' || currentGameMode === 'keeper') && !isPenalty) ||
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel' || currentGameMode === 'keeper') ||
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
        const gkStartXPos = allowWall ? (-wallSide * 0.95) : 0;
        gkGroup.position.set(gkStartXPos, 0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkSpine.rotation.set(0, 0, 0);
        gkMesh.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartXPos, 1.15, -19.6);
        if (gkShadow) {
            gkShadow.position.set(gkStartXPos, 0.015, -19.6);
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

    applyCameraFramingForSpot();

    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) topNextBtn.style.display = 'none';

    const banner = document.getElementById('banner');
    if (banner) {
        banner.classList.remove('show');
    }

    const reticle = document.getElementById('keeper-target-reticle');
    if (reticle) reticle.style.display = 'none';

    isAiming = true;
    sfx.playWhistle();

    // If in Goalkeeper Showdown mode, schedule the AI Striker's shot automatically!
    if (currentGameMode === 'keeper' && isPlaying) {
        scheduleAiStrikerShot();
    }
};

function scheduleAiStrikerShot() {
    if (aiShotTimer) clearTimeout(aiShotTimer);
    // Pick a challenging corner target on the goal plane
    const corners = [
        { x: -2.45, y: 1.85, curl: 1.1, spin: 460 },
        { x: 2.45, y: 1.85, curl: -1.1, spin: -460 },
        { x: -2.35, y: 0.55, curl: 0.6, spin: 260 },
        { x: 2.35, y: 0.55, curl: -0.6, spin: -260 },
        { x: 0.0, y: 2.05, curl: 0.0, spin: 40 }
    ];
    const pick = corners[(currentRound - 1 + Math.floor(Math.random() * 2)) % corners.length];
    aiAimTarget.x = pick.x;
    aiAimTarget.y = pick.y;

    // Show early visual anticipation reticle on the goal plane so Keeper player can react & dive!
    aiShotTimer = setTimeout(() => {
        if (!isPlaying || currentGameMode !== 'keeper' || shotComplete) return;
        const bounds = window.getGoalScreenProjected();
        const screenX = bounds.centerX + (pick.x / 3.66) * (bounds.goalWidthPx * 0.5);
        const screenY = bounds.groundY - (pick.y / 2.44) * bounds.goalHeightPx;

        const reticle = document.getElementById('keeper-target-reticle');
        if (reticle) {
            reticle.style.left = `${screenX}px`;
            reticle.style.top = `${screenY}px`;
            reticle.style.display = 'flex';
        }

        // Launch AI Striker shot without auto-diving the Goalkeeper (player controls Keeper!)
        window.executeShot(screenX, screenY, 96, pick.spin, 0.78, pick.curl, true);
    }, 950);
}

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
    savesMade = 0;
    streak = 0;
    fireballCharge = 0;
    isOnFire = false;
    maxSpeedRecord = 0;
    maxSpinRecord = 0;
    highestStreak = 0;
    targetsShattered = 0;

    updateMatchupBadges();
    updateHUD();

    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);

    const practiceToolbar = document.getElementById('practice-toolbar');
    const aiVsBox = document.getElementById('ai-vs-box');

    if (mode === 'duel' || mode === 'keeper') {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        if (aiVsBox) aiVsBox.style.display = (mode === 'duel') ? 'flex' : 'none';
        currentRound = 1;
        duelResults = [];
        duelAiResults = [];
        document.getElementById('tracker-label').innerText = (mode === 'keeper') ? 'KEEPER SAVE' : 'ROUND';
        document.getElementById('shot-pills').style.display = 'flex';
        document.getElementById('timer-display').style.display = 'none';
        updateDuelPills();
    } else if (mode === 'practice') {
        if (practiceToolbar) practiceToolbar.style.display = 'flex';
        if (aiVsBox) aiVsBox.style.display = 'none';
        document.getElementById('tracker-label').innerText = 'PRACTICE';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'none';
    } else {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        if (aiVsBox) aiVsBox.style.display = 'none';
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
    if (aiShotTimer) clearTimeout(aiShotTimer);
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
    const practiceToolbar = document.getElementById('practice-toolbar');
    if (practiceToolbar) practiceToolbar.style.display = 'none';
};

window.triggerNextShot = function() {
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);
    if (!isPlaying && document.getElementById('results-modal').style.display === 'flex') return;

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        if (currentRound >= maxDuelShots) {
            showMatchResults(currentGameMode === 'keeper' ? 'KEEPER SHOWDOWN COMPLETE!' : 'MATCH FINISHED!');
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
    } else if (currentGameMode === 'keeper') {
        const savesCount = duelResults.filter(r => r === 'goal').length;
        if (scoreLbl) scoreLbl.innerText = 'SAVES';
        if (scoreDisp) scoreDisp.innerText = `${savesCount}`;
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
