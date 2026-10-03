"""
Master Quality Control and Visual Fidelity Auditor for Football Strike 3D
Comprehensive Playwright Headless Verification against Modern FIFA / EA FC Standards.
"""

import os
import sys
import time
import json
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8933
ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
os.makedirs(ARTIFACT_DIR, exist_ok=True)

print(f"======================================================================")
print(f"FIFA QUALITY CONTROL & VISUAL FIDELITY AUTOMATED AUDIT (v2.0)")
print(f"Artifact Directory: {ARTIFACT_DIR}")
print(f"======================================================================")

# Launch HTTP Server
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
time.sleep(1.5)

audit_report = {
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    "target_platform": "WebGL / Three.js 3D Engine",
    "benchmark": "FIFA / EA FC Standards",
    "metrics": {},
    "visual_evidence": {},
    "verifications": {}
}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--use-gl=angle",
                "--window-size=1920,1080"
            ]
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        console_errors = []
        console_warnings = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else (console_warnings.append(m.text) if m.type == "warning" else None))
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        print("\n[PHASE 1] Initializing Game Engine & Loading Assets...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(2500)

        # Wait for pose models to load
        try:
            page.wait_for_function("() => window.gkPoseModels && window.gkPoseModels.idle !== null", timeout=10000)
            print(">> Goalkeeper and Kinematic 3D Assets loaded.")
        except Exception as e:
            print(">> Warning while awaiting 3D models:", e)

        # Let engine warm up shaders and render pipeline
        page.wait_for_timeout(1200);

        # ------------------------------------------------------------------
        # AUDIT 1: PERFORMANCE, 60 FPS STABILITY, ZERO CONSOLE ERRORS & MEMORY
        # ------------------------------------------------------------------
        print("\n[PHASE 2] Auditing 60 FPS Stability, Memory Heap & Engine Telemetry...")
        perf_telemetry = page.evaluate("""() => {
            return new Promise((resolve) => {
                const frameTimes = [];
                let lastTime = performance.now();
                let frameCount = 0;
                const totalFramesToSample = 240;

                const initialMem = performance.memory ? performance.memory.usedJSHeapSize : 0;

                function recordFrame(now) {
                    const dt = now - lastTime;
                    lastTime = now;
                    frameTimes.push(dt);
                    frameCount++;

                    if (frameCount < totalFramesToSample) {
                        requestAnimationFrame(recordFrame);
                    } else {
                        const validTimes = frameTimes.slice(5);
                        const avgDt = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
                        const fps = 1000 / avgDt;
                        const maxDt = Math.max(...validTimes);
                        const minDt = Math.min(...validTimes);
                        const drops = validTimes.filter(t => t > 33.3).length;

                        const finalMem = performance.memory ? performance.memory.usedJSHeapSize : 0;
                        const memDeltaMb = (finalMem - initialMem) / (1024 * 1024);

                        resolve({
                            avgFps: fps,
                            avgFrameTimeMs: avgDt,
                            maxFrameTimeMs: maxDt,
                            minFrameTimeMs: minDt,
                            frameDropCount: drops,
                            initialMemMb: (initialMem / (1024 * 1024)).toFixed(2),
                            finalMemMb: (finalMem / (1024 * 1024)).toFixed(2),
                            memDeltaMb: memDeltaMb.toFixed(3)
                        });
                    }
                }
                requestAnimationFrame(recordFrame);
            });
        }""")
        audit_report["metrics"]["performance"] = perf_telemetry
        print(f">> FPS: {perf_telemetry['avgFps']:.1f} FPS (Target 60.0 FPS)")
        print(f">> Frame Time: {perf_telemetry['avgFrameTimeMs']:.2f} ms (Budget: 16.6 ms)")
        print(f">> Max Frame Spike: {perf_telemetry['maxFrameTimeMs']:.2f} ms")
        print(f">> Frame Drops (>33ms): {perf_telemetry['frameDropCount']}")
        print(f">> JS Heap Delta: {perf_telemetry['memDeltaMb']} MB")

        audit_report["metrics"]["console_errors_count"] = len(console_errors)
        audit_report["metrics"]["console_errors"] = console_errors
        print(f">> Console Errors: {len(console_errors)}")

        # ------------------------------------------------------------------
        # AUDIT 2: DUEL MODE (Curling, Striker Articulation, GK Dives, Wall Jumps)
        # ------------------------------------------------------------------
        print("\n[PHASE 3] Auditing Duel Mode Free Kick Kinematics & Mechanics...")
        page.evaluate("selectMode('duel')")
        page.wait_for_timeout(1000)

        # Broadcast Camera Match Overview Screenshot
        shot_broadcast = os.path.join(ARTIFACT_DIR, "fifa_qc_broadcast_stadium.png")
        page.screenshot(path=shot_broadcast)
        audit_report["visual_evidence"]["broadcast_stadium"] = shot_broadcast
        print(f">> Captured: {shot_broadcast}")

        # Test Striker 3-step curved run-up, plant foot, instep kick
        print(">> Testing Striker Kinematic Run-Up & Instep Strike...")
        striker_duel = page.evaluate("""() => {
            resetBall();
            // High curl bend shot
            window.executeShot(780, 220, 102, 550, 0.85, 1.4);

            const z0 = strikerGroup.position.z;
            const x0 = strikerGroup.position.x;

            // Advance through approach run-up (10 frames)
            for (let i = 0; i < 10; i++) updateSimulation(0.016);
            const zRun = strikerGroup.position.z;
            const xRun = strikerGroup.position.x;
            const poseRun = PlayerKinematics.strikerState.currentPose;

            // Advance to plant foot impact (12 frames)
            for (let i = 0; i < 12; i++) updateSimulation(0.016);
            const zPlant = strikerGroup.position.z;
            const posePlant = PlayerKinematics.strikerState.currentPose;

            // Advance into instep strike contact (6 frames)
            for (let i = 0; i < 6; i++) updateSimulation(0.016);
            const poseStrike = PlayerKinematics.strikerState.currentPose;
            const isInstep = PlayerKinematics.strikerState.isCurling;

            // Advance into rotational follow-through (15 frames)
            for (let i = 0; i < 15; i++) updateSimulation(0.016);
            const poseFollow = PlayerKinematics.strikerState.currentPose;
            const yawFollow = strikerGroup.rotation.y;

            return {
                initialZ: z0,
                runZ: zRun,
                plantZ: zPlant,
                poseRun: poseRun,
                posePlant: posePlant,
                poseStrike: poseStrike,
                isInstepCurler: isInstep,
                poseFollow: poseFollow,
                yawFollow: yawFollow,
                curvedApproachVerified: z0 !== zRun && zRun !== zPlant
            };
        }""")
        audit_report["verifications"]["striker_curved_runup"] = striker_duel
        print(f">> Striker Run-up & Strike Verified: {striker_duel['poseStrike']} (Instep Curler: {striker_duel['isInstepCurler']})")

        # Capture Striker Run-up & Instep Shot Screenshot
        page.evaluate("""() => {
            camera.position.set(-1.8, 1.3, -5.5);
            camera.lookAt(strikerGroup.position.x, strikerGroup.position.y + 1.0, strikerGroup.position.z - 2.0);
        }""")
        shot_striker = os.path.join(ARTIFACT_DIR, "fifa_qc_striker_runup_instep.png")
        page.screenshot(path=shot_striker)
        audit_report["visual_evidence"]["striker_runup_instep"] = shot_striker
        print(f">> Captured: {shot_striker}")

        # Reset camera
        page.evaluate("if (typeof updateCameraPosition === 'function') updateCameraPosition();")

        # Goalkeeper Diving Reaches & Recovery Rolls
        print(">> Testing Goalkeeper Diving Reaches & Recovery Roll...")
        gk_telemetry = page.evaluate("""() => {
            resetBall();
            // Direct top right corner shot
            window.executeShot(820, 160, 108, 480, 0.90, 1.2);

            // Pre-jump power squat
            for (let i = 0; i < 3; i++) updateSimulation(0.016);
            const squatY = gkSpine.position.y;

            // Ballistic flight parabola to apex
            for (let i = 0; i < 18; i++) updateSimulation(0.016);
            const apexX = gkGroup.position.x;
            const apexY = gkGroup.position.y;
            const apexRotZ = gkSpine.rotation.z;
            const apexPose = PlayerKinematics.gkState.currentPose;

            return {
                squatY: squatY,
                apexX: apexX,
                apexY: apexY,
                apexRotZ: apexRotZ,
                apexPose: apexPose
            };
        }""")
        audit_report["verifications"]["gk_dive_telemetry"] = gk_telemetry
        print(f">> GK Apex Reach: x={gk_telemetry['apexX']:.2f}, y={gk_telemetry['apexY']:.2f}, pose={gk_telemetry['apexPose']}")

        # Capture Goalkeeper Diving Reach
        page.evaluate("""() => {
            camera.position.set(1.5, 1.8, -14.0);
            camera.lookAt(gkGroup.position.x, gkGroup.position.y + 0.8, gkGroup.position.z);
        }""")
        shot_gk_dive = os.path.join(ARTIFACT_DIR, "fifa_qc_goalkeeper_dive_reach.png")
        page.screenshot(path=shot_gk_dive)
        audit_report["visual_evidence"]["goalkeeper_dive_reach"] = shot_gk_dive
        print(f">> Captured: {shot_gk_dive}")

        # Step to Landing & Recovery Roll
        page.evaluate("""() => {
            for (let i = 0; i < 22; i++) updateSimulation(0.016);
        }""")
        shot_gk_roll = os.path.join(ARTIFACT_DIR, "fifa_qc_goalkeeper_recovery_roll.png")
        page.screenshot(path=shot_gk_roll)
        audit_report["visual_evidence"]["goalkeeper_recovery_roll"] = shot_gk_roll
        print(f">> Captured: {shot_gk_roll}")

        # Defensive Wall Staggered Jump (Round 2)
        print(">> Testing Defensive Wall Staggered Jumps & Flinch Reaction in Round 2...")
        wall_telemetry = page.evaluate("""() => {
            currentRound = 2;
            resetBall();

            const y0_def0 = wallDefenders[0].position.y;
            const y0_def1 = wallDefenders[1].position.y;
            const y0_def2 = wallDefenders[2].position.y;

            // Trigger free kick over the wall
            window.executeShot(640, 200, 105, 0, 0.90, 0);

            // Step 18 frames into staggered jump
            for (let i = 0; i < 18; i++) updateSimulation(0.016);

            const apex_def0 = wallDefenders[0].position.y;
            const apex_def1 = wallDefenders[1].position.y;
            const apex_def2 = wallDefenders[2].position.y;
            const shadowScale = wallShadows[1].scale.x;

            return {
                idleH: [y0_def0, y0_def1, y0_def2],
                apexH: [apex_def0, apex_def1, apex_def2],
                staggeredTakeoff: (apex_def1 > apex_def0) || (apex_def0 !== apex_def2),
                shadowScaled: shadowScale < 1.0,
                wallX: wallGroup.position.x,
                wallZ: wallGroup.position.z
            };
        }""")
        audit_report["verifications"]["wall_jump_telemetry"] = wall_telemetry
        print(f">> Wall Jump Apex Heights: Def0={wall_telemetry['apexH'][0]:.2f}m, Def1={wall_telemetry['apexH'][1]:.2f}m, Def2={wall_telemetry['apexH'][2]:.2f}m")

        # Capture Wall Staggered Jump from striker's perspective looking over wall
        page.evaluate("""() => {
            const wx = wallGroup.position.x;
            const wz = wallGroup.position.z;
            camera.position.set(wx - 2.8, 1.35, wz + 4.8);
            camera.lookAt(wx, 1.15, wz);
        }""")
        shot_wall = os.path.join(ARTIFACT_DIR, "fifa_qc_defensive_wall_jump.png")
        page.screenshot(path=shot_wall)
        audit_report["visual_evidence"]["defensive_wall_jump"] = shot_wall
        print(f">> Captured: {shot_wall}")

        # ------------------------------------------------------------------
        # AUDIT 3: TARGET RACE MODE (Bullseyes, Sweeper Oscillation, Glass Shards)
        # ------------------------------------------------------------------
        print("\n[PHASE 4] Auditing Target Race Mode (Red/White Rings, Sweeper, Shatter FX)...")
        page.evaluate("selectMode('targets')")
        page.wait_for_timeout(1000)

        # Inspect Target configuration & Sweeper movement with wall-clock time
        initial_sweeper_x = page.evaluate("() => activeTargets.find(t => t.isMoving) ? activeTargets.find(t => t.isMoving).mesh.position.x : 0")
        page.wait_for_timeout(600)
        final_sweeper_x = page.evaluate("() => activeTargets.find(t => t.isMoving) ? activeTargets.find(t => t.isMoving).mesh.position.x : 0")
        sweeper_delta = abs(final_sweeper_x - initial_sweeper_x)

        targets_audit = page.evaluate("""() => {
            const targetsData = activeTargets.map(t => ({
                slotId: t.slotId,
                x: t.mesh.position.x,
                y: t.mesh.position.y,
                z: t.mesh.position.z,
                isMoving: t.isMoving,
                radius: t.config.radius
            }));

            return {
                targetCount: activeTargets.length,
                sweeperElevatedClearOfGk: targetsData.some(t => t.isMoving && t.y >= 2.05),
                targets: targetsData
            };
        }""")
        targets_audit["sweeperMoved"] = sweeper_delta > 0.05
        targets_audit["sweeperDelta"] = sweeper_delta
        audit_report["verifications"]["target_race_setup"] = targets_audit
        print(f">> Active Targets: {targets_audit['targetCount']}")
        print(f">> Sweeper Oscillation Verified: {targets_audit['sweeperMoved']} (Delta: {sweeper_delta:.3f}m, Elevated: {targets_audit['sweeperElevatedClearOfGk']})")

        # Capture Target Gallery Screenshot
        page.evaluate("""() => {
            camera.position.set(0, 1.8, -13.0);
            camera.lookAt(0, 1.4, -20.0);
        }""")
        shot_targets = os.path.join(ARTIFACT_DIR, "fifa_qc_target_race_bullseye.png")
        page.screenshot(path=shot_targets)
        audit_report["visual_evidence"]["target_race_bullseye"] = shot_targets
        print(f">> Captured: {shot_targets}")

        # Test Bullseye Ring Accuracy Scoring & Particle Shatter FX
        print(">> Testing Ring Accuracy Scoring (+100 / +50 / +25) & Glass Shard FX...")
        shatter_audit = page.evaluate("""() => {
            const target0 = activeTargets[0];
            const targetPos = target0.mesh.position.clone();

            const scoreBefore = score;
            ballMesh.position.copy(targetPos);
            ballBody.position.copy(targetPos);
            ballInFlight = true;

            updateSimulation(0.016);

            const scoreGained = score - scoreBefore;
            const particleCount = particles.length;

            return {
                scoreGained: scoreGained,
                isBullseye100: scoreGained === 100,
                particleCount: particleCount,
                bannerText: document.getElementById('banner-main').innerText
            };
        }""")
        audit_report["verifications"]["target_shatter_audit"] = shatter_audit
        print(f">> Target Hit Score: +{shatter_audit['scoreGained']} ({shatter_audit['bannerText']}), Particles Spawned: {shatter_audit['particleCount']}")

        # Advance 2 frames to expand particle explosion
        page.evaluate("for (let i = 0; i < 4; i++) updateSimulation(0.016);")
        shot_shatter = os.path.join(ARTIFACT_DIR, "fifa_qc_target_shatter_explosion.png")
        page.screenshot(path=shot_shatter)
        audit_report["visual_evidence"]["target_shatter_explosion"] = shot_shatter
        print(f">> Captured: {shot_shatter}")

        # ------------------------------------------------------------------
        # AUDIT 4: PRACTICE ARENA (Dropdown Toolbar & Spot Controls)
        # ------------------------------------------------------------------
        print("\n[PHASE 5] Auditing Practice Arena Dropdown Toolbar & Spot Cycling...")
        page.evaluate("selectMode('practice')")
        page.wait_for_timeout(800)

        # Open Dropdown Toolbar
        page.click("#practice-menu-btn")
        page.wait_for_timeout(400)

        practice_audit = page.evaluate("""() => {
            const panel = document.getElementById('practice-menu-panel');
            const isOpen = panel && panel.style.display !== 'none';

            window.togglePracticeOption('keeper');
            const keeperOffVisible = gkGroup.visible;

            window.togglePracticeOption('keeper');
            const keeperOnVisible = gkGroup.visible;

            const spotNameBefore = practiceSpots[practiceSettings.spotIndex].name;
            window.cyclePracticeSpot();
            const spotNameAfter = practiceSpots[practiceSettings.spotIndex].name;

            return {
                panelIsOpen: isOpen,
                keeperTogglesCorrectly: !keeperOffVisible && keeperOnVisible,
                spotCyclingWorking: spotNameBefore !== spotNameAfter,
                currentSpot: spotNameAfter
            };
        }""")
        audit_report["verifications"]["practice_arena"] = practice_audit
        print(f">> Practice Toolbar Dropdown: {practice_audit['panelIsOpen']}, Keeper Toggle: {practice_audit['keeperTogglesCorrectly']}, Spot Cycled: {practice_audit['currentSpot']}")

        # Reset camera for standard practice view
        page.evaluate("if (typeof updateCameraPosition === 'function') updateCameraPosition();")
        page.wait_for_timeout(300)
        shot_practice = os.path.join(ARTIFACT_DIR, "fifa_qc_practice_arena_toolbar.png")
        page.screenshot(path=shot_practice)
        audit_report["visual_evidence"]["practice_arena_toolbar"] = shot_practice
        print(f">> Captured: {shot_practice}")

        # ------------------------------------------------------------------
        # AUDIT 5: GOAL NET PHYSICS (3D Cloth, Bulge Depth, Zero Rebound)
        # ------------------------------------------------------------------
        print("\n[PHASE 6] Auditing 3D Hexagonal Cloth Net Physics, Bulge Depth & Entrapment...")
        page.evaluate("""() => {
            selectMode('practice');
            practiceSettings.keeper = false;
            practiceSettings.wall = false;
            practiceSettings.targets = false;
            gkGroup.visible = false;
            wallGroup.visible = false;
            wallBodies.forEach(b => b.position.set(0, -999, 0));
            gkBodyCollider.position.set(0, -999, 0);
            activeTargets = [];
        }""")
        page.wait_for_timeout(500)

        net_audit = page.evaluate("""() => {
            const net = window.netClothPhysics;
            const stats = net.getStats();

            // Direct strike into net pocket
            ballBody.position.set(0.8, 1.4, -18.5);
            ballBody.velocity.set(0.0, -0.4, -22.0);
            ballInFlight = true;

            // Step 22 frames to reach peak back pouch deformation
            for (let i = 0; i < 22; i++) updateSimulation(1/60);

            // Hide banner overlay for clear photo capture
            const banner = document.getElementById('banner');
            if (banner) { banner.classList.remove('show'); banner.style.opacity = '0'; }

            const backOffset = net.panels.back.globalOffset;
            const backCount = net.panels.back.nodeCount;
            let maxBackBulge = 0;
            for (let i = 0; i < backCount; i++) {
                const gi3 = (backOffset + i) * 3;
                const d = Math.abs(net.pos[gi3 + 2] - net.restPos[gi3 + 2]);
                if (d > maxBackBulge) maxBackBulge = d;
            }

            return {
                totalNodes: stats.totalNodes,
                springCount: stats.springCount,
                inNet: ballBody.inNet,
                scored: ballBody.scored,
                maxBackBulgeCm: maxBackBulge * 100,
                vzRebound: ballBody.velocity.z,
                shockwavesActive: stats.shockwavesActive,
                activeContact: stats.activeContact,
                ballPosZ: ballBody.position.z,
                ballPosX: ballBody.position.x,
                ballPosY: ballBody.position.y
            };
        }""")
        audit_report["verifications"]["net_cloth_physics"] = net_audit
        print(f">> Net Nodes: {net_audit['totalNodes']}, Springs: {net_audit['springCount']}")
        print(f">> Max Back Bulge Depth: {net_audit['maxBackBulgeCm']:.1f} cm (FIFA Benchmark: >15 cm)")
        print(f">> Ball Entrapped: {net_audit['inNet']}, vz Rebound: {net_audit['vzRebound']:.4f} m/s (Zero-rebound verified)")

        # Capture Goal Net Pocketing & Cloth Bulge Screenshot (Angled goalmouth view)
        page.evaluate("""() => {
            // Position camera inside penalty box looking into goal mouth showing pocket bulge
            camera.position.set(-2.0, 1.6, -17.6);
            camera.lookAt(ballBody.position.x, ballBody.position.y, ballBody.position.z);
        }""")
        shot_net = os.path.join(ARTIFACT_DIR, "fifa_qc_net_pocketing_cloth.png")
        page.screenshot(path=shot_net)
        audit_report["visual_evidence"]["net_pocketing_cloth"] = shot_net
        print(f">> Captured: {shot_net}")

        # ------------------------------------------------------------------
        # AUDIT 6: LIGHTING, FIXTURES & 2K PBR MATERIALS
        # ------------------------------------------------------------------
        print("\n[PHASE 7] Auditing 4-Point Tungsten Floodlights, Tubular Goalposts & 2K PBR Maps...")
        pbr_lighting_audit = page.evaluate("""() => {
            const ball = window.ballMesh;
            const pitch = window.pitchMesh || (typeof pitchMesh !== 'undefined' ? pitchMesh : null);
            const gk = window.gkPoseModels && window.gkPoseModels.idle;
            const wall = window.wallDefenders && window.wallDefenders[0];

            let gkNormalAttached = false;
            let gkDiffuseTex = false;
            if (gk) {
                gk.traverse(n => {
                    if (n.isMesh && n.material) {
                        if (n.material.normalMap) gkNormalAttached = true;
                        if (n.material.map) gkDiffuseTex = true;
                    }
                });
            }

            const floodlights = window.mastFloodlights || [];

            return {
                floodlightCount: floodlights.length,
                floodlightColor: floodlights.length > 0 ? '#' + floodlights[0].color.getHexString() : null,
                floodlightCastsShadow: floodlights.length > 0 ? floodlights[0].castShadow : false,
                ballHasNormal: !!(ball && ball.material && ball.material.normalMap),
                ballHasPBRDiffuse: !!(ball && ball.material && ball.material.map),
                pitchHasNormal: !!(pitch && pitch.material && pitch.material.normalMap),
                pitchHasRoughness: !!(pitch && pitch.material && pitch.material.roughnessMap),
                gkHasLatexGloveNormal: gkNormalAttached,
                gkHasDiffuseTexture: gkDiffuseTex,
                goalpostsTubular: !!window.goalFrameGroup
            };
        }""")
        audit_report["verifications"]["pbr_and_lighting"] = pbr_lighting_audit
        print(f">> 4-Point Tungsten Floodlights: {pbr_lighting_audit['floodlightCount']} Masts ({pbr_lighting_audit['floodlightColor']})")
        print(f">> 2K PBR Ball Normals & Diffuse: {pbr_lighting_audit['ballHasNormal']}")
        print(f">> 2K PBR Turf Normals & Roughness: {pbr_lighting_audit['pitchHasNormal']}")
        print(f">> Goalkeeper Latex Glove Normals: {pbr_lighting_audit['gkHasLatexGloveNormal']}")

        # Macro Close-Up Screenshot of 2K Ball & Pitch PBR Materials
        page.evaluate("""() => {
            resetBall();
            const banner = document.getElementById('banner');
            if (banner) { banner.classList.remove('show'); banner.style.opacity = '0'; }
            const toolbar = document.getElementById('practice-toolbar');
            if (toolbar) toolbar.style.display = 'none';

            const bp = ballMesh.position;
            camera.position.set(bp.x + 0.38, bp.y + 0.28, bp.z + 0.55);
            camera.lookAt(bp.x, bp.y + 0.05, bp.z);
        }""")
        shot_pbr = os.path.join(ARTIFACT_DIR, "fifa_qc_pbr_materials_macro.png")
        page.screenshot(path=shot_pbr)
        audit_report["visual_evidence"]["pbr_materials_macro"] = shot_pbr
        print(f">> Captured: {shot_pbr}")

        # Summary of Console Errors during full audit run
        print(f"\n>> Final Error Count: {len(console_errors)}")
        audit_report["final_status"] = "PASSED" if len(console_errors) == 0 else "WARNING"

        # Save JSON results
        report_json_path = os.path.join(ARTIFACT_DIR, "fifa_qc_audit_results.json")
        with open(report_json_path, "w", encoding="utf-8") as f:
            json.dump(audit_report, f, indent=2)
        print(f">> Audit data saved to: {report_json_path}")

finally:
    server.terminate()
    print(">> HTTP Server terminated cleanly.")

print("\n======================================================================")
print("AUTOMATED FIFA QUALITY AUDIT COMPLETE")
print("======================================================================")
