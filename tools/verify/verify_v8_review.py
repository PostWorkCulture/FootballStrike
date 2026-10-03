import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8896
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
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(1000)

        # 1. Capture Bright Goalkeeper in Goalmouth
        print("[2] Capturing Goalkeeper lighting & stance...")
        gk_screenshot = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_v8_review_gk_screenshot.png")
        page.screenshot(path=gk_screenshot)
        print("Saved:", gk_screenshot)

        # 2. Test Right Curler (bowing right -> curves right into top-right corner)
        print("[3] Testing Right-Curling shot (curving right)...")
        res_right = page.evaluate("""() => {
            resetBall();
            // Aim at right post (x=2.2, y=1.9), with curve bowing right (sign=+1, curlBendMeters=+1.6)
            window.executeShot(780, 240, 102, 650, 0.85, 1.6);
            
            // Advance simulation through flight
            const samples = [];
            for (let i = 0; i < 45; i++) {
                updateSimulation(1/60);
                if (i % 8 === 0) {
                    samples.push({
                        t: (i / 60).toFixed(2),
                        ballX: ballBody.position.x.toFixed(2),
                        ballY: ballBody.position.y.toFixed(2),
                        ballZ: ballBody.position.z.toFixed(2),
                        gkX: gkGroup.position.x.toFixed(2),
                        gkY: gkGroup.position.y.toFixed(2),
                        gkRotZ: gkSpine.rotation.z.toFixed(2)
                    });
                }
            }
            return {
                samples: samples,
                finalX: ballBody.position.x.toFixed(2),
                finalY: ballBody.position.y.toFixed(2),
                finalZ: ballBody.position.z.toFixed(2),
                scored: ballBody.scored,
                inNet: ballBody.inNet,
                saved: ballBody.saved,
                magnusAx: currentShotMagnusAx.toFixed(2)
            };
        }""")
        print("Right Curl Flight & GK Dive:", res_right)

        # Capture GK diving action
        gk_dive_screenshot = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_v8_review_gk_dive_screenshot.png")
        page.screenshot(path=gk_dive_screenshot)
        print("Saved:", gk_dive_screenshot)

        # 3. Test Left Curler (bowing left -> curves left into top-left corner)
        print("[4] Testing Left-Curling shot (curving left)...")
        res_left = page.evaluate("""() => {
            resetBall();
            // Aim at left post (x=-2.2, y=1.9), with curve bowing left (sign=-1, curlBendMeters=-1.6)
            window.executeShot(500, 240, 102, -650, 0.85, -1.6);
            
            for (let i = 0; i < 45; i++) {
                updateSimulation(1/60);
            }
            return {
                finalX: ballBody.position.x.toFixed(2),
                finalY: ballBody.position.y.toFixed(2),
                finalZ: ballBody.position.z.toFixed(2),
                scored: ballBody.scored,
                inNet: ballBody.inNet,
                saved: ballBody.saved,
                magnusAx: currentShotMagnusAx.toFixed(2)
            };
        }""")
        print("Left Curl Result:", res_left)

        left_curl_screenshot = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_v8_review_left_curl_screenshot.png")
        page.screenshot(path=left_curl_screenshot)
        print("Saved:", left_curl_screenshot)

        print("\nAll tests completed. Total console errors:", len(errors))
        if errors:
            print("Errors:", errors)

        browser.close()
finally:
    server.terminate()
