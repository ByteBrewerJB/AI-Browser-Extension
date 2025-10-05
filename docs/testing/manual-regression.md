# Manual Regression Guide

Use this checklist when shipping changes that affect the popup, dashboard/options page, content script counter, or storage flows. Run the pass on both supported ChatGPT domains so we maintain parity.

> Noteer per run de browser, domein en commit in het logboek in [`retrofit.md`](../../retrofit.md) zodat QA-resultaten traceerbaar blijven.

## Test data & setup

1. **Browser profile**
   - Load the extension unpacked in a Chromium-based browser.
   - Clear existing extension storage (chrome://extensions → Inspect views → Application tab → Clear storage) unless you are validating migrations.
2. **ChatGPT account**
   - Sign in to the same ChatGPT account on `https://chat.openai.com` and `https://chatgpt.com`.
   - Keep the UI language on English for baseline copy unless you are explicitly testing localization.
3. **Seed conversations**
   - Create three fresh conversations on each domain with the prompts below so totals are easy to verify:
     1. `Write a short haiku about morning coffee.`
     2. `Summarize the advantages of using Dexie.js with IndexedDB in bullet points.`
     3. `Generate a numbered list of five productivity tips for remote teams.`
   - Let each assistant response finish streaming before creating the next conversation.
4. **Initial bookmark/pin state**
   - Open the popup once the responses load.
   - Pin the first conversation and bookmark the second using the card actions. Confirm the buttons immediately flip to “Unpin” / “Unbookmark”.

## Popup regression

Execute on `chat.openai.com`, then repeat on `chatgpt.com`.

1. Confirm the extension icon is active when a chat tab is open.
2. Open the popup and verify:
   - The “Recent conversations” list shows all three seeded chats with accurate titles and updated timestamps.
   - Word, message, and character totals match the dashboard numbers for the active chat (use the haiku as a quick spot-check).
   - The language dropdown switches between English and Dutch without layout issues and the RTL toggle flips the interface direction.
   - Pin and bookmark buttons on each card toggle state and counts without requiring a refresh.
3. Use “Open conversation” on the pinned chat and confirm a new tab targets the correct conversation id.
4. Scroll to the placeholder sections at the bottom of the popup and ensure they still show the “arrive soon” copy for bookmarks, pinned chats, and recent activity (regressions here can break expectations for upcoming features).

## Dashboard / options regression

1. Open the dashboard via the extension context menu or by navigating to `chrome-extension://<id>/options.html`.
2. In the “Scheduled exports” card:
   - Click “Schedule export in 5 min” and confirm the card reports the planned run time without errors.
   - Reload the page and note that the timestamp clears (current implementation keeps this state in memory only). Log regressions if the behaviour changes.
3. In the conversation section:
   - Verify the folder tree renders and the active conversations appear in the table with correct message/word/character counts.
   - Toggle the pinned filter to “Pinned only” and ensure only the pinned conversation remains. Switch back to “All”.
   - Change the sort order (e.g., sort by “Title” ascending) and confirm rows reorder immediately.
4. Save a table preset, reload the page, and apply the preset to confirm it restores filters/sorts.
5. Open the prompts/GPT sections and ensure existing entries (if any) still render and CRUD controls appear. Record gaps if the dataset is empty.
6. Select one or more conversations, click “Export selected”, choose a format, and schedule the job. Confirm the success message appears and that the export queue card lists the pending job.
7. Use “Move” in the row actions for a conversation to place it in a different folder, then move it back to the top level. Verify the status notice updates for each move and the table reflects the new folder immediately.
8. Select at least two conversations and click “Move selection”. Choose a destination folder, confirm the success notice reports the count, and ensure the selection clears after the move. Repeat once for moving back to the top level.

## Bookmark & pin workflow

1. From the popup, unbookmark the second conversation and verify the action button reverts to “Bookmark”. Close and reopen the popup to confirm the state persists.
2. Reapply the bookmark in the popup and ensure reopening the popup shows the button as “Unbookmark” again.
3. Unpin the first conversation in the dashboard table (via row actions) and confirm the popup no longer labels it as pinned after reopening.
4. Open the bubble dock on an active ChatGPT conversation and switch to the “Pinned” bubble:
   - Confirm the pinned conversation list shows Open, Move, Unpin, and Archive/Restore controls and that each action updates immediately.
   - Run “Move” for one pinned conversation, choose a new folder, and ensure the dialog closes once the move completes. Move it back to the top level afterward.
   - Toggle a folder shortcut to favorite via the star button, check that the “Fav” badge appears, then close and reopen the dock to confirm the cached list renders without flicker.
   - Click “All folders” and one nested folder shortcut to verify the dashboard opens on the history view with the selected folder filter applied.

## Bookmark overlay smoke test

Execute this pass in both Chrome and Edge once per release when bookmark overlay code changes ship. Run it on `chat.openai.com` with the dock visible; repeat a subset of the checks on `chatgpt.com` to confirm selectors stay stable.

1. Open an existing conversation and hover over a user message to reveal the bubble launcher.
2. Trigger the bookmark action from the context bubble and confirm the inline overlay renders inside the shadow-root without layout shifts.
3. Validate that the overlay shows the message preview, existing note textarea, saved-badge, and `createdAt` timestamp. Editing the note should persist after closing and reopening the overlay.
4. Close the overlay with `Escape`, reopen it from another message, and ensure focus is trapped within the modal. The overlay must close automatically if the dock is hidden.
5. Switch to the second browser (Chrome ↔ Edge) and repeat steps 2–4. Record any DOM mismatches or timing issues in the retrofit log.

## Promptketens

1. Open de dashboardpagina en navigeer naar het tabblad “Prompts”. Maak een keten met minimaal twee stappen en voeg één variabele toe via het pillenveld. Controleer dat dubbele variabelen geweigerd worden en dat de teller niet boven de limiet uitkomt.
2. Ga in een actieve ChatGPT-conversatie naar de promptlauncher en open de tab “Ketens”. Start de zojuist aangemaakte keten en bevestig dat de stappen sequentieel in de composer worden ingevoegd.
3. Start dezelfde keten opnieuw en klik op “Cancel run” terwijl de keten bezig is. Verifieer dat de lopende run stopt, de teller in het runtime-paneel bevriest en de status “Cancelled” verschijnt.
4. Controleer na een volledige run dat het label “Last used” wordt bijgewerkt met de actuele tijd, maar dat een geannuleerde run de laatste executietijd niet overschrijft.

## Live counter regression

1. On `chat.openai.com`, start a new conversation and type `Draft a release note for a minor documentation update.` into the composer.
2. Observe the floating counter:
   - Word and character counts update while typing and decrease when deleting.
   - Sending the message resets the counter for the next draft.
3. Repeat the typing exercise on `chatgpt.com` to confirm parity.
4. After sending the message, open the popup and verify the new conversation appears with updated totals once the assistant response finishes streaming.

## Completion

1. Registreer de testdatum, browser- en extensieversies in het logboek van [`retrofit.md`](../../retrofit.md).
2. Koppel eventuele regressies aan een issue of ADR en link het referentienummer in het logboek.
3. Upload consolelogs of screenshots naar de gedeelde QA-map (indien beschikbaar) en verwijs ernaar vanuit het logboek.

Record the browser version, extension commit SHA, and any deviations or bugs found. Attach console logs or screenshots for regressions and update the shared QA log (if maintained) with pass/fail notes per surface.
