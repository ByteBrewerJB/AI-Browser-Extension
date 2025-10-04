# Manual Regression Guide

This checklist defines the shared scenarios contributors should execute before shipping updates that affect the popup, dashboard, bookmarks, or the live counter. Follow the steps on both supported ChatGPT domains so we keep feature parity intact.

## Test Data & Setup

1. **Browser profile**
   - Use a Chromium-based browser with the extension loaded unpacked.
   - Clear previous extension storage (chrome://extensions > inspect views > Application tab > Clear storage) to ensure a clean baseline unless you are running differential tests.
2. **ChatGPT account**
   - Sign in to the same ChatGPT account on both `https://chat.openai.com` and `https://chatgpt.com`.
   - Set the UI language to English to match localized copy in this guide; record deviations if testing other locales.
3. **Seed conversations**
   - Create three fresh conversations on each domain with the following prompts to exercise word/character counting and bookmarks:
     1. `Write a short haiku about morning coffee.`
     2. `Summarize the advantages of using Dexie.js with IndexedDB in bullet points.`
     3. `Generate a numbered list of five productivity tips for remote teams.`
   - Wait for assistant responses to finish streaming before moving to the next test.
4. **Bookmark state**
   - From the popup, bookmark the second conversation only. Confirm the bookmark propagates to the dashboard after refreshing it once.
5. **Dashboard filters (if applicable)**
   - Ensure the dashboard is displaying conversations for “All folders” and reset any saved filters prior to testing.

Keep the seeded conversations intact for the duration of the regression pass. If you must rerun the checklist, delete the conversations from the dashboard and recreate them following the same prompts so metrics remain comparable across contributors.

## Popup Regression

Perform these steps on `chat.openai.com` first, then repeat on `chatgpt.com`.

1. Open a new ChatGPT tab and confirm the extension icon is active (not grayed out).
2. Launch the popup:
   - Verify recent conversations list shows the three seeded chats with correct titles and timestamps.
   - Confirm the live word and character totals match the assistant responses for the currently open chat (use the haiku as the baseline; totals should equal the haiku word/character counts shown in the dashboard).
3. Toggle the language dropdown to Dutch and back to English; ensure UI labels and RTL toggle respond without layout regressions.
4. Flip the RTL switch twice, confirming layout responds and resets when switched back.
5. Check the bookmarks tab lists only the bookmarked conversation. Unbookmark and re-bookmark it to confirm the count updates immediately.
6. Click the bookmarked conversation to open it in the current tab; ensure navigation succeeds and the popup reflects the active conversation after reload.

## Dashboard Regression

1. Open the dashboard/options page via the extension’s context menu or `chrome-extension://<id>/options.html`.
2. Confirm the conversations table lists the three seeded chats with accurate word/character totals.
3. Verify the bookmark column matches the popup bookmark state.
4. Filter by “Bookmarked” and confirm only the bookmarked conversation remains.
5. Clear filters and expand the folder tree in the sidebar to ensure the hierarchy renders and no console errors appear.
6. Refresh the page and confirm state persists (table data reloads, bookmark status retained).
7. Switch language to Dutch via the UI (if available) and verify localization applies consistently across table headers and empty states.

## Bookmarks Workflow

1. In the dashboard, unbookmark the second conversation.
2. Switch back to the popup and verify the bookmark badge disappears from the bookmarks tab.
3. Reapply the bookmark from the popup, then refresh the dashboard and ensure the bookmark column updates.
4. Confirm the bookmarked conversation appears at the top of the popup’s bookmarks tab (or follows documented sorting rules).

## Live Counter Regression

1. On `chat.openai.com`, open a new conversation and begin typing the prompt `Draft a release note for a minor documentation update.`
2. Observe the live counter overlay in the composer:
   - Word and character counts should update as you type.
   - Delete text to verify counts decrease accordingly.
3. Send the message and ensure the counter resets for a fresh input.
4. Repeat the typing exercise on `chatgpt.com` to confirm parity.
5. Return to the popup and ensure the new conversation appears with updated totals once the assistant response streams in.

## Completion

Record the date, browser version, extension commit SHA, and any deviations or bugs encountered. Attach console logs or screenshots for regressions. Update the shared QA log (if maintained separately) with pass/fail status per surface.
