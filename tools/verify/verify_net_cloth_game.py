import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8917
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        print("[1] Loading Football Strike 3D with NetClothPhysics...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1500)

        # 1. Check window.NetClothPhysics and window.netClothPhysics existence
        net_status = page.evaluate("""() => {
            const hasClass = typeof window.NetClothPhysics === 'function';
            const instance = window.netClothPhysics;
            if (!instance) return { hasClass, instanceExists: false };
            const stats = instance.getStats();
            return {
                hasClass,
                instanceExists: true,
                totalNodes: stats.totalNodes,
                springCount: stats.springCount,
                seamCount: stats.seamCount,
                meshesCount: Object.keys(instance.meshes || {}).length,
                groupInGoal: !!instance.group.parent
            };
        }""")
        print("[2] Net Cloth Module Status:", net_status)
        assert net_status["hasClass"], "window.NetClothPhysics should be exposed"
        assert net_status["instanceExists"], "window.netClothPhysics should be instantiated"
        assert net_status["totalNodes"] >= 900, f"Should have >=900 cloth simulation nodes, got {net_status['totalNodes']}"
        assert net_status["springCount"] >= 5000, f"Should have >=5000 structural & shear springs, got {net_status['springCount']}"
        assert net_status["meshesCount"] == 4, "Should have 4 cloth net panels (back, roof, left, right)"

        # 2. Check Idle Wind Flutter in-browser
        print("[3] Testing in-browser idle wind flutter...")
        page.wait_for_timeout(1000)
        wind_telemetry = page.evaluate("""() => {
            const instance = window.netClothPhysics;
            let maxDisp = 0;
            for (let i = 0; i < instance.totalNodes; i++) {
                const d = Math.abs(instance.pos[i * 3 + 2] - instance.restPos[i * 3 + 2]);
                if (d > maxDisp) maxDisp = d;
            }
            return {
                maxDisplacementCm: maxDisp * 100,
                windBlend: instance.windBlend,
                activeContact: instance.activeContact
            };
        }""")
        print("[4] Idle Wind Telemetry:", wind_telemetry)
        assert 1.0 <= wind_telemetry["maxDisplacementCm"] <= 3.5, f"Wind flutter out of expected 1-3.5cm range: {wind_telemetry['maxDisplacementCm']}"

        # 3. Enter Practice Mode with clear path to net
        print("[5] Selecting Practice mode for unobstructed strike...")
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
        page.wait_for_timeout(800)

        # Launch an unobstructed direct strike into the goal net
        print("[6] Launching strike into net...")
        page.evaluate("""() => {
            ballBody.position.set(0.6, 1.4, -18.5);
            ballBody.velocity.set(0.0, -0.4, -22.0); // Entering net at x=0.6, y=1.35
            ballInFlight = true;
            // Step simulation 0.35s so ball enters goal and deforms the net pouch
            for (let i = 0; i < 22; i++) {
                updateSimulation(1/60);
            }
        }""")

        impact_telemetry = page.evaluate("""() => {
            const instance = window.netClothPhysics;
            const stats = instance.getStats();
            let maxBackBulge = 0;
            const backOffset = instance.panels.back.globalOffset;
            const backCount = instance.panels.back.nodeCount;
            for (let i = 0; i < backCount; i++) {
                const gi3 = (backOffset + i) * 3;
                const bulge = Math.abs(instance.pos[gi3 + 2] - instance.restPos[gi3 + 2]);
                if (bulge > maxBackBulge) maxBackBulge = bulge;
            }

            return {
                ballPos: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
                ballVel: { x: ballBody.velocity.x, y: ballBody.velocity.y, z: ballBody.velocity.z },
                ballSpeed: ballBody.velocity.length(),
                inNet: ballBody.inNet,
                scored: ballBody.scored,
                maxBackBulgeCm: maxBackBulge * 100,
                shockwavesActive: stats.shockwavesActive,
                activeContact: stats.activeContact
            };
        }""")
        print("[7] Shot & Impact Telemetry:", impact_telemetry)

        assert impact_telemetry["scored"], "Goal should be scored"
        assert impact_telemetry["inNet"], "Ball should be entrapped in net"
        assert impact_telemetry["maxBackBulgeCm"] >= 15.0, f"Net pouch should bulge outward (got {impact_telemetry['maxBackBulgeCm']} cm)"
        assert impact_telemetry["ballPos"]["z"] >= -22.45, f"Ball must not clip through back net (z = {impact_telemetry['ballPos']['z']})"
        assert impact_telemetry["ballVel"]["z"] <= 0.001, f"Zero rebound towards pitch (vz = {impact_telemetry['ballVel']['z']})"

        # Step simulation forward to let ball slide to rest on turf (25 frames ~0.4s)
        print("[8] Stepping simulation to verify turf rest...")
        turf_telemetry = page.evaluate("""() => {
            for (let i = 0; i < 30; i++) {
                updateSimulation(1/60);
            }
            const instance = window.netClothPhysics;
            return {
                ballY: ballBody.position.y,
                ballZ: ballBody.position.z,
                ballSpeed: ballBody.velocity.length(),
                restingOnTurf: instance.restingOnTurf,
                ballInFlight: ballInFlight
            };
        }""")
        print("[9] Turf Rest Telemetry:", turf_telemetry)
        assert abs(turf_telemetry["ballY"] - 0.22) <= 0.03, f"Ball should rest on turf (y = {turf_telemetry['ballY']})"
        assert turf_telemetry["ballSpeed"] < 0.1, f"Ball should be arrested (speed = {turf_telemetry['ballSpeed']})"

        # 4. Performance Benchmark inside Chrome Browser Canvas Loop (<2ms)
        print("[10] Running In-Browser Canvas Performance Benchmark (600 frames)...")
        perf_bench = page.evaluate("""() => {
            const instance = window.netClothPhysics;
            instance.stats.totalFrames = 0;
            instance.stats.totalTimeMs = 0;
            instance.stats.maxTimeMs = 0;

            const t0 = performance.now();
            for (let f = 0; f < 600; f++) {
                instance.update(1/60, ballBody, ballMesh);
            }
            const totalMs = performance.now() - t0;
            return {
                totalMs: totalMs,
                avgFrameMs: totalMs / 600,
                maxStepMs: instance.stats.maxTimeMs,
                totalNodes: instance.totalNodes,
                springCount: instance.springCount
            };
        }""")
        print("[11] In-Browser Benchmark:", perf_bench)
        assert perf_bench["avgFrameMs"] < 2.0, f"Average execution time {perf_bench['avgFrameMs']}ms exceeded 2.0ms budget"
        print(f"PASS: In-browser execution average: {perf_bench['avgFrameMs']:.3f} ms per frame (Budget < 2.0 ms)")

        # Verify no console errors
        print("[12] Console Errors:", errors)
        assert len(errors) == 0, f"Encountered unexpected console errors: {errors}"

        print("\n=======================================================")
        print("ALL IN-BROWSER PLAYWRIGHT VERIFICATION CHECKS PASSED!")
        print("=======================================================")

finally:
    server.terminate()
