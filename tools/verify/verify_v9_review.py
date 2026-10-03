import os
import sys
import time
import subprocess
import json
from playwright.sync_api import sync_playwright

PORT = 8901
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
time.sleep(1.2)

output_dir = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))

results = {}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        print("[1] Loading Football Game...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(2000)

        # Wait for goalkeeper poses to load
        try:
            page.wait_for_function("() => window.gkPoseModels && window.gkPoseModels.idle !== null", timeout=8000)
            print("[1b] Goalkeeper models successfully loaded!")
        except Exception as e:
            print("[Warning] Timeout waiting for GK models:", e)

        # Verification 1: Check Hint Bar Removal
        hint_bar_present = page.evaluate("() => document.getElementById('hint-bar') !== null")
        results["hint_bar_present"] = hint_bar_present
        print(f"[Verification 1] Hint bar present in DOM: {hint_bar_present} (Expected: False)")

        # Verification 2: Check Difficulty Selector
        diff_info = page.evaluate("""() => {
            const sel = document.getElementById('difficulty-select');
            if (!sel) return null;
            return {
                exists: true,
                value: sel.value,
                options: Array.from(sel.options).map(o => o.value)
            };
        }""")
        results["difficulty_select"] = diff_info
        print(f"[Verification 2] Difficulty selector: {diff_info}")

        # Verification 3: Enter Duel mode & check Goalkeeper stance
        page.evaluate("selectMode('duel')")
        page.wait_for_timeout(1000)

        # Screenshot Match View
        shot1_path = os.path.join(output_dir, "v9_duel_match_view.png")
        page.screenshot(path=shot1_path)
        print(f"[Screenshot 1] Saved: {shot1_path}")

        # Verification 4: Test Goalkeeper Dive Reach & Pose Switching
        gk_dive_test = page.evaluate("""() => {
            resetBall();
            // Aim high right corner
            window.executeShot(820, 180, 105, 500, 0.90, 1.2);
            
            // Advance simulation to peak of dive (~0.35s)
            for (let i = 0; i < 22; i++) {
                updateSimulation(1/60);
            }

            const poses = window.gkPoseModels || {};
            return {
                gkDiving: window.gkDiving,
                gkDiveType: window.gkDiveType,
                idleVisible: poses['idle'] ? poses['idle'].visible : false,
                diveRightVisible: poses['dive_right'] ? poses['dive_right'].visible : false,
                diveLeftVisible: poses['dive_left'] ? poses['dive_left'].visible : false,
                parryVisible: poses['parry'] ? poses['parry'].visible : false,
                gkPosX: gkGroup.position.x.toFixed(2),
                gkPosY: gkGroup.position.y.toFixed(2),
                gkRotZ: gkSpine.rotation.z.toFixed(2)
            };
        }""")
        results["gk_dive_test"] = gk_dive_test
        print(f"[Verification 4] GK Dive Pose Test: {gk_dive_test}")

        shot2_path = os.path.join(output_dir, "v9_gk_dive_right_reach.png")
        page.screenshot(path=shot2_path)
        print(f"[Screenshot 2] Saved: {shot2_path}")

        # Reset and check Dive Left
        gk_left_test = page.evaluate("""() => {
            resetBall();
            // Aim high left corner
            window.executeShot(460, 180, 105, -500, 0.90, -1.2);
            for (let i = 0; i < 22; i++) {
                updateSimulation(1/60);
            }
            const poses = window.gkPoseModels || {};
            return {
                gkDiving: window.gkDiving,
                diveLeftVisible: poses['dive_left'] ? poses['dive_left'].visible : false
            };
        }""")
        results["gk_left_test"] = gk_left_test
        print(f"[Verification 4b] GK Dive Left Test: {gk_left_test}")

        # Verification 5: Enter Practice Mode & Test Dropdown Options
        page.evaluate("selectMode('practice')")
        page.wait_for_timeout(800)

        # Open Drill Options Dropdown
        page.click("#practice-menu-btn")
        page.wait_for_timeout(500)

        practice_ui = page.evaluate("""() => {
            const panel = document.getElementById('practice-menu-panel');
            return {
                panelVisible: panel && panel.style.display !== 'none',
                wallActive: document.getElementById('toggle-wall-btn').classList.contains('active'),
                keeperActive: document.getElementById('toggle-keeper-btn').classList.contains('active'),
                targetsActive: document.getElementById('toggle-targets-btn').classList.contains('active')
            };
        }""")
        results["practice_ui"] = practice_ui
        print(f"[Verification 5] Practice Menu Dropdown: {practice_ui}")

        shot3_path = os.path.join(output_dir, "v9_practice_dropdown_open.png")
        page.screenshot(path=shot3_path)
        print(f"[Screenshot 3] Saved: {shot3_path}")

        # Verification 6: Enter Target Race Mode & Test Red & White Targets
        page.evaluate("selectMode('targets')")
        page.wait_for_timeout(800)

        target_info = page.evaluate("""() => {
            return {
                activeTargetsCount: activeTargets.length,
                targets: activeTargets.map(t => ({
                    x: t.mesh.position.x.toFixed(2),
                    y: t.mesh.position.y.toFixed(2),
                    z: t.mesh.position.z.toFixed(2),
                    isMoving: t.isMoving,
                    hasCables: t.cables ? t.cables.length : 0
                }))
            };
        }""")
        results["target_info"] = target_info
        print(f"[Verification 6] Targets Info: {target_info}")

        shot4_path = os.path.join(output_dir, "v9_red_white_bullseye_targets.png")
        page.screenshot(path=shot4_path)
        print(f"[Screenshot 4] Saved: {shot4_path}")

        # Test hitting a bullseye
        hit_target_test = page.evaluate("""() => {
            const initialScore = score;
            const initialShattered = targetsShattered;
            const target0 = activeTargets[0];
            
            // Teleport ball right onto target0
            ballMesh.position.copy(target0.mesh.position);
            ballBody.position.copy(target0.mesh.position);
            ballInFlight = true;
            
            // Advance 1 frame to trigger collision detection
            updateSimulation(1/60);
            
            return {
                initialScore: initialScore,
                finalScore: score,
                initialShattered: initialShattered,
                finalShattered: targetsShattered,
                targetHit: !target0.active,
                particlesSpawned: activeParticleCount() > 0
            };
        }""")
        results["hit_target_test"] = hit_target_test
        print(f"[Verification 6b] Bullseye Hit & Scoring Test: {hit_target_test}")

        shot5_path = os.path.join(output_dir, "v9_bullseye_shatter_fx.png")
        page.screenshot(path=shot5_path)
        print(f"[Screenshot 5] Saved: {shot5_path}")

        results["console_errors"] = errors
        print(f"[Console Errors] Total: {len(errors)}")
        if errors:
            print("Errors list:", errors)

        with open(os.path.join(output_dir, "v9_verification_results.json"), "w") as f:
            json.dump(results, f, indent=2)

        browser.close()

finally:
    server.terminate()
    server.wait()
