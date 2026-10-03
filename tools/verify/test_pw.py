from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on('console', lambda msg: print('CONSOLE:', msg.text))
    page.on('pageerror', lambda exc: print('PAGEERROR:', exc))
    
    print('Navigating...')
    page.goto('http://localhost:8080/index.html')
    page.wait_for_timeout(1000)
    print('Clicking Brazil')
    page.click('.char-card')
    page.wait_for_timeout(2000)
    
    print('Done.')
    browser.close()
