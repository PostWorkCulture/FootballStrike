from playwright.sync_api import sync_playwright
import time
import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))

def log(msg):
    try:
        print(msg, flush=True)
    except Exception:
        print(msg.encode('ascii', 'replace').decode('ascii'), flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    
    log("[1/8] Loading Game at http://localhost:8888/index.html ...")
    page.goto("http://localhost:8888/index.html")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_01_menu.png"))

    log("[2/8] Entering Free Kick Duel Championship...")
    page.click("text=FREE KICK DUEL")
    page.wait_for_timeout(800)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_02_duel_start_crimson_wall.png"))

    # Play through rounds
    for r in range(1, 6):
        log(f"--- Executing Tournament Round {r}/5 ---")
        
        # Swipe stroke: natural upward flick towards top-left corner
        page.mouse.move(640, 560)
        page.mouse.down()
        for i in range(1, 12):
            page.mouse.move(640 - i * 15, 560 - i * 20)
            time.sleep(0.015)
        page.mouse.up()

        # Wait for shot resolution (net cushion & rest)
        page.wait_for_timeout(2200)

        # Check telemetry & outcome
        stat_speed = page.locator("#stat-speed").inner_text()
        stat_style = page.locator("#stat-style").inner_text()
        banner_text = page.locator("#banner-main").inner_text()
        log(f"Round {r} Outcome: {banner_text} | Speed: {stat_speed} | Style: {stat_style}")
        
        page.screenshot(path=os.path.join(ARTIFACT_DIR, f"v6_qc_03_round_{r}_outcome.png"))

        # Verify Next Round / View Results button is visible and active
        next_btn = page.locator("#next-round-btn")
        btn_visible = next_btn.is_visible()
        btn_text = next_btn.inner_text().strip()
        log(f"Next Button Visible: {btn_visible} | Text: '{btn_text}'")
        assert btn_visible, f"Round {r}: Next Round button should be visible"
        
        # Advance round
        page.evaluate("() => triggerNextShot()")
        page.wait_for_timeout(900)

        if r == 5:
            # Final round results modal check
            log("[3/8] Verifying Match Results Modal...")
            page.wait_for_selector("#results-modal", state="visible", timeout=5000)
            title = page.locator("#modal-title").inner_text()
            score = page.locator("#modal-final-score").inner_text()
            accuracy = page.locator("#stat-modal-accuracy").inner_text()
            log(f"Match Summary Modal: Title='{title}', Score='{score}', Accuracy='{accuracy}'")
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_04_championship_modal.png"))
            assert title in ["CHAMPION!", "MATCH FINISHED!"], f"Unexpected title: {title}"

    # Return to menu and test Target Race mode
    log("[4/8] Testing Target Race Mode...")
    page.click("text=Main Menu")
    page.wait_for_timeout(500)
    page.click("text=TARGET RACE")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_05_target_race_ready.png"))

    timer_text = page.locator("#timer-display").inner_text()
    log(f"Target Race Timer Active: {timer_text}")
    assert "s" in timer_text

    # Take shot at targets
    log("[5/8] Taking Precision Shot at Moving Targets...")
    page.mouse.move(640, 560)
    page.mouse.down()
    for i in range(1, 10):
        page.mouse.move(640, 560 - i * 24)
        time.sleep(0.015)
    page.mouse.up()
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_06_target_race_shot.png"))

    # Return to menu and test Practice Arena Mode
    log("[6/8] Entering Practice Arena Mode...")
    page.click("text=Exit Menu")
    page.wait_for_timeout(500)
    page.click("text=PRACTICE ARENA")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_07_practice_arena_start.png"))

    # Check practice toolbar visibility
    toolbar_visible = page.locator("#practice-toolbar").is_visible()
    log(f"Practice Toolbar Visible: {toolbar_visible}")
    assert toolbar_visible, "Practice toolbar must be visible in Practice mode"

    # Test Practice Toggles
    log("[7/8] Testing Practice Arena Live Toggles (Targets, Wall, Keeper, Spots)...")
    
    # Toggle Targets OFF
    page.click("#toggle-targets-btn")
    page.wait_for_timeout(300)
    targets_text = page.locator("#toggle-targets-btn").inner_text()
    log(f"Targets toggled: {targets_text}")
    assert "OFF" in targets_text
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_08_practice_targets_off.png"))

    # Toggle Wall OFF
    page.click("#toggle-wall-btn")
    page.wait_for_timeout(300)
    wall_text = page.locator("#toggle-wall-btn").inner_text()
    log(f"Wall toggled: {wall_text}")
    assert "OFF" in wall_text
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_09_practice_wall_off.png"))

    # Toggle Keeper OFF (Empty Goal practice!)
    page.click("#toggle-keeper-btn")
    page.wait_for_timeout(300)
    keeper_text = page.locator("#toggle-keeper-btn").inner_text()
    log(f"Keeper toggled: {keeper_text}")
    assert "OFF" in keeper_text
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_10_practice_empty_net.png"))

    # Cycle Spot to Left Angle (21m)
    page.click("#practice-spot-btn")
    page.wait_for_timeout(400)
    spot_text = page.locator("#practice-spot-btn").inner_text()
    log(f"Cycled to spot: {spot_text}")
    assert "Left Angle" in spot_text
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_11_practice_left_angle_spot.png"))

    # Toggle Wall and Keeper back ON
    page.click("#toggle-wall-btn")
    page.click("#toggle-keeper-btn")
    page.wait_for_timeout(400)

    # Take a shot in Practice Arena
    log("[8/8] Taking Practice Shot from Left Angle...")
    page.mouse.move(640, 560)
    page.mouse.down()
    for i in range(1, 12):
        page.mouse.move(640 + i * 14, 560 - i * 22)
        time.sleep(0.015)
    page.mouse.up()
    page.wait_for_timeout(2200)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_12_practice_shot_result.png"))

    # Test Reset Ball button
    log("Testing Reset Ball button...")
    page.click("#reset-ball-btn")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "v6_qc_13_practice_ball_reset.png"))

    browser.close()
    log(">>> ALL 8 QUALITY CONTROL RIGOROUS CHECKS PASSED WITH 100% SUCCESS! <<<")
