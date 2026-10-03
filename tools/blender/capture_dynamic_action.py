import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
PORT = 8894

server_proc = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1000)
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(2000)

        # 1. Trigger dynamic dive shot (Round 1 Penalty)
        page.evaluate('''() => {
            const bounds = getGoalScreenProjected();
            const tx = bounds.centerX + bounds.goalWidthPx * 0.38;
            const ty = bounds.groundY - bounds.goalHeightPx * 0.65;
            executeShot(tx, ty, 95, 0, 0.75);
        }''')
        # Capture mid-air dive action
        page.wait_for_timeout(350)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "gk_dynamic_dive_action.png"))

        # Wait for shot to complete and advance to round 2
        t0 = time.time()
        while time.time() - t0 < 10:
            if page.evaluate("() => shotComplete"):
                break
            time.sleep(0.2)
        
        page.click("#next-shot-btn")
        page.wait_for_timeout(1500)

        # 2. Trigger shot against Wall in Round 2
        page.evaluate('''() => {
            const bounds = getGoalScreenProjected();
            const tx = bounds.centerX;
            const ty = bounds.groundY - bounds.goalHeightPx * 0.70;
            executeShot(tx, ty, 100, 0, 0.8);
        }''')
        # Capture wall mid-jump action with defensive tuck
        page.wait_for_timeout(320)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "wall_dynamic_jump_action.png"))

        print("Captured dynamic action screenshots successfully!")
finally:
    server_proc.terminate()
    try:
        server_proc.wait(timeout=2)
    except:
        server_proc.kill()
