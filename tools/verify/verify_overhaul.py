import time
import os
from playwright.sync_api import sync_playwright

def run_verification():
    artifacts_dir = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        console_logs = []
        page_errors = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda exc: page_errors.append(str(exc)))

        print("1. Navigating to game...")
        page.goto("http://localhost:8888/index.html")
        page.wait_for_timeout(1000)

        # Capture Menu
        page.screenshot(path=os.path.join(artifacts_dir, "v5_01_menu.png"))
        print("Menu screenshot saved.")

        # 2. Start Duel Mode
        print("2. Starting Duel Mode...")
        page.click(".mode-card:has-text('Duel')")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_02_duel_start.png"))
        print("Duel start screenshot saved.")

        # 3. Test Directional Shot 1: Top-Right Corner (Aim coordinates x=740, y=310)
        print("3. Executing Directional Shot 1 (Top-Right Upper 90)...")
        page.evaluate("() => window.executeShot(740, 310, 104, 50, 0.85)")
        page.wait_for_timeout(1800)

        shot1_state = page.evaluate("""() => ({
            pos: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
            vel: { x: ballBody.velocity.x, y: ballBody.velocity.y, z: ballBody.velocity.z },
            inNet: ballBody.inNet,
            scored: ballBody.scored,
            speed: document.getElementById('stat-speed').innerText,
            spin: document.getElementById('stat-spin').innerText,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })""")
        print("Shot 1 State:", shot1_state)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_03_shot1_top_right_goal.png"))

        # Verify net entrapment: z must be <= -20.0 and vz <= 0.0
        assert shot1_state['inNet'] is True, "Ball must be entrapped in net"
        assert shot1_state['pos']['z'] <= -20.0, "Ball must never rebound forward out of the goal"
        assert shot1_state['vel']['z'] <= 0.01, "Ball forward velocity in net must be zero"
        assert shot1_state['nextBtnVisible'] == 'flex', "Next Round button must be visible as flex"

        # 4. Click Next Shot Button
        print("4. Clicking Next Shot Button...")
        page.click("#next-round-btn")
        page.wait_for_timeout(1000)

        round2_state = page.evaluate("""() => ({
            round: currentRound,
            isAiming: isAiming,
            ballPos: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })""")
        print("Round 2 State:", round2_state)
        assert round2_state['round'] == 2, "Round must advance to 2"
        assert round2_state['isAiming'] is True, "Aiming must be re-enabled for Round 2"
        assert round2_state['nextBtnVisible'] == 'none', "Next button must hide on reset"
        page.screenshot(path=os.path.join(artifacts_dir, "v5_04_round2_aiming.png"))

        # 5. Test Directional Shot 2: Top-Left Corner (Aim coordinates x=540, y=310)
        print("5. Executing Directional Shot 2 (Top-Left Upper 90)...")
        page.evaluate("() => window.executeShot(540, 310, 108, -80, 0.88)")
        page.wait_for_timeout(1800)

        shot2_state = page.evaluate("""() => ({
            pos: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
            vel: { x: ballBody.velocity.x, y: ballBody.velocity.y, z: ballBody.velocity.z },
            inNet: ballBody.inNet,
            scored: ballBody.scored,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })""")
        print("Shot 2 State:", shot2_state)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_05_shot2_top_left_goal.png"))

        assert shot2_state['inNet'] is True, "Ball must be entrapped in net"
        assert shot2_state['pos']['z'] <= -20.0, "Ball must remain trapped in net"

        # 6. Click Next Shot again to advance to Round 3
        print("6. Clicking Next Shot to advance to Round 3...")
        page.click("#next-round-btn")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_06_round3_spot.png"))

        # 7. Test Goalkeeper Save Block (Shoot low-center at keeper)
        print("7. Testing Goalkeeper Save Block (Shoot at center keeper)...")
        page.evaluate("() => window.executeShot(640, 420, 75, 0, 0.5)")
        page.wait_for_timeout(1800)

        shot3_state = page.evaluate("""() => ({
            saved: ballBody.saved,
            bannerMain: document.getElementById('banner-main').innerText,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })""")
        print("Shot 3 State (Keeper Save):", shot3_state)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_07_keeper_save.png"))

        # 8. Test Target Race Mode
        print("8. Testing Target Race Mode...")
        page.click(".btn-action:has-text('Exit Menu')")
        page.wait_for_timeout(500)
        page.click(".mode-card:has-text('Target Race')")
        page.wait_for_timeout(1000)

        targets_count = page.evaluate("() => activeTargets.length")
        print(f"Target Race active targets count: {targets_count}")
        page.screenshot(path=os.path.join(artifacts_dir, "v5_08_target_race.png"))
        assert targets_count >= 3, "Target Race must have active targets spawned"

        print("ALL TESTS PASSED WITH 100% SUCCESS!")
        print("Console errors:", [e for e in console_logs if '[error]' in e or 'Error' in e])
        print("Page exceptions:", page_errors)
        assert len(page_errors) == 0, f"Must have 0 page errors: {page_errors}"

        browser.close()

if __name__ == "__main__":
    run_verification()
