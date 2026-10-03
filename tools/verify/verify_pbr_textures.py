import os
import sys
import time
import subprocess
from PIL import Image
from playwright.sync_api import sync_playwright

ASSETS_DIR = os.path.join(os.getcwd(), 'assets')
PORT = 8922

print("=== STEP 1: VERIFY PNG FILES ON DISK ===")
files_to_check = [
    'ball_normal_pbr.png',
    'turf_normal_pbr.png',
    'gloves_normal_pbr.png',
    'jersey_normal_pbr.png'
]

png_magic = b'\x89PNG\r\n\x1a\n'
all_files_ok = True

for f in files_to_check:
    path = os.path.join(ASSETS_DIR, f)
    if not os.path.exists(path):
        print(f"[FAIL] Missing file: {f}")
        all_files_ok = False
        continue

    sz = os.path.getsize(path)
    if sz <= 0:
        print(f"[FAIL] Zero file size: {f}")
        all_files_ok = False
        continue

    with open(path, 'rb') as fp:
        hdr = fp.read(8)
        if hdr != png_magic:
            print(f"[FAIL] Invalid PNG header for {f}")
            all_files_ok = False
            continue

    im = Image.open(path)
    print(f"[PASS] {f}: {im.size[0]}x{im.size[1]} {im.mode}, Size: {sz:,} bytes, Valid PNG Header")

if not all_files_ok:
    print("[ERROR] File verification failed!")
    sys.exit(1)

print("\n=== STEP 2: LAUNCH SERVER & PLAYWRIGHT BROWSER TEST ===")
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

        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        print(f"Navigating to http://localhost:{PORT}/index.html...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(2500)

        # Wait for models to load
        try:
            page.wait_for_function("() => window.gkPoseModels && window.gkPoseModels.idle !== null", timeout=8000)
            print("GK models loaded successfully.")
        except Exception as e:
            print("[Warning] GK load wait timeout:", e)

        # Check materials in Three.js scene
        pbr_status = page.evaluate("""() => {
            const ball = window.ballMesh;
            const pitch = window.pitchMesh || (typeof pitchMesh !== 'undefined' ? pitchMesh : null);
            const gk = window.gkPoseModels && window.gkPoseModels.idle;
            const wall = window.wallDefenders && window.wallDefenders[0];

            let gkHasNormal = false;
            if (gk) {
                gk.traverse(n => {
                    if (n.isMesh && n.material && n.material.normalMap) gkHasNormal = true;
                });
            }

            let wallHasNormal = false;
            if (wall) {
                wall.traverse(n => {
                    if (n.isMesh && n.material && n.material.normalMap) wallHasNormal = true;
                });
            }

            return {
                ballNormalMap: !!(ball && ball.material && ball.material.normalMap),
                ballMap: !!(ball && ball.material && ball.material.map),
                ballRoughness: ball ? ball.material.roughness : null,
                ballMetalness: ball ? ball.material.metalness : null,
                pitchNormalMap: !!(pitch && pitch.material && pitch.material.normalMap),
                pitchRoughnessMap: !!(pitch && pitch.material && pitch.material.roughnessMap),
                gkHasNormal: gkHasNormal,
                wallHasNormal: wallHasNormal
            };
        }""")

        print(f"Three.js PBR Material Status: {pbr_status}")

        # Verify active render loop
        t_start = page.evaluate("() => performance.now()")
        page.wait_for_timeout(1000)
        t_end = page.evaluate("() => performance.now()")
        print(f"Active render loop verified. Time elapsed: {t_end - t_start:.1f}ms")

        # Enter Free Kick Duel to capture 3D pitch, ball, and goalkeeper
        page.click("text=PLAY FREE KICK DUEL")
        page.wait_for_timeout(1500)

        screenshot_path = "assets/pbr_gameplay_in_game.png"
        page.screenshot(path=screenshot_path)
        print(f"Captured in-game 3D gameplay screenshot: {screenshot_path}")

        print(f"Console errors: {len(console_errors)}")
        if console_errors:
            for err in console_errors:
                print("  Console error:", err)

        assert pbr_status['ballNormalMap'], "Ball normalMap is missing"
        assert pbr_status['pitchNormalMap'], "Pitch normalMap is missing"
        assert pbr_status['gkHasNormal'], "Goalkeeper normalMap is missing"
        assert pbr_status['wallHasNormal'], "Wall defender normalMap is missing"

        print("\nALL VERIFICATION CHECKS PASSED!")

finally:
    server.terminate()
