import os
import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8893
Handler = http.server.SimpleHTTPRequestHandler

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(("", PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"Server started on http://127.0.0.1:{PORT}")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Select Duel mode
        page.evaluate("selectMode('duel')")
        page.wait_for_timeout(1500)

        # Move camera close to Goalkeeper facing front to capture full detail of the white gloves
        page.evaluate("""() => {
            // Position camera in front of Goalkeeper for close-up inspection
            camera.position.set(0, 1.35, -16.5);
            camera.lookAt(0, 1.35, -19.6);
            if (window.gkGroup) {
                window.gkGroup.position.set(0, 0, -19.6);
            }
            renderer.render(scene, camera);
        }""")
        page.wait_for_timeout(1000)

        # Save close-up proof screenshot
        proof_path = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
        page.screenshot(path=proof_path)
        print(f"Captured screenshot: {proof_path}")

        # Also capture match angle view
        page.evaluate("""() => {
            camera.position.set(0, 2.3, -5.2);
            camera.lookAt(0, 1.4, -20.0);
            renderer.render(scene, camera);
        }""")
        page.wait_for_timeout(800)
        match_proof_path = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
        page.screenshot(path=match_proof_path)
        print(f"Captured match view screenshot: {match_proof_path}")

        print("Console errors count:", len(console_errors))
        if console_errors:
            print("Errors:", console_errors)

        browser.close()
finally:
    httpd.shutdown()
    httpd.server_close()
    print("Server cleanly shutdown.")
