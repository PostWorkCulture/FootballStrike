import time
import os
from playwright.sync_api import sync_playwright

def run_tournament_verification():
    artifacts_dir = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        console_logs = []
        page_errors = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda exc: page_errors.append(str(exc)))

        print("=== STEP 1: Launch Game & Capture Main Menu ===")
        page.goto("http://localhost:8888/index.html")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_01_main_menu.png"))

        print("=== STEP 2: Start Free Kick Duel Tournament ===")
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_02_duel_arena_ready.png"))

        # Round 1: Central Penalty Spot
        print("=== STEP 3: Round 1 - Central Spot (Score into Left Corner) ===")
        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        r1_result = page.evaluate('''() => ({
            round: currentRound,
            inNet: ballBody.inNet,
            scored: ballBody.scored,
            pos: ballBody.position,
            vel: ballBody.velocity,
            banner: document.getElementById('banner-main').innerText,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })''')
        print("Round 1 Result:", r1_result)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_03_round1_goal_net_cushion.png"))
        assert r1_result['inNet'] is True, "Ball must be in net"
        assert r1_result['pos']['z'] <= -20.0, "Ball must not rebound forward out of the goal"
        assert r1_result['nextBtnVisible'] == 'flex', "Next button must be visible"

        print("Clicking Next Shot Button...")
        page.click("#next-round-btn")
        page.wait_for_timeout(800)

        # Round 2: Left Channel (x=-5.5, z=-10.5)
        print("=== STEP 4: Round 2 - Left Channel ===")
        page.screenshot(path=os.path.join(artifacts_dir, "v5_04_round2_left_channel_spot.png"))
        r2_prep = page.evaluate('''() => ({
            round: currentRound,
            ballPos: ballBody.position,
            isAiming: isAiming,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })''')
        print("Round 2 Setup:", r2_prep)
        assert r2_prep['round'] == 2, "Must be round 2"
        assert r2_prep['nextBtnVisible'] == 'none', "Next button must hide on reset"

        # Shoot Round 2
        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        r2_result = page.evaluate('''() => ({
            round: currentRound,
            inNet: ballBody.inNet,
            scored: ballBody.scored,
            pos: ballBody.position,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })''')
        print("Round 2 Result:", r2_result)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_05_round2_shot_result.png"))

        print("Clicking Next Shot to Round 3...")
        page.click("#next-round-btn")
        page.wait_for_timeout(800)

        # Round 3: Right Channel (x=5.5, z=-10.5)
        print("=== STEP 5: Round 3 - Right Channel ===")
        r3_prep = page.evaluate('() => ({ round: currentRound, ballPos: ballBody.position })')
        print("Round 3 Setup:", r3_prep)
        assert r3_prep['round'] == 3, "Must be round 3"
        page.screenshot(path=os.path.join(artifacts_dir, "v5_06_round3_right_channel_spot.png"))

        # Shoot Round 3
        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        r3_result = page.evaluate('''() => ({
            round: currentRound,
            banner: document.getElementById('banner-main').innerText,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })''')
        print("Round 3 Result:", r3_result)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_07_round3_result.png"))

        # Advance to Round 4
        print("Advancing to Round 4...")
        page.click("#next-round-btn")
        page.wait_for_timeout(800)

        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        r4_result = page.evaluate('''() => ({
            round: currentRound,
            banner: document.getElementById('banner-main').innerText,
            nextBtnVisible: document.getElementById('next-round-btn').style.display
        })''')
        print("Round 4 Result:", r4_result)

        # Advance to Round 5
        print("Advancing to Round 5 (Final Round)...")
        page.click("#next-round-btn")
        page.wait_for_timeout(800)
        r5_round = page.evaluate('() => currentRound')
        print("Round 5 reached:", r5_round)
        assert r5_round == 5, "Must reach round 5"

        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        page.wait_for_timeout(600)
        page.click("#next-round-btn")
        page.wait_for_timeout(1000)

        modal_vis = page.evaluate('() => document.getElementById("results-modal").style.display')
        print("Match Results Modal visible:", modal_vis)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_08_match_summary_modal.png"))
        assert modal_vis == 'flex', "Results modal must display after round 5"

        # Test Target Race Mode
        print("=== STEP 6: Target Race Mode Verification ===")
        page.click("text=Main Menu")
        page.wait_for_timeout(800)
        page.click("text=TARGET RACE")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifacts_dir, "v5_09_target_race_arena.png"))

        tr_state = page.evaluate('''() => ({
            mode: currentGameMode,
            targetsCount: activeTargets.length,
            timeLeft: targetRaceTimeLeft,
            score: score
        })''')
        print("Target Race State:", tr_state)
        assert tr_state['mode'] == 'targets', "Mode must be targets"
        assert tr_state['targetsCount'] >= 3, "Must have active targets"

        print("=== STEP 7: Console & Exception Audit ===")
        print("Page Errors Count:", len(page_errors))
        if page_errors:
            print("Errors:", page_errors)
        assert len(page_errors) == 0, f"Must have zero page errors: {page_errors}"

        print("TOURNAMENT VERIFICATION 100% SUCCESSFUL!")
        browser.close()

if __name__ == "__main__":
    run_tournament_verification()
