import os
import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8894
Handler = http.server.SimpleHTTPRequestHandler

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(("", PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"Server started on http://127.0.0.1:{PORT}")

results = {}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        page.goto(f"http://127.0.0.1:{PORT}/index.html?v={int(time.time())}", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. Test Ball Physics Parameters (Lighter ball, minimal damping)
        ball_props = page.evaluate("""() => {
            return {
                mass: window.ballBody.mass,
                linearDamping: window.ballBody.linearDamping,
                angularDamping: window.ballBody.angularDamping,
                radius: window.ballRadius
            };
        }""")
        print("Ball physical parameters:", ball_props)
        results["ball_physics"] = ball_props

        # 2. Test Inswing Curl (Swipe bowing to the left, bending into the top-right corner)
        page.evaluate("selectMode('practice')")
        page.wait_for_timeout(600)

        # Perform synthetic curved swipe: from bottom center (640, 620), bowing out to left (520, 420), ending at top-right corner (780, 220)
        inswing_telemetry = page.evaluate("""() => {
            resetBall();
            // Simulate pointer events
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();

            // Bezier curve from ball (640, 600) with control point (500, 440) [bowed left] to top-right corner (870, 290)
            const samples = [];
            const n = 20;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const x = (1 - t) * (1 - t) * 640 + 2 * (1 - t) * t * 500 + t * t * 870;
                const y = (1 - t) * (1 - t) * 600 + 2 * (1 - t) * t * 440 + t * t * 290;
                samples.push({ x: x, y: y, time: performance.now() + i * 16 });
            }

            // Trigger pointerdown, move, up with samples
            const first = samples[0];
            const last = samples[samples.length - 1];
            const totalDx = last.x - first.x;
            const totalDy = last.y - first.y;
            const dt = (last.time - first.time) / 1000;
            const strokeSpeed = Math.hypot(totalDx, totalDy) / dt;

            let maxDeflection = 0;
            const chordLen = Math.hypot(totalDx, totalDy);
            for (let i = 1; i < samples.length - 1; i++) {
                const s = samples[i];
                const defl = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / chordLen;
                if (Math.abs(defl) > Math.abs(maxDeflection)) {
                    maxDeflection = defl;
                }
            }

            const powerNorm = Math.min(1.0, Math.max(0.48, strokeSpeed / 950));
            const speedKmh = Math.round(88 + powerNorm * 40);

            let curlBendMeters = 0;
            let spinRPM = 0;
            const clampedDefl = Math.max(-120, Math.min(120, maxDeflection));
            if (Math.abs(clampedDefl) > 10) {
                const sign = clampedDefl > 0 ? 1 : -1;
                const normDefl = (Math.abs(clampedDefl) - 10) / 65.0;
                const bendMag = Math.min(2.8, normDefl * 1.85 + Math.pow(normDefl, 1.35) * 0.55);
                curlBendMeters = sign * bendMag;
                spinRPM = Math.round(curlBendMeters * 420);
            }

            const bounds = getGoalScreenProjected();
            const targetScreenX = last.x;
            const targetScreenY = last.y;

            window.executeShot(targetScreenX, targetScreenY, speedKmh, spinRPM, powerNorm, curlBendMeters);

            return {
                maxDeflection: maxDeflection.toFixed(1),
                curlBendMeters: curlBendMeters.toFixed(2),
                spinRPM: spinRPM,
                initialVx: ballBody.velocity.x.toFixed(2),
                initialVy: ballBody.velocity.y.toFixed(2),
                initialVz: ballBody.velocity.z.toFixed(2),
                currentShotMagnusAx: currentShotMagnusAx.toFixed(2),
                style: document.getElementById('stat-style').innerText
            };
        }""")
        print("Inswing Shot Launch Telemetry:", inswing_telemetry)
        results["inswing_launch"] = inswing_telemetry

        # Step simulation to midpoint and inspect ball position
        # Step simulation until ball reaches goal mouth
        inswing_goal = page.evaluate("""() => {
            for (let i = 0; i < 40; i++) {
                if (ballBody.position.z <= -19.9 || ballBody.scored || ballBody.inNet) break;
                updateSimulation(1/60);
            }
            return {
                goalX: ballBody.position.x.toFixed(2),
                goalY: ballBody.position.y.toFixed(2),
                goalZ: ballBody.position.z.toFixed(2),
                scored: ballBody.scored,
                inNet: ballBody.inNet
            };
        }""")
        print("Inswing Arrival at Goal:", inswing_goal)
        results["inswing_goal"] = inswing_goal

        # Capture Inswing Screenshot
        inswing_proof = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_curling_and_weight_inswing_proof.png")
        page.screenshot(path=inswing_proof)
        print("Saved inswing screenshot:", inswing_proof)

        # 3. Test Outswing Curl (Swipe bowing to the right, bending into the top-left corner)
        outswing_telemetry = page.evaluate("""() => {
            // Bezier curve from ball (640, 600) with control point (780, 440) [bowed right] to top-left corner (410, 290)
            const samples = [];
            const n = 20;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const x = (1 - t) * (1 - t) * 640 + 2 * (1 - t) * t * 780 + t * t * 410;
                const y = (1 - t) * (1 - t) * 600 + 2 * (1 - t) * t * 440 + t * t * 290;
                samples.push({ x: x, y: y, time: performance.now() + i * 16 });
            }

            const first = samples[0];
            const last = samples[samples.length - 1];
            const totalDx = last.x - first.x;
            const totalDy = last.y - first.y;
            const dt = (last.time - first.time) / 1000;
            const strokeSpeed = Math.hypot(totalDx, totalDy) / dt;

            let maxDeflection = 0;
            const chordLen = Math.hypot(totalDx, totalDy);
            for (let i = 1; i < samples.length - 1; i++) {
                const s = samples[i];
                const defl = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / chordLen;
                if (Math.abs(defl) > Math.abs(maxDeflection)) {
                    maxDeflection = defl;
                }
            }

            const powerNorm = Math.min(1.0, Math.max(0.48, strokeSpeed / 950));
            const speedKmh = Math.round(88 + powerNorm * 40);

            let curlBendMeters = 0;
            let spinRPM = 0;
            const clampedDefl = Math.max(-120, Math.min(120, maxDeflection));
            if (Math.abs(clampedDefl) > 10) {
                const sign = clampedDefl > 0 ? 1 : -1;
                const normDefl = (Math.abs(clampedDefl) - 10) / 65.0;
                const bendMag = Math.min(2.8, normDefl * 1.85 + Math.pow(normDefl, 1.35) * 0.55);
                curlBendMeters = sign * bendMag;
                spinRPM = Math.round(curlBendMeters * 420);
            }

            const targetScreenX = last.x;
            const targetScreenY = last.y;

            window.executeShot(targetScreenX, targetScreenY, speedKmh, spinRPM, powerNorm, curlBendMeters);

            return {
                maxDeflection: maxDeflection.toFixed(1),
                curlBendMeters: curlBendMeters.toFixed(2),
                spinRPM: spinRPM,
                initialVx: ballBody.velocity.x.toFixed(2),
                initialVy: ballBody.velocity.y.toFixed(2),
                initialVz: ballBody.velocity.z.toFixed(2),
                currentShotMagnusAx: currentShotMagnusAx.toFixed(2),
                style: document.getElementById('stat-style').innerText
            };
        }""")
        print("Outswing Shot Launch Telemetry:", outswing_telemetry)
        results["outswing_launch"] = outswing_telemetry

        # Step simulation to goal
        outswing_goal = page.evaluate("""() => {
            for (let i = 0; i < 40; i++) {
                if (ballBody.position.z <= -19.9 || ballBody.scored || ballBody.inNet) break;
                updateSimulation(1/60);
            }
            return {
                goalX: ballBody.position.x.toFixed(2),
                goalY: ballBody.position.y.toFixed(2),
                goalZ: ballBody.position.z.toFixed(2),
                scored: ballBody.scored,
                inNet: ballBody.inNet
            };
        }""")
        print("Outswing Arrival at Goal:", outswing_goal)
        results["outswing_goal"] = outswing_goal

        # Capture Outswing Screenshot
        outswing_proof = os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_curling_and_weight_outswing_proof.png")
        page.screenshot(path=outswing_proof)
        print("Saved outswing screenshot:", outswing_proof)

        print("Console errors count:", len(console_errors))
        results["console_errors"] = console_errors

        # Save JSON results
        with open(os.path.join(os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out")), "verify_curling_and_weight_report.txt"), "w") as f:
            json.dump(results, f, indent=2)

        browser.close()
finally:
    httpd.shutdown()
    httpd.server_close()
    print("Server cleanly shutdown.")
