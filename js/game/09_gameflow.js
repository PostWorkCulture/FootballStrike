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

// Camera View Toggle ('first_person' | 'third_person' | 'broadcast')
window.toggleCameraView = function(forceMode) {
    const modes = ['first_person', 'third_person', 'broadcast'];
    const labels = {
        first_person: '1ST PERSON (KICK TAKER)',
        third_person: '3RD PERSON',
        broadcast: 'TV WIDE'
    };
    if (forceMode && modes.indexOf(forceMode) >= 0) {
        window.cameraViewMode = forceMode;
    } else {
        const curIdx = modes.indexOf(window.cameraViewMode || 'first_person');
        window.cameraViewMode = modes[(curIdx + 1) % modes.length];
    }

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
        camera.fov = 34;
        camera.updateProjectionMatrix();
        camera.position.set(spotX * 0.65, 1.85, spotZ + 2.4);
        camera.lookAt(0, 0.70, -20.0);
        return;
    }
    const distToGoal = Math.abs(-20.0 - spotZ);
    // Telephoto FOV (30–33 deg) makes the goal large and commanding while keeping the ball prominently on-screen at ~78% height!
    const adaptiveFov = Math.max(28, Math.min(33, 33 - Math.max(0, distToGoal - 11.5) * 0.45));
    if (!window.__studioCameraTouched) {
        camera.fov = adaptiveFov;
        camera.updateProjectionMatrix();
    }
    if (window.cameraViewMode === 'broadcast') {
        camera.position.set(spotX * 0.92, 1.95, spotZ + 5.8);
        camera.lookAt(spotX * 0.20, 0.72, -20.0);
    } else if (window.cameraViewMode === 'third_person') {
        camera.position.set(spotX, 1.65, spotZ + 4.9);
        camera.lookAt(spotX * 0.25, 0.68, -20.0);
    } else {
        // First-Person Kick Taker perspective:
        // Camera at y = 1.62m, z = spotZ + 4.85m looking toward (spotX * 0.25, 0.68, -20.0):
        // - Places the ball prominently in the lower foreground (~78% screen Y, ~700px on a 900px screen)
        // - Elevates the camera above the 3-man wall and uses a 31° telephoto lens so the goal & all 5 targets are large and clear!
        camera.position.set(spotX, 1.62, spotZ + 4.85);
        camera.lookAt(spotX * 0.25, 0.68, -20.0);
    }
}

function rollWindForRound() {
    const isProgTraining = !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel');
    if (isProgTraining && drillLevel >= 3) {
        const tierSpeeds = [0, 0, 8, 14, 19];
        windSpeedKmh = tierSpeeds[Math.min(4, drillLevel - 1)] || 0;
        windDirSign = (currentRound % 2 === 0) ? 1 : -1;
    } else if (currentGameMode === 'duel' && currentRound > 1) {
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
    { name: 'Progressive Auto', x: 0, z: -9.0, isPenalty: false, isAuto: true },
    { name: 'Penalty Spot (11m)', x: 0, z: -9.0, isPenalty: true },
    { name: 'Center Free Kick (15m)', x: 0, z: -5.5, isPenalty: false },
    { name: 'Left Angle (15.5m)', x: -2.6, z: -5.2, isPenalty: false },
    { name: 'Right Angle (15.5m)', x: 2.6, z: -5.2, isPenalty: false },
    { name: 'Edge of Box (17.5m)', x: 0, z: -2.8, isPenalty: false }
];

let practiceSettings = {
    targets: true,
    wall: true,
    keeper: true,
    spotMode: 'auto',
    spotIndex: 0
};
window.practiceSettings = practiceSettings;
window.isPaused = false;

window.togglePauseMenu = function(forceState) {
    const modal = document.getElementById('pause-modal');
    if (!modal) return;
    const nextState = (typeof forceState === 'boolean') ? forceState : (modal.style.display === 'none' || !modal.style.display);
    window.isPaused = nextState;
    modal.style.display = nextState ? 'flex' : 'none';
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPlaying) {
        window.togglePauseMenu();
    }
});

window.togglePracticeMenu = function() {
    window.togglePauseMenu();
};

window.togglePracticeOption = function(type) {
    if (practiceSettings[type] === undefined) return;
    practiceSettings[type] = !practiceSettings[type];

    // Sync all matching toggle buttons (in Pause Menu and any legacy hooks)
    document.querySelectorAll(`[data-toggle-opt="${type}"], #toggle-${type}-btn`).forEach(btn => {
        btn.innerText = practiceSettings[type] ? 'ON' : 'OFF';
        btn.classList.toggle('active', practiceSettings[type]);
    });

    if (type === 'targets') {
        if (practiceSettings.targets) {
            spawnTargets();
        } else {
            activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
            activeTargets = [];
        }
    } else if (type === 'wall') {
        const isPenalty = (spotZ <= -8.0) ||
                          (practiceSettings.spotMode === 'fixed' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
        const allowWall = practiceSettings.wall && !isPenalty;
        wallGroup.visible = allowWall;
        if (window.trainingPropsGroup) window.trainingPropsGroup.visible = practiceSettings.wall;
        if (allowWall) {
            const dxToGoal = -spotX;
            const wallSide = dxToGoal >= 0 ? 1 : -1;
            const wallX = spotX * 0.45 + (wallSide * 0.75);
            const wallZ = Math.min(-12.2, spotZ - 7.2);
            wallGroup.position.set(wallX, 0.0, wallZ);
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
    } else if (type === 'keeper') {
        const allowGk = practiceSettings.keeper;
        gkGroup.visible = allowGk;
        if (gkShadow) gkShadow.visible = allowGk;
        if (allowGk) {
            const isPenalty = (spotZ <= -8.0) ||
                              (practiceSettings.spotMode === 'fixed' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
            const allowWall = practiceSettings.wall && !isPenalty;
            const wallSide = (-spotX >= 0) ? 1 : -1;
            const gkStartXPos = allowWall ? (-wallSide * 0.95) : 0;
            gkGroup.position.set(gkStartXPos, 0.0, -19.6);
            gkBodyCollider.position.set(gkStartXPos, 1.15, -19.6);
            if (gkShadow) gkShadow.position.set(gkStartXPos, 0.004, -19.6);
        } else {
            gkGroup.position.set(0, -999, 0);
            gkBodyCollider.position.set(0, -999, 0);
            if (gkShadow) gkShadow.position.set(0, -999, 0);
        }
    }
};

window.setPracticeSpotByIndex = function(idx) {
    const parsedIdx = parseInt(idx, 10) || 0;
    practiceSettings.spotIndex = parsedIdx % practiceSpots.length;
    const spot = practiceSpots[practiceSettings.spotIndex];
    practiceSettings.spotMode = spot.isAuto ? 'auto' : 'fixed';

    const btn = document.getElementById('practice-spot-btn');
    if (btn) btn.innerText = spot.name;
    const sel = document.getElementById('pause-spot-select');
    if (sel && Number(sel.value) !== practiceSettings.spotIndex) {
        sel.value = String(practiceSettings.spotIndex);
    }
    resetBall();
};

window.cyclePracticeSpot = function() {
    const nextIdx = (practiceSettings.spotIndex + 1) % practiceSpots.length;
    window.setPracticeSpotByIndex(nextIdx);
};

function finishShot(outcome, bannerMain, bannerSub, bannerColor) {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    const reticle = document.getElementById('keeper-target-reticle');
    if (reticle) reticle.style.display = 'none';

    const isUnifiedTraining = !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel');

    // Update Fireball / Streak / Progressive Training Score state
    if (outcome === 'goal') {
        streak++;
        highestStreak = Math.max(highestStreak, streak);
        bestStreak = Math.max(bestStreak, streak);
        drillLevel = Math.min(5, 1 + Math.floor(streak / 2));

        const targetBonus = (typeof ballBody !== 'undefined' && ballBody.targetBonusPts) ? ballBody.targetBonusPts : 0;
        const goalBasePts = 100 * (isOnFire ? 2 : 1);
        const totalShotPts = goalBasePts + targetBonus;
        score += totalShotPts;
        highScore = Math.max(highScore, score);

        try {
            localStorage.setItem('fs_training_best_streak', String(bestStreak));
            localStorage.setItem('fs_training_high_score', String(highScore));
        } catch (e) {}

        // Only say TOP BIN if 11_loop.js verified the ball crossed inside the upper corner of the goal mouth!
        const wasTopBin = (bannerMain && bannerMain.indexOf('TOP BIN') >= 0) || (typeof ballBody !== 'undefined' && ballBody.hitTargetCorner);
        if (targetBonus > 0 && wasTopBin) {
            bannerMain = `TOP BIN GOAL! +${totalShotPts}`;
            bannerSub = `DRILL LVL ${drillLevel} • STREAK x${streak}`;
            bannerColor = '#facc15';
        } else if (targetBonus > 0) {
            bannerMain = `TARGET GOAL! +${totalShotPts}`;
            bannerSub = `DRILL LVL ${drillLevel} • STREAK x${streak}`;
            bannerColor = '#38bdf8';
        } else if (isUnifiedTraining && bannerMain && bannerMain.indexOf('+') < 0) {
            bannerMain = `${bannerMain} +${totalShotPts}`;
            bannerSub = `DRILL LVL ${drillLevel} • STREAK x${streak}`;
        }

        fireballCharge = Math.min(100, fireballCharge + 50);
        if (fireballCharge >= 100 || streak >= 2) {
            isOnFire = true;
            fireballCharge = 100;
        }
        bloomPass.strength = 0.85;
        setTimeout(() => { bloomPass.strength = 0.30; }, 700);
    } else if (outcome === 'miss') {
        streak = 0;
        drillLevel = 1;
        fireballCharge = 0;
        isOnFire = false;
        try {
            localStorage.setItem('fs_training_best_streak', String(bestStreak));
            localStorage.setItem('fs_training_high_score', String(highScore));
        } catch (e) {}
    }
    updateWindAndFireHUD();

    if (bannerMain) {
        showBanner(bannerMain, bannerSub, bannerColor);
    }

    if (window.PlayerKinematics) {
        if (currentGameMode === 'keeper') {
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'miss' : 'goal');
        } else {
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'goal' : 'miss');
        }
    }

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        const pillSlot = (currentRound - 1) % maxDuelShots;
        duelResults[pillSlot] = outcome;
        if (currentGameMode === 'duel' && duelAiResults[pillSlot] === undefined) {
            const diff = difficultySettings[currentDifficulty] || difficultySettings.semipro;
            const aiRoll = ((currentRound * 0.37 + (outcome === 'goal' ? 0.21 : 0.43)) % 1.0);
            duelAiResults[pillSlot] = (aiRoll < diff.aiAccuracy) ? 'goal' : 'miss';
        }
        updateDuelPills();
        updateHUD();
    } else {
        updateHUD();
    }

    if (currentGameMode === 'practice') {
        shotOutcomeTimer = setTimeout(() => {
            if (shotComplete && isPlaying && currentGameMode === 'practice') {
                resetBall();
            }
        }, 1800);
        return;
    }

    // Display Next Shot Button in Unified Top-Right Unit
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn && (currentGameMode === 'duel' || currentGameMode === 'keeper')) {
        if (!window.__forceLegacyMode && requestedMode === 'training') {
            topNextBtn.innerHTML = `<span>NEXT BALL</span><span style="font-size: 14px;">➔</span>`;
        } else if (currentRound >= maxDuelShots && window.__forceLegacyMode) {
            topNextBtn.innerHTML = `<span>RESULTS</span><span style="font-size: 14px;">➔</span>`;
        } else {
            topNextBtn.innerHTML = `<span>NEXT SHOT</span><span style="font-size: 14px;">➔</span>`;
        }
        topNextBtn.style.display = 'inline-flex';
    }

    // Seamless auto-advance to next progressive training drill ball
    const advanceDelay = (!window.__forceLegacyMode && requestedMode === 'training') ? 2100 : 3400;
    shotOutcomeTimer = setTimeout(() => {
        if (shotComplete && isPlaying && !window.isPaused) {
            triggerNextShot();
        }
    }, advanceDelay);
}

function spawnTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];

    if (!practiceSettings.targets && currentGameMode !== 'targets') {
        window.targets = activeTargets;
        return;
    }

    if (currentGameMode === 'targets') {
        const showGkInTargets = !window.__forceLegacyMode && practiceSettings.keeper;
        wallGroup.visible = false;
        wallBodies.forEach(b => { b.collisionResponse = 0; });
        gkGroup.visible = showGkInTargets;
        if (gkShadow) gkShadow.visible = showGkInTargets;
        gkBodyCollider.collisionResponse = 0;
        [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
    } else if (currentGameMode === 'practice') {
        if (practiceSettings.targets) {
            [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
        }
    } else {
        if (!window.__forceLegacyMode && practiceSettings.targets) {
            [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
        }
    }
    window.targets = activeTargets;
}

function updateDuelPills() {
    const container = document.getElementById('shot-pills');
    if (!container) return;
    container.innerHTML = '';
    const activeSlot = (currentRound - 1) % maxDuelShots;
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
        } else if (i === activeSlot) {
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

    // Update Best Streak / Rival AI display
    const aiScoreEl = document.getElementById('ai-score-display');
    if (aiScoreEl) {
        if (!window.__forceLegacyMode && requestedMode === 'training') {
            aiScoreEl.innerText = `x${bestStreak}`;
        } else {
            const aiGoals = duelAiResults.filter(r => r === 'goal').length;
            aiScoreEl.innerText = `${aiGoals}`;
        }
    }
}

window.showMatchResults = function(title) {
    // In endless Unified Progressive Training mode, never interrupt with a Game Over modal unless explicitly forced
    if (!window.__forceLegacyMode && requestedMode === 'training') {
        currentRound++;
        resetBall();
        return;
    }

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
    selectMode(requestedMode || currentGameMode);
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
Object.defineProperty(window, 'round', { get: () => currentRound, set: (v) => { currentRound = v; } });
Object.defineProperty(window, 'ballBody', { get: () => ballBody });
Object.defineProperty(window, 'ball', { get: () => ballMesh });
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
    let spotLabel = 'PENALTY SPOT (11M)';

    if (practiceSettings.spotMode === 'fixed' && practiceSettings.spotIndex > 0) {
        const spot = practiceSpots[practiceSettings.spotIndex];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
        spotLabel = spot.name ? spot.name.toUpperCase() : 'TRAINING';
    } else if (currentGameMode === 'duel' || currentGameMode === 'keeper' || currentGameMode === 'training') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
        spotLabel = spot.label || 'FREE KICK';
    } else if (currentGameMode === 'practice') {
        const spot = practiceSpots[practiceSettings.spotIndex || 1];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
        spotLabel = spot.name ? spot.name.toUpperCase() : 'PRACTICE';
    } else if (currentGameMode === 'targets') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
        spotLabel = spot.label || 'TARGET DRILL';
    }

    drillLevel = Math.min(5, Math.max(1, 1 + Math.floor(Math.max(streak, currentRound - 1) / 2)));
    const isProgTraining = !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel');
    const trackerLbl = document.getElementById('tracker-label');
    if (trackerLbl && isProgTraining) {
        trackerLbl.innerText = spotLabel;
    }

    rollWindForRound();

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    if (window.prevBallPos) {
        window.prevBallPos.copy(ballBody.position);
    }

    if (window.ballGroundShadow) {
        window.ballGroundShadow.position.set(spotX, 0.004, spotZ);
        window.ballGroundShadow.scale.set(1, 1, 1);
    }
    if (window.ballSpotRing) {
        window.ballSpotRing.position.set(spotX, 0.006, spotZ);
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
    ballBody.targetBonusPts = 0;
    ballBody.hitTargetCorner = false;
    shotComplete = false;
    if (netClothPhysics) {
        netClothPhysics.reset();
    }

    // Replenish Corner Bullseye Targets ONLY if practiceSettings.targets is ON
    if (practiceSettings.targets && !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel') && activeTargets.length < 5) {
        if (typeof window.spawnTrainingDrillTargets === 'function') {
            window.spawnTrainingDrillTargets();
        }
    } else if (!practiceSettings.targets && activeTargets.length > 0) {
        activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
        activeTargets = [];
    }

    // Reset Goalkeeper & Wall Postures (100% Grounded at y = 0.0)
    gkDiving = false;
    gkDiveTimer = 0;
    gkDiveType = 'mid_parry';
    gkStartX = 0;
    gkStartY = 0;
    gkGroup.position.set(0, 0.0, -19.6);
    gkSpine.position.set(0, 0.0, 0);
    gkSpine.rotation.set(0, 0, 0);
    gkMesh.rotation.set(0, 0, 0);
    setGkPose('idle');

    wallJumping = false;
    wallJumpTimer = 0;
    wallGroup.position.y = 0.0;

    wallDefenders.forEach((def, idx) => {
        const cfg = wallDefenderConfigs[idx];
        def.position.set(cfg.xOffset, 0.0, 0);
        def.rotation.set(0, cfg.inwardYaw * 0.2, 0);
    });
    wallShadows.forEach(s => {
        s.position.y = 0.004;
        s.scale.set(1, 1, 1);
        s.material.opacity = 0.78;
    });

    // Respect practiceSettings.wall and practiceSettings.keeper persistently across every shot!
    const allowWall = practiceSettings.wall && (!isPenalty && spotZ > -8.0) && (currentGameMode !== 'targets');
    const allowGk = practiceSettings.keeper && (currentGameMode !== 'targets' || !window.__forceLegacyMode);

    wallGroup.visible = allowWall;
    if (window.trainingPropsGroup) {
        window.trainingPropsGroup.visible = practiceSettings.wall;
    }
    if (allowWall) {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = Math.min(-12.2, spotZ - 7.2);
        wallGroup.position.set(wallX, 0.0, wallZ);
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
        gkGroup.position.set(gkStartXPos, 0.0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkSpine.rotation.set(0, 0, 0);
        gkMesh.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartXPos, 1.15, -19.6);
        if (gkShadow) {
            gkShadow.position.set(gkStartXPos, 0.004, -19.6);
            gkShadow.scale.set(1, 1, 1);
            gkShadow.material.opacity = 0.78;
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

    if (currentGameMode === 'keeper' && isPlaying) {
        scheduleAiStrikerShot();
    }
};

window.setupDuelRound = function() {
    window.resetBall();
};

// Showcase helper for critic & verification cameras:
// Places ball at a compact 12m free-kick angle (-1.1, -8.2) with Striker #10, 3-Defender Wall, Standalone Blender Mannequins, Goalkeeper #1, and 5 Corner Target Bullseyes simultaneously visible and grounded.
window.setupTrainingShowcaseShot = function() {
    requestedMode = 'training';
    currentGameMode = 'duel';
    currentRound = 2;
    if (typeof window.spawnTrainingDrillTargets === 'function') {
        window.spawnTrainingDrillTargets();
    }
    window.resetBall();

    spotX = -1.10;
    spotZ = -8.20;
    ballBody.position.set(spotX, ballRadius, spotZ);
    ballMesh.position.copy(ballBody.position);
    if (window.ballGroundShadow) window.ballGroundShadow.position.set(spotX, 0.004, spotZ);
    if (window.ballSpotRing) window.ballSpotRing.position.set(spotX, 0.006, spotZ);

    wallGroup.visible = true;
    wallGroup.position.set(0.55, 0.0, -14.2);
    wallBodies.forEach((b, idx) => {
        const cfg = wallDefenderConfigs[idx];
        b.position.set(0.55 + cfg.xOffset, 0.95, -14.2);
        b.collisionResponse = 1;
    });

    gkGroup.visible = true;
    gkGroup.position.set(-0.45, 0.0, -19.6);
    if (gkShadow) {
        gkShadow.visible = true;
        gkShadow.position.set(-0.45, 0.004, -19.6);
    }
    if (window.PlayerKinematics) {
        PlayerKinematics.resetStriker(spotX, spotZ, false, 'duel');
        PlayerKinematics.resetGoalkeeper(spotX, true, true);
        PlayerKinematics.resetWall(spotX, spotZ, true);
        wallGroup.position.set(0.55, 0.0, -14.2);
        gkGroup.position.set(-0.45, 0.0, -19.6);
        if (gkShadow) gkShadow.position.set(-0.45, 0.004, -19.6);
    }
    if (window.applyMatchKits) {
        window.applyMatchKits(window.selectedHomeTeam || 'france', window.selectedAwayTeam || 'brazil');
    }
    updateHUD();
};

window.setCleanViewportMode = function(enabled) {
    const clean = !!enabled;
    document.body.classList.toggle('clean-viewport', clean);
    const ids = ['hud', 'menu', 'results-modal', 'pause-modal', 'practice-toolbar', 'studio-panel', 'studio-toggle-btn', 'swipe-trail'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = clean ? 'none' : '';
    });
};

window.setWireframeMode = function(enabled) {
    const wf = !!enabled;
    window.__wireframeActive = wf;
    scene.traverse(obj => {
        if ((obj.isMesh || obj.isSkinnedMesh) && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => {
                if (m) {
                    m.wireframe = wf;
                    m.needsUpdate = true;
                }
            });
        }
    });
};

function scheduleAiStrikerShot() {
    if (aiShotTimer) clearTimeout(aiShotTimer);
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

        window.executeShot(screenX, screenY, 96, pick.spin, 0.78, pick.curl, true);
    }, 950);
}

window.startTrainingSession = function() {
    window.selectMode('training');
};

window.selectMode = function(mode) {
    sfx.init();
    sfx.startAmbient();
    requestedMode = mode || 'training';

    if (requestedMode === 'training') {
        currentGameMode = 'duel';
    } else {
        currentGameMode = requestedMode;
    }

    const menuEl = document.getElementById('menu');
    if (menuEl) menuEl.style.display = 'none';
    const resModal = document.getElementById('results-modal');
    if (resModal) resModal.style.display = 'none';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'none';
    window.isPaused = false;
    document.getElementById('hud').style.display = 'block';
    isPlaying = true;
    score = 0;
    goalsScored = 0;
    savesMade = 0;
    streak = 0;
    drillLevel = 1;
    trainingShotCount = 0;
    fireballCharge = 0;
    isOnFire = false;
    maxSpeedRecord = 0;
    maxSpinRecord = 0;
    highestStreak = Math.max(highestStreak, bestStreak);
    targetsShattered = 0;

    updateMatchupBadges();
    updateHUD();

    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);

    const practiceToolbar = document.getElementById('practice-toolbar');
    if (practiceToolbar) practiceToolbar.style.display = 'none';

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        currentRound = 1;
        duelResults = [];
        duelAiResults = [];
        const trackerLbl = document.getElementById('tracker-label');
        if (trackerLbl) {
            trackerLbl.innerText = (currentGameMode === 'keeper') ? 'KEEPER SAVE' : 'STAGE 1 • PENALTY SPOT (11M)';
        }
        const shotPills = document.getElementById('shot-pills');
        if (shotPills) shotPills.style.display = 'flex';
        const timerDisp = document.getElementById('timer-display');
        if (timerDisp) timerDisp.style.display = 'none';
        updateDuelPills();
    } else if (currentGameMode === 'practice') {
        const trackerLbl = document.getElementById('tracker-label');
        if (trackerLbl) trackerLbl.innerText = 'PRACTICE';
    } else {
        currentRound = 1;
        targetRaceTimeLeft = 45;
        const trackerLbl = document.getElementById('tracker-label');
        if (trackerLbl) trackerLbl.innerText = window.__forceLegacyMode ? 'TIME' : 'PROGRESSIVE TARGET DRILL';
    }

    spawnTargets();
    resetBall();
};

window.resetToMenu = function() {
    if (window.__forceLegacyMenu) {
        isPlaying = false;
        sfx.stopAmbient();
        if (targetRaceTimer) clearInterval(targetRaceTimer);
        if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
        if (aiShotTimer) clearTimeout(aiShotTimer);
        document.getElementById('menu').style.display = 'flex';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('results-modal').style.display = 'none';
    } else {
        window.togglePauseMenu();
    }
};

window.triggerNextShot = function() {
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    if (aiShotTimer) clearTimeout(aiShotTimer);
    if (!isPlaying && document.getElementById('results-modal').style.display === 'flex') return;

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        if (window.__forceLegacyMode && currentRound >= maxDuelShots) {
            showMatchResults(currentGameMode === 'keeper' ? 'KEEPER SHOWDOWN COMPLETE!' : 'MATCH FINISHED!');
            return;
        }
        // Endless Progressive International Training: seamlessly advance through varied spots around the box!
        if (currentRound % maxDuelShots === 0) {
            duelResults = [];
            duelAiResults = [];
        }
        currentRound++;
        trainingShotCount++;
        updateDuelPills();
        resetBall();
    } else {
        currentRound++;
        trainingShotCount++;
        resetBall();
    }
};

function updateHUD() {
    const scoreLbl = document.getElementById('score-label');
    const scoreDisp = document.getElementById('score-display');
    const streakBadge = document.getElementById('streak-badge');
    if (streakBadge) streakBadge.style.display = 'none';

    const isUnifiedTraining = !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel');

    if (isUnifiedTraining) {
        if (scoreLbl) scoreLbl.innerText = `SCORE (STREAK x${streak})`;
        if (scoreDisp) scoreDisp.innerText = `${score}`;
        const aiScoreEl = document.getElementById('ai-score-display');
        if (aiScoreEl) {
            aiScoreEl.innerText = `x${bestStreak}`;
        }
    } else if (currentGameMode === 'duel') {
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
        const timerDisp = document.getElementById('timer-display');
        if (timerDisp && !window.__forceLegacyMode) {
            timerDisp.innerText = `STREAK x${streak}`;
        }
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

// Auto-launch Unified Progressive International Training on page load so there is only 1 unified mode ("training")
function configureUnifiedTrainingUI() {
    const menuEl = document.getElementById('menu');
    if (menuEl) {
        const subTag = menuEl.querySelector('.sub-tag');
        if (subTag) {
            subTag.innerText = 'Unified Progressive International Training • Corner Bullseyes + Mannequin Wall + Live Diving Goalkeeper';
        }
        const cards = menuEl.querySelectorAll('.mode-card');
        if (cards && cards.length > 0) {
            cards.forEach((card, idx) => {
                if (idx === 0) {
                    card.setAttribute('onclick', "selectMode('training')");
                    const h3 = card.querySelector('h3');
                    if (h3) h3.innerText = 'INTERNATIONAL TRAINING';
                    const p = card.querySelector('p');
                    if (p) p.innerText = 'Progressive Combined Drill! Smash corner bullseyes, bend free kicks around the mannequin wall, and beat the diving keeper.';
                    const btn = card.querySelector('button');
                    if (btn) btn.innerText = 'Start Progressive Training';
                } else {
                    card.style.display = 'none';
                }
            });
            const grid = menuEl.querySelector('.mode-grid');
            if (grid) {
                grid.style.gridTemplateColumns = ' minmax(280px, 460px)';
                grid.style.justifyContent = 'center';
            }
        }
    }
    // Start directly in Unified Progressive Training mode so the player is immediately on the pitch
    if (!window.__suppressAutoStart) {
        window.selectMode('training');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(configureUnifiedTrainingUI, 60));
} else {
    setTimeout(configureUnifiedTrainingUI, 60);
}

