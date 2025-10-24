from playwright.sync_api import sync_playwright, Page, expect
import os

def run_verification(page: Page):
    """
    Verifies the game's UI and basic functionality.
    """
    # 1. Navigate to the local index.html file.
    page.goto(f"file://{os.getcwd()}/index.html")

    # 2. Start the game.
    start_button = page.get_by_role("button", name="Iniciar Jogo")
    start_button.click()

    # 3. Wait for the game to start and take a screenshot.
    page.wait_for_timeout(1000)  # Wait for a bunny to appear
    page.screenshot(path="jules-scratch/verification/game_started.png")

    # 4. Click on a hole to whack a bunny.
    holes = page.locator('.hole')
    holes.first.click()

    # 5. Take a screenshot of the result.
    page.screenshot(path="jules-scratch/verification/verification.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    run_verification(page)
    browser.close()
