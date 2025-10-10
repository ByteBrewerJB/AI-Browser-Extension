from playwright.sync_api import sync_playwright, expect, Page

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # --- Handle the first dialog (top-level folder) ---
        def handle_dialog_1(dialog):
            expect(dialog.message).to_contain("Enter a name for the new folder")
            dialog.accept("My Test Folder")
            page.remove_listener("dialog", handle_dialog_1)

        page.on("dialog", handle_dialog_1)

        page.goto("http://localhost:5173/src/options/index.html?view=history", timeout=60000)

        # More robust locator for the "Pinned conversations" section
        pinned_section = page.locator('[data-ai-companion-section-id="history.pinned"]')
        expect(pinned_section).to_be_visible(timeout=20000) # Increased timeout

        # Find the "New" button within that section
        new_folder_button = pinned_section.get_by_role("button", name="New")
        expect(new_folder_button).to_be_visible()
        new_folder_button.click()

        # Wait for the new folder to appear in the tree.
        folder_item = page.get_by_role("button", name="My Test Folder")
        expect(folder_item).to_be_visible()

        # --- Handle the second dialog (subfolder) ---
        def handle_dialog_2(dialog):
            expect(dialog.message).to_contain("Enter a name for the new folder")
            dialog.accept("My Subfolder")
            page.remove_listener("dialog", handle_dialog_2)

        page.on("dialog", handle_dialog_2)

        # Right-click the folder to open the context menu.
        folder_item.click(button="right")

        # Click the "New subfolder" action.
        new_subfolder_menu_item = page.get_by_role("button", name="New subfolder")
        expect(new_subfolder_menu_item).to_be_visible()
        new_subfolder_menu_item.click()

        # Wait for the subfolder to appear.
        subfolder_item = page.get_by_role("button", name="My Subfolder")
        expect(subfolder_item).to_be_visible()

        # Assert that the subfolder is indented.
        expect(subfolder_item.locator("span").first).to_have_css("padding-left", "12px")

        # Take a screenshot of the folder list to verify the visual changes.
        pinned_section.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print("Playwright script failed. Saving page content for debugging.")
        with open("jules-scratch/verification/page_content.html", "w") as f:
            f.write(page.content())
        print("Page content saved to jules-scratch/verification/page_content.html")
        raise e # Re-raise the exception
    finally:
        browser.close()

# Main execution block
with sync_playwright() as p:
    run(p)