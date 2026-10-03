import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8905
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

        print("[1] Loading game...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1500)

        # Enter Free Kick Duel
        page.evaluate("() => selectMode('duel')")
        page.wait_for_function("() => window.gkBones && window.kickerBones && wallDefenderBones.length === 3", timeout=12000)
        print("[2] All 5 SkinnedMesh character armatures loaded and bound successfully!")

        # 1. Verify Striker and Goalkeeper in Idle Stance
        status_idle = page.evaluate("""() => {
            return {
                strikerVisible: kickerGroup.visible,
                strikerBones: !!window.kickerBones,
                gkBones: !!window.gkBones,
                wallBonesCount: wallDefenderBones.length,
                gkHeadRotY: window.gkBones.head.rotation.y,
                gkHeadRotX: window.gkBones.head.rotation.x,
                strikerRootY: window.kickerBones.root.position.y
            };
        }""")
        print("[3] Character Armatures Status:", status_idle)

        # Screenshot 1: Match View with Striker and Goalkeeper
        shot1 = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_fifa_kinematics_shot1.png")
        page.screenshot(path=shot1)
        print("Saved:", shot1)

        # 2. Test Head Tracking Inverse Kinematics
        print("[4] Testing Head Tracking IK...")
        head_ik_test = page.evaluate("""() => {
            // Move ball to far left
            ballMesh.position.set(-3.5, 1.8, -12.0);
            updateSimulation(0.016);
            const headLeftY = window.gkBones.head.rotation.y;

            // Move ball to far right
            ballMesh.position.set(3.5, 1.8, -12.0);
            updateSimulation(0.016);
            const headRightY = window.gkBones.head.rotation.y;

            // Reset ball back to spot
            resetBall();

            return {
                headLeftY: headLeftY.toFixed(3),
                headRightY: headRightY.toFixed(3),
                ikResponsive: headLeftY !== headRightY
            };
        }""")
        print("Head Tracking IK Result:", head_ik_test)

        # 3. Test Striker Strike Animation
        print("[5] Testing Striker Strike Animation...")
        strike_test = page.evaluate("""() => {
            resetBall();
            // Trigger shot
            window.executeShot(750, 250, 98, 450, 0.85, 1.2);
            
            // Advance 0.08s into strike (leg swinging through)
            for (let i = 0; i < 5; i++) updateSimulation(0.016);
            
            return {
                kicking: kickerKicking,
                rightThighRotX: window.kickerBones.rightThigh.rotation.x.toFixed(3),
                rightKneeRotX: window.kickerBones.rightKnee.rotation.x.toFixed(3)
            };
        }""")
        print("Striker Strike Test:", strike_test)

        # Screenshot 2: Striker Kicking Action
        shot2 = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_fifa_kinematics_shot2.png")
        page.screenshot(path=shot2)
        print("Saved:", shot2)

        # 4. Test Goalkeeper Full Wing-Span Flying Dive
        print("[6] Advancing simulation into flying dive apex...")
        gk_dive_test = page.evaluate("""() => {
            // Advance into flight apex (~0.35s)
            for (let i = 0; i < 20; i++) updateSimulation(0.016);
            return {
                gkX: gkGroup.position.x.toFixed(2),
                gkY: gkGroup.position.y.toFixed(2),
                leadShoulderZ: window.gkBones.rightShoulder.rotation.z.toFixed(2),
                leadElbowX: window.gkBones.rightElbow.rotation.x.toFixed(2),
                trailKneeX: window.gkBones.leftKnee.rotation.x.toFixed(2)
            };
        }""")
        print("Goalkeeper Full Dive Extension:", gk_dive_test)

        # Screenshot 3: Goalkeeper Flying Extension
        shot3 = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_fifa_kinematics_shot3.png")
        page.screenshot(path=shot3)
        print("Saved:", shot3)

        # 5. Test Wall Defenders Jumping in Round 2 (Round 2 has 3-man wall)
        print("[7] Testing Round 2 Wall Defender Staggered Jump...")
        wall_test = page.evaluate("""() => {
            currentRound = 2;
            resetBall();
            // Execute shot over wall
            window.executeShot(640, 220, 105, 0, 0.90, 0);

            // Advance into wall jump
            for (let i = 0; i < 15; i++) updateSimulation(0.016);

            return {
                def0KneeX: wallDefenderBones[0].leftKnee.rotation.x.toFixed(2),
                def1KneeX: wallDefenderBones[1].leftKnee.rotation.x.toFixed(2),
                def2KneeX: wallDefenderBones[2].leftKnee.rotation.x.toFixed(2),
                def0Y: wallDefenders[0].position.y.toFixed(2),
                def1Y: wallDefenders[1].position.y.toFixed(2),
                def2Y: wallDefenders[2].position.y.toFixed(2)
            };
        }""")
        print("Wall Defenders Articulated Jump:", wall_test)

        # Screenshot 4: Wall Jump
        shot4 = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_fifa_kinematics_shot4.png")
        page.screenshot(path=shot4)
        print("Saved:", shot4)

        print("\nAll tests completed. Total console errors:", len(errors))
        if errors:
            print("Console Errors List:", errors)

        browser.close()
finally:
    server.terminate()
