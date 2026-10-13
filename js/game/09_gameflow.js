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

    const isUnifiedTraining = !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel');

    // Update Fireball / Streak / Progressive Training Score state
    if (outcome === 'goal') {
        streak++;
        highestStreak = Math.max(highestStreak, streak);
        bestStreak = Math.max(bestStreak, streak);
        drillLevel = Math.min(5, 1 + Math.floor(streak / 2));

        // In unified progressive training mode, check if shot also hit or passed through a corner bullseye ring
        let targetBonus = 0;
        let hitGoldenRing = false;
        if (activeTargets && activeTargets.length > 0 && typeof ballMesh !== 'undefined') {
            for (let i = 0; i < activeTargets.length; i++) {
                const t = activeTargets[i];
                if (!t.active) continue;
                const dx = ballMesh.position.x - t.mesh.position.x;
                const dy = ballMesh.position.y - t.mesh.position.y;
                const dist2D = Math.hypot(dx, dy);
                if (dist2D < (t.config.radius + ballRadius * 1.15)) {
                    t.active = false;
                    hitGoldenRing = !!t.isGolden;
                    const mult = isOnFire ? 2 : 1;
                    targetBonus = (hitGoldenRing ? 250 : 100) * mult;
                    targetsShattered++;
                    sfx.playShatter();
                    createShatterFX(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z, hitGoldenRing);
                    scene.remove(t.mesh);
                    world.removeBody(t.body);
                    activeTargets.splice(i, 1);
                    spawnRandomTarget();
                    break;
                }
            }
        }

        const goalBasePts = 100 * (isOnFire ? 2 : 1);
        const totalShotPts = goalBasePts + targetBonus;
        score += totalShotPts;
        highScore = Math.max(highScore, score);

        try {
            localStorage.setItem('fs_training_best_streak', String(bestStreak));
            localStorage.setItem('fs_training_high_score', String(highScore));
        } catch (e) {}

        if (targetBonus > 0) {
            bannerMain = `PERFECT TOP BINS! +${totalShotPts}`;
            bannerSub = `DRILL LVL ${drillLevel} • STREAK x${streak}`;
            bannerColor = '#facc15';
            if (window.spawnFloatingScorePopup && typeof ballMesh !== 'undefined') {
                window.spawnFloatingScorePopup(ballMesh.position.x, ballMesh.position.y + 0.25, -19.9, `+${totalShotPts} COMBO!`, '#facc15');
            }
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
            // In Keeper mode, 'goal' means the Keeper SAVED the shot; 'miss' means AI scored
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'miss' : 'goal');
        } else {
            PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'goal' : 'miss');
        }
    }

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        const pillSlot = (currentRound - 1) % maxDuelShots;
        duelResults[pillSlot] = outcome;
        // Simulate AI opponent's simultaneous round shot in 1v1 Duel
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
    const advanceDelay = (!window.__forceLegacyMode && requestedMode === 'training') ? 2200 : 3400;
    shotOutcomeTimer = setTimeout(() => {
        if (shotComplete && isPlaying) {
            triggerNextShot();
        }
    }, advanceDelay);
}

function spawnTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];

    if (currentGameMode === 'targets') {
        // Keep live Goalkeeper in goal alongside hanging corner Target Bullseyes for rich progressive drill visuals
        const showGkInTargets = !window.__forceLegacyMode;
        wallGroup.visible = false;
        wallBodies.forEach(b => { b.collisionResponse = 0; });
        gkGroup.visible = showGkInTargets;
        if (gkShadow) gkShadow.visible = showGkInTargets;
        gkBodyCollider.collisionResponse = 0;
        [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
    } else if (currentGameMode === 'practice') {
        wallGroup.visible = practiceSettings.wall;
        wallBodies.forEach(b => { b.collisionResponse = practiceSettings.wall ? 1 : 0; });
        gkGroup.visible = practiceSettings.keeper;
        if (gkShadow) gkShadow.visible = practiceSettings.keeper;
        gkBodyCollider.collisionResponse = 0;
        if (practiceSettings.targets) {
            [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
        }
    } else {
        // Unified Progressive International Training & Duel Mode:
        // Simultaneously spawn all 4 Corner Bullseye Targets (TL, TR, BL, BR) + 1 Golden Bullseye
        // together with the live Goalkeeper (#1) and Progressive Mannequin Wall!
        gkGroup.visible = true;
        if (gkShadow) gkShadow.visible = true;
        gkBodyCollider.collisionResponse = 0;
        if (!window.__forceLegacyMode) {
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

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
        spotLabel = spot.label || 'FREE KICK';
    } else if (currentGameMode === 'practice') {
        const spot = practiceSpots[practiceSettings.spotIndex];
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
    const trackerLbl = document.getElementById('tracker-label');
    if (trackerLbl && !window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel')) {
        trackerLbl.innerText = `DRILL LVL ${drillLevel} • ${spotLabel}`;
    }

    rollWindForRound();

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

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
    shotComplete = false;
    if (netClothPhysics) {
        netClothPhysics.reset();
    }

    // Replenish Corner Bullseye Targets in Unified Progressive Training mode if any were shattered
    if (!window.__forceLegacyMode && (requestedMode === 'training' || currentGameMode === 'duel') && activeTargets.length < 5) {
        if (typeof window.spawnTrainingDrillTargets === 'function') {
            window.spawnTrainingDrillTargets();
        }
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

    const allowWall = ((currentGameMode === 'duel' || currentGameMode === 'keeper') && (!isPenalty || spotZ >= -6.5)) ||
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel' || currentGameMode === 'keeper') ||
                    (currentGameMode === 'targets' && !window.__forceLegacyMode) ||
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    wallGroup.visible = allowWall;
    if (allowWall) {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = Math.min(-11.0, spotZ - 9.15);
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

    // If in Goalkeeper Showdown mode, schedule the AI Striker's shot automatically!
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

    // Compact hero staging so Overview, Close-Up, Low-Angle, and Wireframe cameras frame Striker + Ball + Wall + Keeper + Goal together
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
    const ids = ['hud', 'menu', 'results-modal', 'practice-toolbar', 'studio-panel', 'studio-toggle-btn', 'swipe-trail'];
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

window.startTrainingSession = function() {
    window.selectMode('training');
};

window.selectMode = function(mode) {
    sfx.init();
    sfx.startAmbient();
    requestedMode = mode || 'training';

    // Route 'training' into 'duel' engine so 11_loop.js runs full Goalkeeper + Wall + Striker kinematics
    // while keeping 'practice', 'targets', and 'keeper' compatible with legacy automated verification suites.
    if (requestedMode === 'training') {
        currentGameMode = 'duel';
    } else {
        currentGameMode = requestedMode;
    }

    document.getElementById('menu').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
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
    const aiVsBox = document.getElementById('ai-vs-box');

    if (currentGameMode === 'duel' || currentGameMode === 'keeper') {
        if (practiceToolbar) {
            practiceToolbar.style.display = (requestedMode === 'training') ? 'flex' : 'none';
        }
        if (aiVsBox) aiVsBox.style.display = (currentGameMode === 'duel') ? 'flex' : 'none';
        currentRound = 1;
        duelResults = [];
        duelAiResults = [];
        document.getElementById('tracker-label').innerText =
            (currentGameMode === 'keeper') ? 'KEEPER SAVE' : 'DRILL LVL 1 • PENALTY SPOT (11M)';
        document.getElementById('shot-pills').style.display = 'flex';
        document.getElementById('timer-display').style.display = 'none';
        updateDuelPills();
    } else if (currentGameMode === 'practice') {
        if (practiceToolbar) practiceToolbar.style.display = 'flex';
        if (aiVsBox) aiVsBox.style.display = 'none';
        document.getElementById('tracker-label').innerText = 'PRACTICE';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'none';
    } else {
        // 'targets' mode: Endless Progressive Target + Keeper Training (no forced Game Over interruption unless legacy override)
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        if (aiVsBox) aiVsBox.style.display = 'none';
        currentRound = 1;
        targetRaceTimeLeft = 45;
        document.getElementById('tracker-label').innerText = window.__forceLegacyMode ? 'TIME' : 'PROGRESSIVE TARGET DRILL';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'block';
        document.getElementById('timer-display').style.color = '#38bdf8';
        document.getElementById('timer-display').innerText = window.__forceLegacyMode ? '45s' : `STREAK x${streak}`;

        if (window.__forceLegacyMode) {
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
    // Single Unified Mode ('training'): instead of dropping to a multi-mode select screen,
    // immediately restart a fresh Progressive International Training session unless legacy menu is explicitly requested.
    if (window.__forceLegacyMenu) {
        document.getElementById('menu').style.display = 'flex';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('results-modal').style.display = 'none';
        const practiceToolbar = document.getElementById('practice-toolbar');
        if (practiceToolbar) practiceToolbar.style.display = 'none';
    } else {
        window.selectMode('training');
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

