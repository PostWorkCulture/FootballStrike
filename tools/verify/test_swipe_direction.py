import time
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://localhost:8888/index.html')
    page.wait_for_timeout(500)
    page.click('text=FREE KICK DUEL')
    page.wait_for_timeout(500)

    # Ball screen position at penalty spot (x=0, z=-9.0)
    ball_screen = page.evaluate('''() => {
        const v = ballMesh.position.clone().project(camera);
        return {
            x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
            y: Math.round((-(v.y * 0.5) + 0.5) * window.innerHeight)
        };
    }''')
    print("Ball screen position:", ball_screen)

    # Test Swipe Left: From ball (640, 520) toward top-left of goal (535, 320)
    print("Testing manual swipe towards left side...")
    page.mouse.move(ball_screen['x'], ball_screen['y'])
    page.mouse.down()
    steps = 10
    target_x, target_y = 535, 320
    for i in range(1, steps + 1):
        cx = ball_screen['x'] + (target_x - ball_screen['x']) * (i / steps)
        cy = ball_screen['y'] + (target_y - ball_screen['y']) * (i / steps)
        page.mouse.move(cx, cy)
        time.sleep(0.015)
    page.mouse.up()

    # Step simulation
    page.evaluate('() => window.stepSimulation(1.2)')
    res_left = page.evaluate('''() => ({
        pos: ballBody.position,
        vel: ballBody.velocity,
        inNet: ballBody.inNet,
        scored: ballBody.scored,
        speed: document.getElementById('stat-speed').innerText,
        spin: document.getElementById('stat-spin').innerText,
        style: document.getElementById('stat-style').innerText,
        btn: document.getElementById('next-round-btn').style.display
    })''')
    print("Manual Swipe Left Result:", res_left)
    assert res_left['inNet'] is True, "Left swipe must score and enter net"
    assert res_left['pos']['z'] <= -20.0, "Must be inside net"

    # Click Next Shot
    page.click('#next-round-btn')
    page.wait_for_timeout(500)

    print("SWIPE DIRECTION TEST PASSED WITH 100% SUCCESS!")
    browser.close()
