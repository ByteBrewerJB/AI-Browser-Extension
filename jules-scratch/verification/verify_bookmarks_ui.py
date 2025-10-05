import os
import time
from playwright.sync_api import sync_playwright, expect

def run_verification():
    """
    Launches a browser with the extension, navigates to a test page,
    and captures a screenshot of the new bubble UI.
    """
    # Get the absolute path for the extension and user data directories
    # This is important because Playwright's working directory can be different
    # from the project root.
    project_root = os.path.abspath('.')
    extension_path = os.path.join(project_root, 'dist')
    user_data_dir = os.path.join(project_root, 'jules-scratch', 'user-data')

    with sync_playwright() as p:
        # Launch a persistent context to load the extension
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=True,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ],
        )

        page = context.new_page()

        try:
            # Navigate to a page where the content script is expected to run.
            print("Navigating to https://chat.openai.com/")
            page.goto("https://chat.openai.com/", wait_until="networkidle")
            print("Page loaded. Waiting for 15 seconds for the UI to settle...")
            page.wait_for_timeout(15000)
            print("Wait finished. Looking for the extension's host element...")

            # The extension injects a shadow root container. We need to locate it.
            # The host is created with the id 'ai-companion-sidebar'.
            sidebar_host = page.locator('#ai-companion-sidebar')

            # Wait for the host to be attached to the DOM
            expect(sidebar_host).to_be_attached(timeout=10000)

            # The bubbles are inside the shadow DOM. Playwright can pierce it.
            # We'll find the bookmarks bubble by its aria-label.
            bookmarks_bubble = sidebar_host.get_by_role('button', name='Bookmarks')

            # Wait for the bubble to be visible and then click it
            expect(bookmarks_bubble).to_be_visible(timeout=5000)
            bookmarks_bubble.click()

            # After clicking, the bookmarks panel should appear.
            # We'll verify this by looking for the panel's heading.
            bookmarks_panel_heading = sidebar_host.get_by_text('Latest bookmarks')
            expect(bookmarks_panel_heading).to_be_visible(timeout=5000)

            # Take a screenshot of the entire sidebar host to show the result
            screenshot_path = os.path.join(project_root, 'jules-scratch', 'verification', 'verification.png')
            sidebar_host.screenshot(path=screenshot_path)

            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred: {e}")
            # Save a screenshot of the whole page for debugging
            page.screenshot(path='jules-scratch/verification/error.png')
        finally:
            context.close()

if __name__ == "__main__":
    run_verification()