import subprocess
import time
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))

def log(msg):
    try:
        print(msg, flush=True)
    except Exception:
        print(msg.encode('ascii', 'replace').decode('ascii'), flush=True)

# 1. Start clean local HTTP server
log("[STEP 1] Starting clean HTTP server on port 8888...")
server_proc = subprocess.Popen([sys.executable, "-m", "http.server", "8888"], cwd=os.path.dirname(os.path.abspath(__file__)))
time.sleep(1.0)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        log("[STEP 2] Navigating to http://localhost:8888/index.html ...")
        page.goto("http://localhost:8888/index.html")
        page.wait_for_timeout(800)

        # -------------------------------------------------------------
        # TEST 1: ENTER PRACTICE ARENA & VERIFY PENALTY SPOT & CAMERA
        # -------------------------------------------------------------
        log("[STEP 3] Entering Practice Arena...")
        page.click("text=PRACTICE ARENA")
        page.wait_for_timeout(1000)

        # Check Spot name and position
        spot_name = page.locator("#practice-spot-btn").inner_text()
        log(f"Current Practice Spot: {spot_name}")

        # Check telemetry / ball coordinates from game state
        ball_pos = page.evaluate("() => ({ x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z })")
        cam_pos = page.evaluate("() => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov })")
        log(f"Ball Position: {ball_pos}")
        log(f"Camera: {cam_pos}")
        assert abs(ball_pos['z'] - (-9.0)) < 0.1, f"Ball should be at z = -9.0 (11m from goal), got {ball_pos['z']}"
        assert cam_pos['fov'] == 38, f"Camera FOV should be 38, got {cam_pos['fov']}"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_01_penalty_spot_inside_box.png"))
        log("Captured: v7_01_penalty_spot_inside_box.png (Penalty spot inside 18-yard box, hero camera framing)")

        # -------------------------------------------------------------
        # TEST 2: TOGGLE OFF WALL AND KEEPER IN PRACTICE MODE
        # -------------------------------------------------------------
        log("[STEP 4] Toggling OFF Wall, Keeper, and Targets (Pure Open Net)...")
        # Toggle Targets OFF
        page.click("#toggle-targets-btn")
        page.wait_for_timeout(300)
        # Toggle Wall OFF
        page.click("#toggle-wall-btn")
        page.wait_for_timeout(300)
        # Toggle Keeper OFF
        page.click("#toggle-keeper-btn")
        page.wait_for_timeout(300)

        wall_btn_text = page.locator("#toggle-wall-btn").inner_text()
        gk_btn_text = page.locator("#toggle-keeper-btn").inner_text()
        log(f"Wall: {wall_btn_text} | Keeper: {gk_btn_text}")

        # Verify physics bodies moved to y = -999
        wall_y = page.evaluate("() => wallBodies[0].position.y")
        gk_y = page.evaluate("() => gkBodyCollider.position.y")
        log(f"Wall body Y: {wall_y}, GK collider Y: {gk_y}")
        assert wall_y < -900, f"Wall body should be below -900, got {wall_y}"
        assert gk_y < -900, f"GK collider should be below -900, got {gk_y}"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_02_practice_wall_and_keeper_off.png"))
        log("Captured: v7_02_practice_wall_and_keeper_off.png")

        # -------------------------------------------------------------
        # TEST 3: SHOOT TOWARDS OPEN NET & VERIFY SCORING WITHOUT BUGS
        # -------------------------------------------------------------
        log("[STEP 5] Swiping shot into empty net...")
        # Swipe from center bottom towards mid-goal
        page.mouse.move(640, 580)
        page.mouse.down()
        for i in range(1, 10):
            page.mouse.move(640, 580 - i * 22)
            time.sleep(0.015)
        page.mouse.up()

        # Wait for shot to complete (goal scored in net)
        page.wait_for_function("() => ballBody.scored === true", timeout=12000)
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_03_practice_scored_open_net.png"))

        banner_main = page.locator("#banner-main").inner_text()
        banner_sub = page.locator("#banner-sub").inner_text()
        stat_speed = page.locator("#stat-speed").inner_text()
        log(f"Shot Result: {banner_main} ({banner_sub}) at {stat_speed}")

        # Ensure NO wall block occurred!
        assert "BLOCKED" not in banner_main, "Shot was blocked by invisible wall!"
        assert banner_main == "GOAL!", f"Expected GOAL!, got {banner_main}"
        log("Captured: v7_03_practice_scored_open_net.png (GOAL scored cleanly in empty net!)")

        # -------------------------------------------------------------
        # TEST 4: CYCLE SPOTS IN PRACTICE MODE
        # -------------------------------------------------------------
        log("[STEP 6] Testing Spot Cycling (Center Free Kick, Angles, Long Range)...")
        page.wait_for_timeout(1000)
        page.click("#practice-spot-btn")
        page.wait_for_timeout(600)
        spot_name_2 = page.locator("#practice-spot-btn").inner_text()
        log(f"Cycled to: {spot_name_2}")

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_04_practice_spot_cycled.png"))
        log("Captured: v7_04_practice_spot_cycled.png")

        # -------------------------------------------------------------
        # TEST 5: FREE KICK DUEL WITH KEEPER & PRO WALL RIG
        # -------------------------------------------------------------
        log("[STEP 7] Returning to Menu and entering Free Kick Duel...")
        page.click("text=Exit Menu")
        page.wait_for_timeout(600)

        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(1000)

        # Round 1 is Penalty Kick (11m, keeper only, no wall)
        r1_banner = page.locator("#round-tracker").inner_text()
        log(f"Round 1 Tracker: {r1_banner}")
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_05_duel_round_1_penalty.png"))
        log("Captured: v7_05_duel_round_1_penalty.png (Round 1: Penalty Spot inside box against Goalkeeper)")

        # Shoot Round 1
        log("Taking shot in Round 1...")
        page.mouse.move(640, 580)
        page.mouse.down()
        for i in range(1, 10):
            page.mouse.move(640 + i * 14, 580 - i * 22) # angled top-right
            time.sleep(0.015)
        page.mouse.up()

        # Wait for shot outcome & next shot button
        page.wait_for_selector("#next-round-btn", state="visible", timeout=12000)
        next_btn = page.locator("#next-round-btn")
        btn_text = next_btn.inner_text().strip()
        log(f"Next Round Button Visible: '{btn_text}'")

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_06_next_shot_button_active.png"))
        log("Captured: v7_06_next_shot_button_active.png (Premier gold Next Shot button)")

        # Click Next Shot Button
        log("Clicking Next Shot button...")
        next_btn.click()
        page.wait_for_timeout(1000)

        # Round 2 has 3-man wall outside 18-yard box
        r2_ball_pos = page.evaluate("() => ({ x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z })")
        log(f"Round 2 Ball Position: {r2_ball_pos}")
        assert r2_ball_pos['z'] > -3.5, f"Round 2 ball should be outside 18-yard box (z > -3.5), got {r2_ball_pos['z']}"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "v7_07_round_2_wall_outside_box.png"))
        log("Captured: v7_07_round_2_wall_outside_box.png (Round 2: Free kick outside box with defensive wall)")

        log("ALL TESTS COMPLETED SUCCESSFULLY!")

finally:
    log("[CLEANUP] Terminating HTTP server...")
    server_proc.terminate()
    try:
        server_proc.wait(timeout=3)
    except Exception:
        server_proc.kill()
    log("[CLEANUP] HTTP server terminated. Zero tasks left running.")
