import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
PORT = 8889

def log(msg):
    print(f"[{time.strftime('%X')}] {msg}", flush=True)

server_proc = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
log("[STEP 1] Starting clean HTTP server on port 8889...")
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        log("[STEP 2] Navigating to game...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1000)

        # -----------------------------------------------------------------
        # TEST 1: FREE KICK DUEL - HUD INSPECTION
        # -----------------------------------------------------------------
        log("[STEP 3] Entering Free Kick Duel...")
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(2000)

        # Verify Top-Right Combined Unit
        log("[STEP 4] Verifying Top-Right Combined Unit with Black Background...")
        top_unit_info = page.evaluate('''() => {
            const unit = document.getElementById('top-right-hud');
            const exitBtn = document.getElementById('exit-btn');
            const nextBtn = document.getElementById('next-shot-btn');
            const telemetry = document.getElementById('telemetry');
            const cs = window.getComputedStyle(unit);
            return {
                exists: !!unit,
                bgColor: cs.backgroundColor,
                hasExit: !!exitBtn && exitBtn.innerText.includes('EXIT MENU'),
                hasNext: !!nextBtn,
                nextVisible: nextBtn.style.display !== 'none',
                hasTelemetry: !!telemetry,
                telemetryInside: unit.contains(telemetry)
            };
        }''')
        log(f"Top Right Unit Info: {top_unit_info}")
        assert top_unit_info['exists'], "Top-right unit does not exist!"
        assert "0, 0, 0" in top_unit_info['bgColor'], f"Expected black background, got {top_unit_info['bgColor']}"
        assert top_unit_info['hasExit'], "Exit Menu button missing from unit!"
        assert top_unit_info['hasTelemetry'], "Telemetry missing from unit!"
        assert top_unit_info['telemetryInside'], "Telemetry is not inside top-right unit!"

        # Verify Bottom Layout (No overlapping button)
        log("[STEP 5] Verifying bottom layout has no overlapping Next Shot button...")
        bottom_info = page.evaluate('''() => {
            const oldNextBtn = document.getElementById('next-round-btn');
            const hintBar = document.getElementById('hint-bar');
            return {
                oldNextExists: !!oldNextBtn,
                hintVisible: !!hintBar && window.getComputedStyle(hintBar).display !== 'none'
            };
        }''')
        log(f"Bottom Layout Info: {bottom_info}")
        assert not bottom_info['oldNextExists'], "Old floating next-round-btn still exists in DOM!"
        assert bottom_info['hintVisible'], "Hint bar is missing!"

        # Verify Score Box (Goals label, no streak gimmick)
        log("[STEP 6] Verifying score card has GOALS label and no +200 streak gimmick...")
        score_info = page.evaluate('''() => {
            const label = document.getElementById('score-label');
            const val = document.getElementById('score-display');
            const streak = document.getElementById('streak-badge');
            return {
                label: label ? label.innerText : '',
                val: val ? val.innerText : '',
                streakExists: !!streak
            };
        }''')
        log(f"Score Box Info: {score_info}")
        assert score_info['label'] == 'GOALS', f"Expected GOALS label, got {score_info['label']}"
        assert score_info['val'] == '0', f"Expected initial goals 0, got {score_info['val']}"
        assert not score_info['streakExists'], "Streak gimmick badge still exists!"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "hud_01_clean_match_view.png"))
        log("Captured: hud_01_clean_match_view.png")

        # -----------------------------------------------------------------
        # TEST 2: SCORE A GOAL & VERIFY BANNER POSITION + NO +200 GIMMICK
        # -----------------------------------------------------------------
        log("[STEP 7] Shooting a top-corner strike into the net...")
        # Shoot cleanly into side netting corner
        page.evaluate('''() => {
            const bounds = getGoalScreenProjected();
            const tx = bounds.centerX + bounds.goalWidthPx * 0.40;
            const ty = bounds.groundY - bounds.goalHeightPx * 0.45;
            executeShot(tx, ty, 115, 0, 0.9);
        }''')

        # Wait for shot to complete
        t0 = time.time()
        while time.time() - t0 < 12:
            st = page.evaluate('() => ({ shotComplete, inNet: ballBody.inNet, scored: ballBody.scored })')
            if st['shotComplete']:
                break
            time.sleep(0.2)

        banner_info = page.evaluate('''() => {
            const banner = document.getElementById('banner');
            const main = document.getElementById('banner-main');
            const sub = document.getElementById('banner-sub');
            const nextBtn = document.getElementById('next-shot-btn');
            const scoreVal = document.getElementById('score-display');
            const goalProj = getGoalScreenProjected();
            const bannerRect = banner.getBoundingClientRect();

            return {
                mainText: main ? main.innerText : '',
                subText: sub ? sub.innerText : '',
                subVisible: sub ? (window.getComputedStyle(sub).display !== 'none' && sub.innerText.trim().length > 0) : false,
                bannerTop: bannerRect.top,
                crossbarY: goalProj.crossbarY,
                isAboveGoal: bannerRect.bottom <= goalProj.crossbarY + 5,
                nextBtnVisible: nextBtn && window.getComputedStyle(nextBtn).display !== 'none',
                scoreVal: scoreVal ? scoreVal.innerText : ''
            };
        }''')
        log(f"Banner and Resolution Info: {banner_info}")
        assert banner_info['mainText'] == 'GOAL', f"Expected 'GOAL', got '{banner_info['mainText']}'"
        assert not banner_info['subVisible'], f"Gimmick subtitle visible: '{banner_info['subText']}'"
        assert banner_info['isAboveGoal'], f"Banner is not above goal! Banner bottom: {banner_info['bannerTop']}, Crossbar: {banner_info['crossbarY']}"
        assert banner_info['nextBtnVisible'], "Next Shot button did not become visible in top-right unit!"
        assert banner_info['scoreVal'] == '1', f"Expected 1 goal, got {banner_info['scoreVal']}"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "hud_02_goal_above_crossbar.png"))
        log("Captured: hud_02_goal_above_crossbar.png")

        # -----------------------------------------------------------------
        # TEST 3: CLICK NEXT SHOT IN TOP-RIGHT UNIT
        # -----------------------------------------------------------------
        log("[STEP 8] Clicking Next Shot in top-right unit...")
        page.click("#next-shot-btn")
        page.wait_for_timeout(1500)

        round_2_info = page.evaluate('''() => {
            const nextBtn = document.getElementById('next-shot-btn');
            const banner = document.getElementById('banner');
            return {
                currentRound: currentRound,
                nextBtnVisible: nextBtn && window.getComputedStyle(nextBtn).display !== 'none',
                bannerVisible: banner && banner.classList.contains('show')
            };
        }''')
        log(f"Round 2 Info: {round_2_info}")
        assert round_2_info['currentRound'] == 2, f"Expected Round 2, got {round_2_info['currentRound']}"
        assert not round_2_info['nextBtnVisible'], "Next Shot button still visible after round transition!"
        assert not round_2_info['bannerVisible'], "Banner still visible after round transition!"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "hud_03_round2_match_view.png"))
        log("Captured: hud_03_round2_match_view.png")

        # -----------------------------------------------------------------
        # TEST 4: PRACTICE MODE HUD
        # -----------------------------------------------------------------
        log("[STEP 9] Testing Practice Mode HUD...")
        page.click("#exit-btn")
        page.wait_for_timeout(600)
        page.click("text=PRACTICE ARENA")
        page.wait_for_timeout(1500)

        practice_info = page.evaluate('''() => {
            const toolbar = document.getElementById('practice-toolbar');
            const scoreLabel = document.getElementById('score-label');
            const scoreVal = document.getElementById('score-display');
            const topUnit = document.getElementById('top-right-hud');
            return {
                toolbarVisible: toolbar && window.getComputedStyle(toolbar).display !== 'none',
                scoreLabel: scoreLabel ? scoreLabel.innerText : '',
                scoreVal: scoreVal ? scoreVal.innerText : '',
                topUnitVisible: topUnit && window.getComputedStyle(topUnit).display !== 'none'
            };
        }''')
        log(f"Practice Mode Info: {practice_info}")
        assert practice_info['toolbarVisible'], "Practice toolbar is not visible!"
        assert practice_info['scoreLabel'] == 'GOALS', f"Expected GOALS label in practice, got {practice_info['scoreLabel']}"

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "hud_04_practice_mode_clean.png"))
        log("Captured: hud_04_practice_mode_clean.png")

        log("[ALL TESTS PASSED SUCCESSFULLY!]")

finally:
    log("[CLEANUP] Terminating HTTP server...")
    server_proc.terminate()
    try:
        server_proc.wait(timeout=2)
    except:
        server_proc.kill()
    log("[CLEANUP] Done.")
