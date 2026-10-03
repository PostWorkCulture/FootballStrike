"""M1 in-game accuracy + zero-allocation check.

Fires solver-driven shots inside the real game (practice mode, keeper and wall off) and
measures where the ball actually crosses the goal plane versus the aimed point.
Run from repo root: python tools/verify/verify_m1_accuracy.py
"""
import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 8893
OUT = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
os.makedirs(OUT, exist_ok=True)

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
errors = []
failed = False
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(2500)
        page.evaluate("""() => {
            selectMode('practice');
            if (practiceSettings.keeper) togglePracticeOption('keeper');
            if (practiceSettings.wall) togglePracticeOption('wall');
            if (practiceSettings.targets) togglePracticeOption('targets');
        }""")
        page.wait_for_timeout(800)

        shots = [
            ("centre", 0.50, 0.45, 100, 0, 0.8, 0),
            ("top-right curl", 0.85, 0.20, 105, 500, 0.9, 1.2),
            ("bottom-left outswing", 0.12, 0.80, 98, -400, 0.85, -1.0),
            ("top-left", 0.15, 0.22, 110, 0, 0.9, 0),
        ]
        worst = 0.0
        for name, fx, fy, kmh, rpm, pw, curl in shots:
            page.evaluate("() => resetBall()")
            page.wait_for_timeout(700)
            r = page.evaluate("""([fx, fy, kmh, rpm, pw, curl]) => new Promise(res => {
                const b = getGoalScreenProjected();
                const sx = b.centerX + (fx - 0.5) * b.goalWidthPx;
                const sy = b.groundY - (1 - fy) * b.goalHeightPx;
                isAiming = true;
                const orig = ballBody.preStep;
                let pz = ballBody.position.z, px = ballBody.position.x, py = ballBody.position.y, hit = null;
                ballBody.preStep = function (h) {
                    if (!hit && this.position.z <= -20 && pz > -20) {
                        const f = (pz + 20) / (pz - this.position.z);
                        hit = { x: px + (this.position.x - px) * f, y: py + (this.position.y - py) * f };
                    }
                    px = this.position.x; py = this.position.y; pz = this.position.z;
                    orig.call(this, h);
                };
                executeShot(sx, sy, kmh, rpm, pw, curl);
                const t0 = performance.now();
                (function poll() {
                    if (hit || performance.now() - t0 > 60000) {
                        ballBody.preStep = orig;
                        res({ hit, target: window.lastShotRecord && window.lastShotRecord.target,
                              solveErr: window.lastShotRecord && window.lastShotRecord.solveErrorM });
                    } else requestAnimationFrame(poll);
                })();
            })""", [fx, fy, kmh, rpm, pw, curl])
            if not r["hit"]:
                print(f"FAIL {name}: ball never crossed goal plane"); failed = True; continue
            d = ((r["hit"]["x"] - r["target"]["x"]) ** 2 + (r["hit"]["y"] - r["target"]["y"]) ** 2) ** 0.5
            worst = max(worst, d)
            status = "PASS" if d < 0.02 else "FAIL"
            if status == "FAIL": failed = True
            print(f"{status} {name}: aimed ({r['target']['x']:.2f},{r['target']['y']:.2f}) "
                  f"landed ({r['hit']['x']:.2f},{r['hit']['y']:.2f}) error {d*1000:.1f} mm")
            page.wait_for_timeout(500)

        page.screenshot(path=os.path.join(OUT, "m1_accuracy_final.png"))
        # Zero-allocation FX: particle pool must not grow scene children
        n0 = page.evaluate("() => scene.children.length")
        page.evaluate("() => { for (let i = 0; i < 10; i++) createShatterFX(0, 1.5, -19.9); }")
        page.wait_for_timeout(300)
        n1 = page.evaluate("() => scene.children.length")
        pool_ok = n0 == n1
        print(f"{'PASS' if pool_ok else 'FAIL'} particle pool: scene children {n0} -> {n1} after 400 spawns")
        failed = failed or not pool_ok
        print(f"Worst in-game landing error: {worst*1000:.1f} mm")
        print(f"Console errors: {len(errors)}")
        for e in errors[:5]: print("  ", e)
        failed = failed or bool(errors)
        browser.close()
finally:
    server.terminate()
print("M1 ACCURACY SUITE", "FAILED" if failed else "PASSED")
sys.exit(1 if failed else 0)
