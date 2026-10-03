from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://localhost:8888/index.html')
    page.wait_for_timeout(500)
    page.click('text=FREE KICK DUEL')
    page.wait_for_timeout(500)

    for r in range(1, 6):
        print(f"--- Round {r} ---")
        # Shoot ball
        page.evaluate('''() => {
            window.executeShot(535, 320, 115, 0, 0.95);
            window.stepSimulation(1.2);
        }''')
        btn_disp = page.evaluate('() => document.getElementById("next-round-btn").style.display')
        banner = page.evaluate('() => document.getElementById("banner-main").innerText')
        in_net = page.evaluate('() => ballBody.inNet')
        print(f"Round {r} shot: inNet={in_net}, banner={banner}, btnDisplay={btn_disp}")

        # Advance to next shot
        page.evaluate('() => window.triggerNextShot()')
        page.wait_for_timeout(300)
        curr_round = page.evaluate('() => currentRound')
        print(f"After advancing: currentRound={curr_round}")

    modal_disp = page.evaluate('() => document.getElementById("results-modal").style.display')
    print("Results modal display:", modal_disp)
    assert modal_disp == 'flex', "Results modal must be visible after 5 rounds!"
    print("ALL 5 ROUNDS COMPLETED PERFECTLY!")
    browser.close()
