// ============================================================================
// 12. MAIN RENDER, ANIMATION & ZERO-REBOUND PHYSICS LOOP
// ============================================================================
const clock = new THREE.Clock();

function updateSimulation(dt) {
    const time = clock.getElapsedTime();

    world.step(PHYSICS_STEP, dt, 8);
    updateCharacterAnimators(dt);

    // Camera Flashbulbs Animation
    cameraFlashes.forEach(f => {
        f.timer -= dt;
        if (f.timer <= 0) {
            f.mesh.material.opacity = 0.95;
            f.timer = 1.5 + Math.random() * 3.5;
        } else if (f.mesh.material.opacity > 0) {
            f.mesh.material.opacity = Math.max(0, f.mesh.material.opacity - dt * 4.0);
        }
    });

    // Subtle animated perimeter sponsor LED hoardings
    if (adTex) {
        adTex.offset.x = (adTex.offset.x + dt * 0.035) % 1.0;
    }

    // FIFA-Grade Player Kinematics (Striker Curved Approach, Wall Defending & Goalkeeper Parabolic Leap)
    if (window.PlayerKinematics) {
        PlayerKinematics.updateStriker(dt, time);
    }

    if (currentGameMode === 'duel' || currentGameMode === 'practice') {
        const isPenalty = (currentGameMode === 'duel' && currentRound === 1) || 
                          (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
        const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                          (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
        const allowGk = (currentGameMode === 'duel') || 
                        (currentGameMode === 'practice' && practiceSettings.keeper);

        if (window.PlayerKinematics) {
            if (allowWall) {
                PlayerKinematics.updateWall(dt, time, allowWall);
            }
            if (allowGk) {
                PlayerKinematics.updateGoalkeeper(dt, time, ballMesh, ballInFlight);
            }
        }

            // Check Goalkeeper Save Block
            if (ballInFlight && !ballBody.scored && !ballBody.saved) {
                const distGk = ballMesh.position.distanceTo(gkBodyCollider.position);
                if (distGk < 1.25 && Math.abs(ballMesh.position.z - (-19.6)) < 0.85) {
                    ballBody.saved = true;
                    streak = 0;
                    updateHUD();
                    sfx.playKeeperSave();
                    sfx.playGasp();

                    const diveDir = (gkTargetX >= gkGroup.position.x) ? 1 : -1;
                    ballBody.velocity.x = diveDir * (Math.abs(ballBody.velocity.x) + 4.2);
                    ballBody.velocity.y = Math.max(3.2, ballBody.velocity.y * -0.4 + 2.8);
                    ballBody.velocity.z = Math.abs(ballBody.velocity.z) * 0.18;
                    ballBody.angularVelocity.set(diveDir * 10, 5, 2);

                    finishShot('miss', 'SAVED', '', '#f59e0b');
                }
            }
        }

    // Moving Sweeper Bullseye Oscillation (Target Race Mode)
    if (currentGameMode === 'targets') {
        const diff = (typeof difficultySettings !== 'undefined' && difficultySettings[currentDifficulty]) 
            ? difficultySettings[currentDifficulty] 
            : { targetSpeedMult: 1.0 };
        const sweepSpeed = 2.2 * diff.targetSpeedMult;
        activeTargets.forEach(t => {
            if (t.isMoving && t.active) {
                const moveX = t.originX + Math.sin(time * sweepSpeed) * 1.6;
                t.mesh.position.x = moveX;
                t.body.position.x = moveX;
            }
        });
    }

    // Dynamic Net Deform & Spring Relaxation
    updateNetDeformation(dt);

    // Continuous 3D Magnus Aerodynamic Forces & Visual Vortex Trail
    if (ballInFlight && ballBody.position.z > -20.0 && !ballBody.inNet && !ballBody.saved) {
        // Magnus lateral force is applied inside the fixed physics step (ballBody.preStep).
        // High-speed visual aerodynamic ball spin (pentagons & hexagons whirl with spin)
        ballMesh.rotation.y += spinVector.y * dt;
        ballMesh.rotation.x += (ballBody.velocity.z / ballRadius) * dt * 0.45;

        // Subtle curved aerodynamic vapor trail particles highlighting the swerve
        if (Math.abs(currentShotMagnusAx) > 3.0 && Math.random() < 0.45) {
            spawnParticle(fxVaporGeo, fxMatVapor, ballMesh.position.x, ballMesh.position.y, ballMesh.position.z,
                -Math.sign(currentShotMagnusAx) * 0.5 + (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2, 0.3, 0.28, 16);
        }
    }

    // Target Race & Practice: Bullseye Collision Detection
    const checkTargets = currentGameMode === 'targets' || (currentGameMode === 'practice' && practiceSettings.targets);
    if (checkTargets && ballInFlight) {
        for (let i = 0; i < activeTargets.length; i++) {
            const t = activeTargets[i];
            if (!t.active) continue;
            const dist = ballMesh.position.distanceTo(t.mesh.position);
            if (dist < (t.config.radius + ballRadius * 0.85)) {
                t.active = false;
                const ringAccuracy = dist / (t.config.radius + ballRadius);
                let bannerTxt = 'OUTER RING! +25';
                let pts = 25;
                let bannerCol = '#ffffff';
                if (ringAccuracy < 0.35) {
                    bannerTxt = 'BULLSEYE! +100';
                    pts = 100;
                    bannerCol = '#dc2626';
                } else if (ringAccuracy < 0.68) {
                    bannerTxt = 'INNER RING! +50';
                    pts = 50;
                    bannerCol = '#fbbf24';
                }

                targetsShattered++;
                score += pts;
                updateHUD();

                sfx.playShatter();
                sfx.playCheer();
                createShatterFX(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z);
                showBanner(bannerTxt, pts === 100 ? 'PINPOINT STRIKE' : '', bannerCol);

                scene.remove(t.mesh);
                world.removeBody(t.body);
                activeTargets.splice(i, 1);
                spawnRandomTarget();

                ballBody.velocity.z *= 0.2;
                ballBody.velocity.x *= 0.5;
                if (currentGameMode === 'targets') {
                    setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 750);
                } else if (currentGameMode === 'practice') {
                    ballBody.scored = true;
                    finishShot('goal', bannerTxt, '', '#38bdf8');
                }
                break;
            }
        }
    }

    // Target Race: Auto-Reset on Miss / Low Speed
    if (currentGameMode === 'targets' && ballInFlight && (ballBody.position.z < -20.5 || (ballBody.position.z < -16 && ballBody.velocity.length() < 1.0))) {
        ballInFlight = false;
        streak = 0;
        updateHUD();
        setTimeout(() => {
            if (currentGameMode === 'targets' && isPlaying) resetBall();
        }, 650);
    }

    // ========================================================================
    // ZERO-REBOUND GOAL NET ENTRAPMENT & POSITIONAL HARD LOCK
    // ========================================================================
    const entersGoal = (ballBody.position.z <= -19.95 && ballBody.position.z >= -22.5 &&
                       Math.abs(ballBody.position.x) <= 3.70 && ballBody.position.y <= 2.50);

    if (entersGoal || ballBody.inNet) {
        ballBody.inNet = true;

        if (!ballBody.scored && !ballBody.saved) {
            ballBody.scored = true;
            goalsScored++;
            updateHUD();
            sfx.playNet();
            sfx.playCheer();
            slowMo = true;
            setTimeout(() => { slowMo = false; }, 600);
            triggerNetBillow(ballBody.position.x, ballBody.position.y);
            finishShot('goal', 'GOAL', '', '#22c55e');
        }

        if (netClothPhysics) {
            netClothPhysics.handleEntrapment(dt, ballBody);
            if (netClothPhysics.restingOnTurf || ballBody.position.y <= ballRadius + 0.02) {
                if (Math.hypot(ballBody.velocity.x, ballBody.velocity.z) < 0.05) {
                    ballInFlight = false;
                }
            }
        } else {
            // Heavy Viscous Net Cord Damping (Instant forward and lateral arrest)
            ballBody.velocity.x *= 0.65;
            ballBody.velocity.z *= 0.65;
            ballBody.angularVelocity.scale(0.5, ballBody.angularVelocity);

            // Net downward pocket gravity
            ballBody.velocity.y -= 22.0 * dt;

            // Hard Positional Lock: ZERO FORWARD ESCAPE, ZERO REBOUND
            if (ballBody.velocity.z > 0) {
                ballBody.velocity.z = 0;
            }
            if (ballBody.position.z > -20.25) {
                ballBody.position.z = -20.25;
            }
            if (ballBody.position.z < -21.85) {
                ballBody.position.z = -21.85;
                ballBody.velocity.z = 0;
            }
            ballBody.position.x = Math.max(-3.50, Math.min(3.50, ballBody.position.x));
            if (ballBody.position.y > 2.38) {
                ballBody.position.y = 2.38;
                ballBody.velocity.y = -1.5;
            }

            // Rest on turf inside net pocket
            if (ballBody.position.y <= ballRadius + 0.02) {
                ballBody.position.y = ballRadius;
                ballBody.velocity.set(0, 0, 0);
                ballBody.angularVelocity.set(0, 0, 0);
                ballInFlight = false;
            }
        }
    }

    // Duel & Practice: Check Off-Target Miss (passed goal plane without scoring or save)
    if ((currentGameMode === 'duel' || currentGameMode === 'practice') && ballInFlight && !ballBody.inNet && !ballBody.saved && !ballBody.scored) {
        if (ballBody.position.z < -20.05 || (ballBody.position.z < -13.0 && ballBody.velocity.length() < 0.25 && ballBody.position.y <= ballRadius + 0.05)) {
            streak = 0;
            updateHUD();
            sfx.playGasp();
            finishShot('miss', 'OFF TARGET', '', '#ef4444');
        }
    }

    // Realistic Turf Rolling Deceleration
    if (ballBody.position.y <= ballRadius + 0.05) {
        const hSpeed = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
        if (hSpeed > 0.01) {
            const decel = ballBody.inNet ? 8.5 : 4.5;
            const newSpeed = Math.max(0, hSpeed - decel * dt);
            const ratio = newSpeed / hSpeed;
            ballBody.velocity.x *= ratio;
            ballBody.velocity.z *= ratio;
            ballBody.angularVelocity.scale(ratio, ballBody.angularVelocity);
        } else {
            ballBody.velocity.x = 0;
            ballBody.velocity.z = 0;
            ballBody.angularVelocity.set(0, 0, 0);
            if (ballInFlight) {
                ballInFlight = false;
                if (!shotComplete && (currentGameMode === 'duel' || currentGameMode === 'practice')) {
                    finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
                } else if (currentGameMode === 'targets') {
                    setTimeout(() => {
                        if (currentGameMode === 'targets' && isPlaying) resetBall();
                    }, 650);
                }
            }
        }
    }

    ballMesh.position.copy(ballBody.position);
    if (!ballInFlight) ballMesh.quaternion.copy(ballBody.quaternion);

    // Subtle broadcast camera track: pan gently toward ball during flight
    if (ballInFlight && !slowMo) {
        const camLerpRate = dt * 1.2;
        const targetLookY = -0.25 + (ballMesh.position.y + 0.25) * 0.25;
        const targetLookX = ballMesh.position.x * 0.15;
        camera.lookAt(
            camera.position.x * 0.05 + targetLookX * (1 - 0.05),
            targetLookY,
            -20.0
        );
    }

    // Particle FX Update
    updateParticles(dt);

}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);
    updateSimulation(dt);
    composer.render();
}
animate();

window.stepSimulation = function(seconds) {
    const steps = Math.ceil(seconds / 0.016);
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) {
        updateSimulation(dt);
    }
    composer.render();
};

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    const pr = composer._pixelRatio || Math.min(window.devicePixelRatio, 2);
    fxaaPass.uniforms['resolution'].value.set(1.0 / (window.innerWidth * pr), 1.0 / (window.innerHeight * pr));
});

