# Manual regression checklist

_Last reviewed: 2024-10-20_

Use this guide for every release candidate that touches the popup, dashboard/options experience, content sidebar, or storage logic. Log each run (browser, domain, commit) in the retrofit log at [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md) so we preserve traceability.

## 1. Test data & baseline
1. **Browser profile**
   - Load the unpacked extension in a Chromium-based browser.
   - Clear extension storage (`chrome://extensions` → Inspect views → Application → Clear storage) unless migration testing is in scope.
2. **ChatGPT sessions**
   - Sign in to the same ChatGPT account on both `https://chat.openai.com` and `https://chatgpt.com`.
   - Keep the UI language on English for baseline copy unless you are validating localization.
3. **Seed conversations**
   - Create three new conversations per domain using:
     1. `Write a short haiku about morning coffee.`
     2. `Summarise the advantages of using Dexie.js with IndexedDB in bullet points.`
     3. `Generate a numbered list of five productivity tips for remote teams.`
   - Let each assistant response finish streaming before moving on.
4. **Initial states**
   - Pin the first conversation and bookmark the second via the popup.
   - Open the dashboard once so guides, job lists, and stores hydrate.

## 2. Popup regression (repeat on both domains)
1. Confirm the extension icon is active when a chat tab is focused.
2. Open the popup and verify the header shows the product title, tagline, and auth status (`Premium features unlocked`, `Signed in (free tier)`, or `Offline mode`).
3. Inspect the **Guides & updates** card:
   - Loading state appears before data resolves.
   - “View” opens a new tab and logs a `telemetry event` row in the background worker console (check `chrome://extensions` → Service worker).
   - “Mark as viewed” toggles badges and persists after reopening the popup.
4. Language/direction controls:
   - Switching the language updates copy immediately and persists after closing/reopening the popup.
   - `Text direction` button toggles LTR/RTL and mirrors the layout without clipping content.
5. **Recent conversations** list:
   - All seeded conversations appear with correct timestamps and metrics.
   - Pin/bookmark buttons toggle state and counts without reload.
   - “Open conversation” opens the expected ChatGPT conversation in a new tab.
6. **Recent bookmarks** section:
   - Displays bookmarked conversations with preview + note copy.
   - “Open conversation” deep-links to the bookmarked chat.
7. **Pinned chats** panel:
   - Shows pinned conversations with metrics, matching the popup header counts.
   - Removing a pin updates the badge immediately and re-adding restores the badge.
8. **Recent activity** feed:
   - Contains conversation, bookmark, and job events sorted by timestamp.
   - Failed jobs show error text; completed jobs surface completion timestamps.
   - “Open dashboard” navigates to options.html when clicked.

## 3. Dashboard/options regression
Perform on `chrome-extension://<id>/options.html` with the direction toggle in both LTR and RTL at least once.

### 3.1 Scheduled exports
1. Click **Schedule export in 5 min**. A toast/notice should show the planned time without errors.
2. Reload the page. The scheduled timestamp should persist if the job is still pending.
3. Inspect the **Background job queue** table:
   - Newly scheduled export appears with status `Pending`.
   - Completed jobs show `Completed <time>` and the attempts column increments after retries.
   - Failed jobs display the last error string.
4. Open the service worker console and confirm the export job logs either a success message or the error emitted by the handler.

### 3.2 Guides & updates card
1. Ensure the card loads the same guides as the popup (order may differ if you dismissed items).
2. “View” triggers the same telemetry event and respects the disabled state while pending.
3. “Mark as viewed” updates settings (toggle a guide, reload, confirm persistence).

### 3.3 History section
1. Folder dropdown defaults to “All”. Switch to each folder and confirm the table filters rows accordingly.
2. Change **Pinned** filter between All / Pinned / Unpinned and verify row counts update.
3. Toggle **Archived** filter and ensure archived conversations hide/show.
4. Sort by `Title` ascending and `Updated` descending; rows should reorder immediately.
5. Selection workflow:
   - Use the header checkbox to select all visible rows (indeterminate state should appear when some rows are selected).
   - Use **Move** on a single conversation to change folders, then move it back.
   - Select multiple rows and invoke **Move selection**; confirm the success notice mentions the count and the selection clears.
6. Presets:
   - Save a preset with a custom name, reload the page, and apply it again.
   - Delete the preset and confirm it disappears from the presets menu.
7. Bulk actions:
   - Schedule an export for the selected rows via the bulk actions menu and confirm a new job is enqueued.
   - Archive and unarchive a conversation using the bulk controls, verifying the status column updates.

### 3.4 Prompts & GPTs
1. In the **GPTs** tab, create a new GPT with name + description, assign it to a folder, and confirm it appears in the list.
2. Edit the GPT inline (rename or update description) and save the change.
3. Switch to the **Prompts** tab, create a prompt attached to the GPT, and ensure it renders with the correct folder tag.
4. Build a prompt chain with at least two steps and add a variable pill. Attempting to add a duplicate variable should surface the validation error.
5. Reorder chain steps and use **Cancel** to ensure the chain editor resets state.

### 3.5 Media workspace
1. Toggle each checkbox (auto-download, advanced voice mode, sync drafts) and confirm the state persists after reload.
2. Change the default voice from the dropdown and verify the preview overlay reflects the selection.
3. Open the **Preview voice overlay**, check that focus stays trapped inside, and close it with both the confirm button and `Escape`.
4. Launch the **Learn about modals** dialog and confirm focus returns to the trigger after closing.

## 4. Content sidebar & context workflows
1. Open an active conversation and toggle the dock with `Alt+Shift+K`; verify the chosen bubble stays active.
2. In the **History** bubble:
   - Favorite a folder via the star icon, reload the tab, and confirm cached favourites render before the tree hydrates.
   - Use the quick actions to pin/unpin conversations and observe toast feedback.
3. In the **Actions** bubble:
   - Select a message and trigger Bookmark, Save as prompt, Copy text, and Pin conversation. Each action should close the menu and show a toast.
   - Deselect the message and confirm text-based actions disable with the helper copy.
4. In the **Guides** bubble, ensure the modal mirrors the options card (view + mark as viewed) and persists settings updates.
5. Context menu (`Shift+F10` or right-click on a message):
   - Menu renders near the pointer with role + preview text.
   - Bookmark opens the inline modal; copy/prompt actions respect disabled state when there is no text.
   - Escape closes the menu and subsequent right-click uses the native browser menu once the sidebar is hidden.

## 5. Composer counters & prompt launcher
1. Start drafting a message. Word/character counters update live and reset after sending.
2. Open the prompt launcher and insert a saved prompt and a prompt chain; confirm the composer fills with the correct content and `Cancel run` stops an in-progress chain.
3. Trigger the instruction overlay (open the launcher three times) and confirm the tip counter decrements until dismissed.

## 6. Completion & logging
1. Record outcomes, browser versions, domains tested, and any bugs in [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md) under the logbook section.
2. Attach relevant console logs or screenshots to the shared QA archive, referencing them from the log entry.

Keep this checklist synchronized with UI and storage changes. When a step becomes automated (e.g., Playwright coverage), annotate it here and add the scenario ID for quick cross-reference.
