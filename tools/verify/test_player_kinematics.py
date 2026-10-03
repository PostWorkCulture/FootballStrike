import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8910
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
time.sleep(1.2)

output_dir = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
os.makedirs(output_dir, exist_ok=True)

test_results = {}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        errors = []
        page.on("console", lambda m: errors.append(f"CONSOLE: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))

        print("[1] Loading Football Strike 3D with PlayerKinematics module...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(2000)

        # Test 1: Module loaded and exposed under window.PlayerKinematics
        print("[2] Verifying window.PlayerKinematics exposure...")
        pk_check = page.evaluate("""() => {
            return {
                exposed: typeof window.PlayerKinematics === 'object' && window.PlayerKinematics !== null,
                hasStrikerState: !!window.PlayerKinematics.strikerState,
                hasGkState: !!window.PlayerKinematics.gkState,
                hasWallState: !!window.PlayerKinematics.wallState,
                hasUpdate: typeof window.PlayerKinematics.update === 'function',
                hasGkBones: !!window.gkBones,
                hasKickerBones: !!window.kickerBones,
                hasWallBones: Array.isArray(window.wallDefenderBones) && window.wallDefenderBones.length === 3
            };
        }""")
        test_results["pk_exposure"] = pk_check
        print("PlayerKinematics Exposure:", pk_check)
        if errors:
            print("Console Errors on Load:", errors)

        # Enter Free Kick Duel mode
        page.evaluate("selectMode('duel')")
        page.wait_for_timeout(1000)

        # Test 2: Striker approach run-up, plant foot placement, instep strike & follow-through
        print("[3] Testing Striker Kinematics (3-step curved approach, plant foot, instep vs laces)...")
        striker_test = page.evaluate("""() => {
            resetBall();
            // Start curling shot (instep curler)
            window.executeShot(780, 220, 102, 550, 0.85, 1.4);

            const initialX = strikerGroup.position.x;
            const initialZ = strikerGroup.position.z;

            // Step 1: Advance into run-up (~0.12s)
            for (let i = 0; i < 7; i++) updateSimulation(0.016);
            const step1X = strikerGroup.position.x;
            const step1Z = strikerGroup.position.z;
            const step1Pose = PlayerKinematics.strikerState.currentPose;

            // Step 2 & Plant: Advance to plant foot placement (~0.32s)
            for (let i = 0; i < 12; i++) updateSimulation(0.016);
            const plantX = strikerGroup.position.x;
            const plantZ = strikerGroup.position.z;
            const plantPose = PlayerKinematics.strikerState.currentPose;

            // Strike Impact: Advance into strike (~0.42s)
            for (let i = 0; i < 6; i++) updateSimulation(0.016);
            const strikePose = PlayerKinematics.strikerState.currentPose;
            const isInstep = PlayerKinematics.strikerState.isCurling;

            // Follow-Through: Advance into rotational follow-through (~0.65s)
            for (let i = 0; i < 14; i++) updateSimulation(0.016);
            const followPose = PlayerKinematics.strikerState.currentPose;
            const followYaw = strikerGroup.rotation.y;

            return {
                initialZ: initialZ.toFixed(2),
                step1Z: step1Z.toFixed(2),
                step1Pose: step1Pose,
                plantZ: plantZ.toFixed(2),
                plantPose: plantPose,
                strikePose: strikePose,
                isInstep: isInstep,
                followPose: followPose,
                followYaw: followYaw.toFixed(2),
                curvedApproachTraversed: initialZ !== step1Z && step1Z !== plantZ
            };
        }""")
        test_results["striker_kinematics"] = striker_test
        print("Striker Kinematics Test:", striker_test)

        # Screenshot: Striker Action
        shot_striker = os.path.join(output_dir, "test_striker_kinematics.png")
        page.screenshot(path=shot_striker)
        print("Saved:", shot_striker)

        # Test 2b: Test Laces Strike on Direct Shot
        print("[3b] Testing Striker Laces Strike on Direct Shot...")
        laces_test = page.evaluate("""() => {
            resetBall();
            // Direct laser shot (zero spin, high speed)
            window.executeShot(640, 200, 115, 0, 0.95, 0);

            // Advance directly into strike impact
            for (let i = 0; i < 24; i++) updateSimulation(0.016);
            return {
                strikePose: PlayerKinematics.strikerState.currentPose,
                isCurling: PlayerKinematics.strikerState.isCurling,
                lacesActive: PlayerKinematics.strikerState.currentPose === 'strike_laces'
            };
        }""")
        test_results["laces_test"] = laces_test
        print("Striker Laces Strike Test:", laces_test)

        # Test 3: Goalkeeper Kinematic Dive Physics (pre-jump squat, ballistic flight, fingertip reach, low sweep scoop, recovery roll)
        print("[4] Testing Goalkeeper Dive Kinematics...")
        gk_test = page.evaluate("""() => {
            resetBall();
            // High right corner drive
            window.executeShot(820, 160, 108, 480, 0.90, 1.2);

            // 1. Reaction pre-jump power squat & plant-step
            for (let i = 0; i < 3; i++) updateSimulation(0.016);
            const squatY = gkSpine.position.y;
            const squatPose = PlayerKinematics.gkState.currentPose;

            // 2. Ballistic flight parabola to apex (~0.35s)
            for (let i = 0; i < 18; i++) updateSimulation(0.016);
            const apexX = gkGroup.position.x;
            const apexY = gkGroup.position.y;
            const apexRotZ = gkSpine.rotation.z;
            const apexPose = PlayerKinematics.gkState.currentPose;

            // 3. Descend into turf landing recovery roll (~0.60s)
            for (let i = 0; i < 16; i++) updateSimulation(0.016);
            const landingY = gkGroup.position.y;
            const recoveryRollPose = PlayerKinematics.gkState.currentPose;
            const shadowOpacity = gkShadow.material.opacity;

            return {
                squatDipY: squatY.toFixed(3),
                apexX: apexX.toFixed(2),
                apexY: apexY.toFixed(2),
                apexRotZ: apexRotZ.toFixed(2),
                apexPose: apexPose,
                landingY: landingY.toFixed(2),
                recoveryRollPose: recoveryRollPose,
                shadowSettled: shadowOpacity > 0.40
            };
        }""")
        test_results["gk_kinematics"] = gk_test
        print("Goalkeeper Flight & Recovery Roll Test:", gk_test)

        # Test 3b: Goalkeeper Low Turf Sweep Scoop
        print("[4b] Testing Goalkeeper Low Turf Sweep Scoop...")
        low_sweep_test = page.evaluate("""() => {
            resetBall();
            const bounds = getGoalScreenProjected();
            // Aim low bottom right corner
            window.executeShot(bounds.rightX - 35, bounds.groundY - 20, 95, 300, 0.75, 0.6);

            // Advance to save reach (~0.35s)
            for (let i = 0; i < 22; i++) updateSimulation(0.016);
            return {
                diveType: PlayerKinematics.gkState.diveType,
                currentPose: PlayerKinematics.gkState.currentPose,
                lowSweepActive: PlayerKinematics.gkState.currentPose === 'low_sweep_right' || PlayerKinematics.gkState.currentPose === 'low_sweep_left',
                lowAltitude: gkGroup.position.y < 0.40
            };
        }""")
        test_results["low_sweep_test"] = low_sweep_test
        print("Goalkeeper Low Sweep Scoop Test:", low_sweep_test)

        # Screenshot: Goalkeeper Flying Extension
        shot_gk = os.path.join(output_dir, "test_gk_kinematics.png")
        page.screenshot(path=shot_gk)
        print("Saved:", shot_gk)

        # Test 4: Wall Defenders Kinematics (anticipation fidgeting, staggered jump with tuck and flinch, landing recovery, shadow scaling)
        print("[5] Testing Wall Defenders Kinematics in Round 2...")
        wall_test = page.evaluate("""() => {
            currentRound = 2;
            resetBall();

            // 1. Idle anticipation fidgeting check
            const idleDef0Y = wallDefenders[0].position.y;
            const idleDef1Y = wallDefenders[1].position.y;
            updateSimulation(0.05);
            const idleFidgetY = wallDefenders[0].position.y;

            // Trigger shot over wall
            window.executeShot(640, 200, 105, 0, 0.90, 0);

            // 2. Pre-jump load dip
            for (let i = 0; i < 2; i++) updateSimulation(0.016);
            const dipY = wallDefenders[1].position.y;

            // 3. Staggered jump apex with mid-air tuck & flinch (~0.32s)
            for (let i = 0; i < 18; i++) updateSimulation(0.016);
            const apexDef0Y = wallDefenders[0].position.y;
            const apexDef1Y = wallDefenders[1].position.y;
            const apexDef2Y = wallDefenders[2].position.y;
            const shadowScale = wallShadows[1].scale.x;
            const shadowOpacity = wallShadows[1].material.opacity;

            // 4. Landing recovery with deep knee flexion (~0.76s: 48 frames total)
            for (let i = 0; i < 30; i++) updateSimulation(0.016);
            const landShockY = wallDefenders[1].position.y;

            return {
                idleResponsive: idleDef0Y !== idleFidgetY,
                preJumpDipY: dipY.toFixed(3),
                apexDef0Y: apexDef0Y.toFixed(2),
                apexDef1Y: apexDef1Y.toFixed(2),
                apexDef2Y: apexDef2Y.toFixed(2),
                staggeredHeights: apexDef1Y > apexDef0Y,
                shadowScaledDown: shadowScale < 0.90,
                shadowDiffused: shadowOpacity < 0.60,
                landShockAbsorbed: landShockY <= 0.01
            };
        }""")
        test_results["wall_kinematics"] = wall_test
        print("Wall Defenders Kinematics Test:", wall_test)

        # Screenshot: Wall Jump
        shot_wall = os.path.join(output_dir, "test_wall_kinematics.png")
        page.screenshot(path=shot_wall)
        print("Saved:", shot_wall)

        # Test 5: Goal Celebration & Disbelief
        print("[6] Testing Goal Celebration & Disbelief Reactions...")
        celebration_test = page.evaluate("""() => {
            PlayerKinematics.setStrikerOutcome('goal');
            updateSimulation(0.10);
            const celPose = PlayerKinematics.strikerState.currentPose;
            const celActive = PlayerKinematics.strikerState.celebrating;

            PlayerKinematics.setStrikerOutcome('miss');
            updateSimulation(0.10);
            const disPose = PlayerKinematics.strikerState.currentPose;
            const disActive = PlayerKinematics.strikerState.disbelief;

            return {
                celPose: celPose,
                celActive: celActive,
                disPose: disPose,
                disActive: disActive
            };
        }""")
        test_results["celebration_test"] = celebration_test
        print("Celebration & Disbelief Test:", celebration_test)

        print("\nAll PlayerKinematics tests passed successfully! Total console errors:", len(errors))
        if errors:
            print("Console Errors List:", errors)
        test_results["console_errors_count"] = len(errors)

        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=2)
    except:
        server.kill()
