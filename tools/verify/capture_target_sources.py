import os
import shutil
from playwright.sync_api import sync_playwright

def capture_target_sources(port=8080, prefix="converged"):
    out_dir = os.path.join("tools", "verify", "out", "targets")
    os.makedirs(out_dir, exist_ok=True)
    url = f"http://localhost:{port}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--enable-webgl"])
        context = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        page = context.new_page()

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("""() => {
            return window.strikerAnimator && window.gkAnimator && window.wallAnimators && window.wallAnimators.length >= 3 && window.trainingPropsGroup && window.trainingPropsGroup.children.length >= 4;
        }""", timeout=10000)
        page.wait_for_timeout(500)

        page.evaluate("""() => {
            window.menuOpen = false;
            if (typeof window.setupTrainingShowcaseShot === 'function') {
                window.setupTrainingShowcaseShot();
            }
            if (typeof window.setCleanViewportMode === 'function') {
                window.setCleanViewportMode(true);
            }
            if (typeof window.stepSimulation === 'function') {
                window.stepSimulation(0.15);
            }
        }""")
        page.wait_for_timeout(200)

        page.evaluate("""() => {
            window.__lockDiagnosticCamera = function(pos, look, fov) {
                window.__diagCam = { pos, look, fov, wf: false };
                window.menuOpen = false;
                if (typeof window.setupTrainingShowcaseShot === 'function') {
                    window.setupTrainingShowcaseShot();
                }
                const resetAnim = (anim, t) => {
                    if (!anim) return;
                    anim.mixer.stopAllAction();
                    anim.current = null;
                    anim.currentPose = null;
                    anim.setPose('idle');
                    anim.mixer.setTime(t);
                    anim.applyAthleticPosture();
                };
                resetAnim(window.strikerAnimator, 0.08);
                resetAnim(window.gkAnimator, 0.08);
                if (window.wallAnimators) {
                    window.wallAnimators.forEach((a, idx) => resetAnim(a, 0.08 + idx * 0.02));
                }
                if (typeof window.setWireframeMode === 'function') {
                    window.setWireframeMode(false);
                }
                camera.fov = fov;
                camera.updateProjectionMatrix();
                camera.position.set(pos[0], pos[1], pos[2]);
                camera.lookAt(look[0], look[1], look[2]);
                composer.render();
            };
        }""")

        # Viewpoint 1: Main Over-the-Shoulder Broadcast Gameplay Camera
        page.evaluate("""() => {
            const bx = ballMesh.position.x;
            const bz = ballMesh.position.z;
            window.__lockDiagnosticCamera([bx + 0.16, 1.48, bz + 4.35], [0.0, 0.95, -20.0], 45);
        }""")
        page.wait_for_timeout(200)
        p1 = os.path.join(out_dir, f"{prefix}_1_gameplay.png")
        page.screenshot(path=p1)

        # Viewpoint 2: 3/4 Arena Overview
        page.evaluate("""() => {
            window.__lockDiagnosticCamera([-4.6, 2.75, -3.4], [0.0, 1.05, -17.5], 46);
        }""")
        page.wait_for_timeout(200)
        p2 = os.path.join(out_dir, f"{prefix}_2_overview.png")
        page.screenshot(path=p2)

        # Viewpoint 3: Close-Up Surface & Material Detail
        page.evaluate("""() => {
            const bx = ballMesh.position.x;
            const bz = ballMesh.position.z;
            window.__lockDiagnosticCamera([bx + 0.72, 0.88, bz + 2.45], [bx - 0.32, 0.78, bz - 3.2], 38);
        }""")
        page.wait_for_timeout(200)
        p3 = os.path.join(out_dir, f"{prefix}_3_closeup.png")
        page.screenshot(path=p3)

        # Viewpoint 4: Low-Angle Turf & Goal Perspective
        page.evaluate("""() => {
            const bx = ballMesh.position.x;
            const bz = ballMesh.position.z;
            window.__lockDiagnosticCamera([bx + 0.42, 0.14, bz + 1.55], [bx - 0.15, 0.48, -19.5], 40);
        }""")
        page.wait_for_timeout(200)
        p4 = os.path.join(out_dir, f"{prefix}_4_low_angle.png")
        page.screenshot(path=p4)

        browser.close()
        print(f"Captured 4 {prefix} viewport screenshots into", out_dir)

if __name__ == "__main__":
    import sys
    prefix_arg = sys.argv[1] if len(sys.argv) > 1 else "converged"
    capture_target_sources(prefix=prefix_arg)

