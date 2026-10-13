import os
import sys
from playwright.sync_api import sync_playwright

def render_round(round_id="round2", port=8080):
    out_dir = os.path.join("tools", "verify", "out", round_id)
    os.makedirs(out_dir, exist_ok=True)
    url = f"http://localhost:{port}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--enable-webgl"])
        context = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        # Wait for all GLB character models (goalkeeper.glb, player.glb, training_mannequin.glb) and 2K textures to load
        page.wait_for_function("""() => {
            return window.strikerAnimator && window.gkAnimator && window.wallAnimators && window.wallAnimators.length >= 3 && window.trainingPropsGroup && window.trainingPropsGroup.children.length >= 4;
        }""", timeout=10000)
        page.wait_for_timeout(500)

        # Stage unified training showcase shot and enable clean viewport (hide all UI/HUD/Studio buttons)
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

        # Hook composer.render so the continuous rAF loop never overwrites our diagnostic camera angles or triggers mid-kick demo animations!
        page.evaluate("""() => {
            window.__lockDiagnosticCamera = function(pos, look, fov, wf) {
                window.__diagCam = { pos, look, fov, wf: !!wf };
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
                    window.setWireframeMode(!!wf);
                }
                camera.fov = fov;
                camera.updateProjectionMatrix();
                camera.position.set(pos[0], pos[1], pos[2]);
                camera.lookAt(look[0], look[1], look[2]);
                composer.render();
            };
        }""")

        # 1. 3/4 Overview showing the overall composition (Striker #10 + Ball + Penalty Box + Wall + Sculpted Mannequins + Keeper #1 + Targets + Static Hoardings + Stadium Bowl)
        page.evaluate("""() => {
            window.__lockDiagnosticCamera([-4.6, 2.75, -3.4], [0.0, 1.05, -17.5], 46, false);
        }""")
        page.wait_for_timeout(250)
        p1 = os.path.join(out_dir, f"{round_id}_1_overview.png")
        page.screenshot(path=p1)

        # 2. Close-up showing surface details and textures (Full Striker #10 + 2K Match Ball on Turf Blades + Wall & Goal in background, zero clipped limbs!)
        page.evaluate("""() => {
            const bx = ballMesh.position.x;
            const bz = ballMesh.position.z;
            window.__lockDiagnosticCamera([bx + 0.72, 0.88, bz + 2.45], [bx - 0.32, 0.78, bz - 3.2], 38, false);
        }""")
        page.wait_for_timeout(250)
        p2 = os.path.join(out_dir, f"{round_id}_2_closeup.png")
        page.screenshot(path=p2)

        # 3. Low-angle ground check proving objects (ball, striker boots, wall bases, keeper feet, goal sockets, static boards) sit cleanly on the ground without floating
        page.evaluate("""() => {
            const bx = ballMesh.position.x;
            const bz = ballMesh.position.z;
            window.__lockDiagnosticCamera([bx + 0.42, 0.14, bz + 1.55], [bx - 0.15, 0.48, -19.5], 40, false);
        }""")
        page.wait_for_timeout(250)
        p3 = os.path.join(out_dir, f"{round_id}_3_low_angle.png")
        page.screenshot(path=p3)

        # 4. Wireframe view proving clean 3D geometry (including SkinnedMesh characters and 80x110 pitch grid)
        page.evaluate("""() => {
            window.__lockDiagnosticCamera([-4.2, 2.45, -3.8], [0.0, 1.05, -17.5], 45, true);
        }""")
        page.wait_for_timeout(250)
        p4 = os.path.join(out_dir, f"{round_id}_4_wireframe.png")
        page.screenshot(path=p4)

        browser.close()
        print(f"Rendered 4 views for {round_id} into {out_dir}")
        if errors:
            print("Console/Page errors:", errors)
            sys.exit(1)

if __name__ == "__main__":
    rid = sys.argv[1] if len(sys.argv) > 1 else "round2"
    render_round(rid)
