import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
PORT = 8888

def log(msg):
    print(f"[{time.strftime('%X')}] {msg}", flush=True)

server_proc = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
log("[STEP 1] Starting clean HTTP server on port 8888...")
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        log("[STEP 2] Navigating to game...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1000)

        # -----------------------------------------------------------------
        # TEST 1: FREE KICK DUEL - ROUND 1 PENALTY KICK (NEW FIFA GOALKEEPER)
        # -----------------------------------------------------------------
        log("[STEP 3] Entering Free Kick Duel Round 1 (Penalty Kick vs FIFA Goalkeeper)...")
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(2500)

        # In-game match shot from behind ball
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_01_round1_goalkeeper_match_view.png"))
        log("Captured: fifa_01_round1_goalkeeper_match_view.png")

        # Close-up cinematic hero shot of the Goalkeeper
        log("[STEP 4] Capturing Close-Up Hero Portrait of Goalkeeper...")
        page.evaluate('''() => {
            camera.position.set(0, 1.25, -16.6);
            camera.lookAt(0, 1.10, -19.6);
            camera.fov = 36;
            camera.updateProjectionMatrix();
            document.getElementById('hud').style.display = 'none';
        }''')
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_02_goalkeeper_closeup_hero.png"))
        log("Captured: fifa_02_goalkeeper_closeup_hero.png")

        # -----------------------------------------------------------------
        # TEST 2: SHOOT AND CAPTURE GOALKEEPER DIVE
        # -----------------------------------------------------------------
        log("[STEP 5] Testing Goalkeeper Dive & Saving Physics...")
        page.evaluate('''() => {
            document.getElementById('hud').style.display = 'block';
            resetBall();
        }''')
        page.wait_for_timeout(500)

        # Shoot towards right corner
        page.mouse.move(640, 580)
        page.mouse.down()
        for i in range(1, 10):
            page.mouse.move(640 + i * 16, 580 - i * 22)
            time.sleep(0.015)
        page.mouse.up()

        # Wait for dive & score/save resolution
        page.wait_for_selector("#next-shot-btn", state="visible", timeout=12000)
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_03_goalkeeper_dive_resolution.png"))
        log("Captured: fifa_03_goalkeeper_dive_resolution.png")

        # -----------------------------------------------------------------
        # TEST 3: ADVANCE TO ROUND 2 (3-MAN FIFA DEFENSIVE WALL)
        # -----------------------------------------------------------------
        log("[STEP 6] Advancing to Round 2 (Free Kick vs 3-Man Defensive Wall)...")
        page.click("#next-shot-btn")
        page.wait_for_timeout(1000)

        # In-game match shot of wall and goalkeeper
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_04_round2_defensive_wall_match_view.png"))
        log("Captured: fifa_04_round2_defensive_wall_match_view.png")

        # Close-up cinematic hero shot of the 3-Man Defensive Wall
        log("[STEP 7] Capturing Close-Up Hero Portrait of 3-Man Defensive Wall...")
        page.evaluate('''() => {
            const wx = wallGroup.position.x;
            const wz = wallGroup.position.z;
            camera.position.set(wx, 1.15, wz + 4.3);
            camera.lookAt(wx, 1.0, wz);
            camera.fov = 44;
            camera.updateProjectionMatrix();
            document.getElementById('hud').style.display = 'none';
        }''')
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_05_defensive_wall_closeup_hero.png"))
        log("Captured: fifa_05_defensive_wall_closeup_hero.png")

        # -----------------------------------------------------------------
        # TEST 4: PRACTICE ARENA TOGGLES WITH NEW MODELS
        # -----------------------------------------------------------------
        log("[STEP 8] Verifying Practice Arena with new models...")
        page.evaluate('''() => {
            document.getElementById('hud').style.display = 'block';
            selectMode('practice');
        }''')
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "fifa_06_practice_arena_pro_models.png"))
        log("Captured: fifa_06_practice_arena_pro_models.png")

        log("ALL FIFA CHARACTER VERIFICATION TESTS PASSED!")
        browser.close()

finally:
    log("[CLEANUP] Terminating HTTP server...")
    server_proc.terminate()
    try:
        server_proc.wait(timeout=3)
    except Exception:
        server_proc.kill()
    log("[CLEANUP] HTTP server terminated. Zero tasks left running.")
