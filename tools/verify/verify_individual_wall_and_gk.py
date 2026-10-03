import os
import sys
import time
import json
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
PORT = 8892

def log(msg):
    print(f"[{time.strftime('%X')}] {msg}", flush=True)

server_proc = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)
log(f"[STEP 1] Starting HTTP test server on port {PORT}...")
time.sleep(1.2)

results = {}
errors = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        page.on("console", lambda msg: errors.append(f"CONSOLE {msg.type}: {msg.text}") if msg.type in ["error"] else None)
        page.on("pageerror", lambda exc: errors.append(f"PAGEERROR: {exc}"))

        log("[STEP 2] Navigating to game...")
        page.goto(f"http://localhost:{PORT}/index.html?v={int(time.time())}")
        page.wait_for_timeout(1500)

        # -------------------------------------------------------------
        # TEST 1: FREE KICK DUEL - ROUND 2 WALL INDIVIDUALITY
        # -------------------------------------------------------------
        log("[STEP 3] Entering Free Kick Duel...")
        page.click("text=FREE KICK DUEL")
        page.wait_for_timeout(2000)

        log("[STEP 4] Completing Round 1 (Penalty) to transition to Round 2 (Wall)...")
        # Trigger Shot 1 via executeShot
        page.evaluate('''() => {
            const bounds = window.getGoalScreenProjected();
            window.executeShot(bounds.centerX + 50, bounds.centerY - 20, 95, 0, 0.75);
        }''')
        page.wait_for_timeout(2200)

        # Click Next Shot button to advance to Round 2
        log("[STEP 5] Clicking Next Shot to enter Round 2...")
        page.evaluate('''() => {
            const nextBtn = document.getElementById('next-shot-btn');
            if (nextBtn) nextBtn.click();
        }''')
        page.wait_for_timeout(1800)

        # Inspect Round 2 Setup: Wall & Goalkeeper Presence
        wall_setup = page.evaluate('''() => {
            return {
                round: window.currentRound,
                wallGroupY: window.wallGroup ? window.wallGroup.position.y : null,
                defenderCount: window.wallDefenders ? window.wallDefenders.length : 0,
                shadowCount: window.wallShadows ? window.wallShadows.length : 0,
                colliderCount: window.wallBodies ? window.wallBodies.length : 0,
                gkVisible: window.gkGroup ? window.gkGroup.visible : false,
                gkShadowY: window.gkShadow ? window.gkShadow.position.y : null
            };
        }''')
        log(f"Round 2 Initial Setup: {wall_setup}")
        results['round2_setup'] = wall_setup
        assert wall_setup['defenderCount'] == 3, f"Expected 3 wall defenders, got {wall_setup['defenderCount']}"
        assert wall_setup['shadowCount'] == 3, f"Expected 3 individual wall shadows, got {wall_setup['shadowCount']}"

        # Sample Idle State of Wall Defenders (Checking independent breathing & staggered stances)
        idle_samples = page.evaluate('''() => {
            return window.wallDefenders.map((d, i) => ({
                id: i,
                y: d.position.y,
                rotX: d.rotation.x,
                rotY: d.rotation.y,
                rotZ: d.rotation.z,
                scale: d.scale.x
            }));
        }''')
        log(f"Defender Idle Dynamics: {idle_samples}")
        results['idle_samples'] = idle_samples

        # Trigger Shot in Round 2 and capture mid-air staggered wall jump!
        log("[STEP 6] Triggering Shot in Round 2 to activate Wall Jump & GK Dive...")
        page.evaluate('''() => {
            const bounds = window.getGoalScreenProjected();
            // Shoot over the wall towards top corner
            window.executeShot(bounds.centerX + bounds.goalWidthPx * 0.35, bounds.crossbarY + 20, 105, 0, 0.85);
        }''')

        # Sample at t = 350ms (Mid-air Jump Peak)
        page.wait_for_timeout(350)
        jump_sample = page.evaluate('''() => {
            const defs = window.wallDefenders.map((d, i) => ({
                id: i,
                height: d.position.y,
                leanX: d.rotation.x,
                yawY: d.rotation.y,
                shadowScale: window.wallShadows[i] ? window.wallShadows[i].scale.x : 0,
                shadowOpacity: window.wallShadows[i] ? window.wallShadows[i].material.opacity : 0,
                bodyY: window.wallBodies[i] ? window.wallBodies[i].position.y : 0
            }));
            const gk = {
                diving: window.gkDiving,
                diveType: window.gkDiveType,
                posX: window.gkGroup.position.x,
                posY: window.gkGroup.position.y,
                spineRotZ: window.gkSpine.rotation.z,
                shadowY: window.gkShadow.position.y,
                shadowScale: window.gkShadow.scale.x,
                shadowOpacity: window.gkShadow.material.opacity
            };
            return {
                wallJumping: window.wallJumping,
                wallGroupY: window.wallGroup.position.y,
                jumpTimer: window.wallJumpTimer,
                defenders: defs,
                gk: gk
            };
        }''')
        log(f"Mid-Air Jump Sample (t=350ms): {json.dumps(jump_sample, indent=2)}")
        results['mid_air_sample'] = jump_sample

        # Take Mid-air Staggered Wall Action Screenshot
        wall_shot_path = os.path.join(ARTIFACT_DIR, "fifa_wall_staggered_jump_action.png")
        page.screenshot(path=wall_shot_path)
        log(f"[SCREENSHOT] Staggered wall jump captured: {wall_shot_path}")

        # Assert Wall Individuality:
        # 1. wallGroup.position.y MUST be 0 (no block movement!)
        assert abs(jump_sample['wallGroupY']) < 0.001, f"wallGroup.position.y should be 0, was {jump_sample['wallGroupY']}"
        # 2. Defenders must have different heights
        h0 = jump_sample['defenders'][0]['height']
        h1 = jump_sample['defenders'][1]['height']
        h2 = jump_sample['defenders'][2]['height']
        log(f"Measured Heights at t=350ms: Def0={h0:.3f}m, Def1={h1:.3f}m, Def2={h2:.3f}m")
        assert h1 > h0, f"Center anchor ({h1}) should be higher than left defender ({h0})"
        assert h1 > h2, f"Center anchor ({h1}) should be higher than right defender ({h2})"
        assert abs(h0 - h2) > 0.001 or abs(h0 - h1) > 0.01, "Defenders jumped synchronously!"

        # 3. Shadows must have independent opacities and scales
        op0 = jump_sample['defenders'][0]['shadowOpacity']
        op1 = jump_sample['defenders'][1]['shadowOpacity']
        op2 = jump_sample['defenders'][2]['shadowOpacity']
        log(f"Shadow Opacities: Def0={op0:.3f}, Def1={op1:.3f}, Def2={op2:.3f}")
        assert op1 < op0, f"Center shadow ({op1}) should be more diffuse than left shadow ({op0})"

        # 4. GK Shadow must be strictly anchored to pitch (y=0.015)
        gk_shadow_y = jump_sample['gk']['shadowY']
        assert abs(gk_shadow_y - 0.015) < 0.001, f"GK shadow left the turf! y={gk_shadow_y}"
        log(f"GK Shadow firmly grounded: y={gk_shadow_y}")

        # Wait for shot completion
        page.wait_for_timeout(2000)

        # -------------------------------------------------------------
        # TEST 2: PRACTICE MODE WITH ADVANCED GK DIVES & TOGGLES
        # -------------------------------------------------------------
        log("[STEP 7] Entering Practice Mode...")
        page.evaluate('() => window.resetToMenu()')
        page.wait_for_timeout(1000)
        page.click("text=PRACTICE ARENA")
        page.wait_for_timeout(1800)

        # Test Top Corner Flying Save
        log("[STEP 8] Testing Top Corner Shot to trigger Top Corner Flying Save...")
        page.evaluate('''() => {
            const bounds = window.getGoalScreenProjected();
            window.executeShot(bounds.rightX - 30, bounds.crossbarY + 20, 110, 0, 0.9);
        }''')

        page.wait_for_timeout(350)
        gk_dive_sample = page.evaluate('''() => {
            return {
                diving: window.gkDiving,
                diveType: window.gkDiveType,
                gkX: window.gkGroup.position.x,
                gkY: window.gkGroup.position.y,
                gkSpineZ: window.gkSpine.rotation.z,
                gkShadowY: window.gkShadow.position.y,
                gkShadowScale: window.gkShadow.scale.x,
                gkShadowOpacity: window.gkShadow.material.opacity
            };
        }''')
        log(f"Goalkeeper Top Corner Dive Sample: {json.dumps(gk_dive_sample, indent=2)}")
        results['gk_dive_sample'] = gk_dive_sample

        # Take Goalkeeper Athletic Dive Action Screenshot
        gk_shot_path = os.path.join(ARTIFACT_DIR, "fifa_gk_athletic_dive_action.png")
        page.screenshot(path=gk_shot_path)
        log(f"[SCREENSHOT] Goalkeeper athletic dive captured: {gk_shot_path}")

        assert gk_dive_sample['diving'] == True, "Goalkeeper did not dive!"
        assert gk_dive_sample['diveType'] in ['top_corner_flight', 'mid_parry', 'low_sweep'], f"Invalid dive type: {gk_dive_sample['diveType']}"
        assert abs(gk_dive_sample['gkShadowY'] - 0.015) < 0.001, f"GK shadow rose off the turf: {gk_dive_sample['gkShadowY']}"

        # Test Toggling Wall and Keeper in Practice Mode
        log("[STEP 9] Testing Practice Option Toggles...")
        toggle_res = page.evaluate('''() => {
            // Cycle spot to Center Free Kick (spotIndex 1) so wall is active
            window.cyclePracticeSpot();
            const initialWallVis = window.wallGroup.visible;

            window.togglePracticeOption('wall'); // OFF
            const wallOffVis = window.wallGroup.visible;
            const wallOffColl = window.wallBodies[0].collisionResponse;

            window.togglePracticeOption('keeper'); // OFF
            const gkOffVis = window.gkGroup.visible;
            const gkShadowOffVis = window.gkShadow.visible;

            window.togglePracticeOption('wall'); // ON
            const wallOnVis = window.wallGroup.visible;

            window.togglePracticeOption('keeper'); // ON
            const gkOnVis = window.gkGroup.visible;

            return {
                initialWallVis,
                wallOffVis, wallOffColl,
                gkOffVis, gkShadowOffVis,
                wallOnVis, gkOnVis
            };
        }''')
        log(f"Toggle Test Results: {toggle_res}")
        results['toggle_test'] = toggle_res
        assert toggle_res['initialWallVis'] == True, "Wall should be visible on free kick spot!"
        assert not toggle_res['wallOffVis'] and toggle_res['wallOffColl'] == 0, "Wall toggle OFF failed!"
        assert not toggle_res['gkOffVis'] and not toggle_res['gkShadowOffVis'], "Keeper toggle OFF failed!"
        assert toggle_res['wallOnVis'] and toggle_res['gkOnVis'], "Toggle back ON failed!"

        # Final Practice Arena View Screenshot
        practice_shot_path = os.path.join(ARTIFACT_DIR, "fifa_practice_staggered_arena.png")
        page.screenshot(path=practice_shot_path)
        log(f"[SCREENSHOT] Practice arena captured: {practice_shot_path}")

        browser.close()

    results['errors'] = errors
    results['success'] = len(errors) == 0

    log("=" * 60)
    log("ALL TESTS COMPLETED SUCCESSFULLY!")
    log(f"Console Errors: {len(errors)}")
    log("=" * 60)

except Exception as e:
    log(f"VERIFICATION FAILED: {e}")
    results['success'] = False
    results['exception'] = str(e)
    import traceback
    traceback.print_exc()

finally:
    log("[CLEANUP] Terminating HTTP server...")
    server_proc.terminate()
    server_proc.wait()

with open(os.path.join(ARTIFACT_DIR, "fifa_verification_results.json"), "w") as f:
    json.dump(results, f, indent=2)

if not results.get('success', False):
    sys.exit(1)
