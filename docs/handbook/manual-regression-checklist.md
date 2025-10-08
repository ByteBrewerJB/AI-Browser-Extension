# Manual regression checklist

_Last reviewed: 2025-10-08_

Use this guide for every release candidate that touches the popup, dashboard/options experience, content sidebar, or storage logic. Log each run (browser, domain, commit) in the retrofit log at [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md) so we preserve traceability.

## 1. Test data & baseline
1. **Browser profile**
   - Load the unpacked extension in a Chromium-based browser.
   - Clear extension storage (`chrome://extensions` → Inspect views → Application → Clear storage) unless migration testing is in scope.
   - For schema migrations: delete the `AICompanionDB` database under **IndexedDB** and reload the extension to ensure the new `folders` and `folder_items` tables initialise cleanly before running tests.
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

## 1.1 Theme tokens (light/dark/high-contrast)
1. Open de popup en het dashboard met Chrome DevTools → Rendering zichtbaar.
   - Zet **Emulate CSS prefers-color-scheme** op `dark` en bevestig dat `<html data-theme>` naar `dark` wisselt, achtergronden verduisteren en primaire tekst leesbaar blijft.
   - Schakel terug naar `light` en controleer dat de oorspronkelijke kleuren terugkeren.
   - Zet **Emulate CSS prefers-contrast** op `more`; verwacht `data-theme="high-contrast"`, zwarte achtergronden, witte tekst en een cyaan focusring. Doorloop met `Tab` een paar knoppen/links om de focusring te verifiëren.
2. Reset beide emulatie-instellingen naar `No emulation` voordat je doorgaat met de volgende secties.

## 1.2 RTL smoketests (popup, dashboard, content)
1. **Popup**
   - Open de popup op zowel `https://chat.openai.com` als `https://chatgpt.com`.
   - Gebruik de taal-/richtingstoggle om naar RTL te schakelen en controleer dat header, kaarten en lijsten spiegelen zonder overlappende tekst of afgeknotte badges.
   - Loop met `Tab` door de interactieve elementen; focusvolgorde moet logisch blijven en toasts/notificaties moeten rechts uitlijnen met iconen links gespiegeld.
2. **Dashboard/options**
   - Navigeer naar `chrome-extension://<id>/options.html`, activeer RTL en vernieuw de pagina.
   - Controleer dat navigatietabs, tabelkolommen en formulierelementen rechts uitlijnen en dat modals (bijv. prompt chain confirmatie, voice preview) spiegeling + focustrap behouden.
   - Verifieer dat melding banners en statusbadges de juiste hoek afronden en dat buttons nog steeds leesbare iconen hebben.
3. **Content sidebar**
   - Open een gesprek, schakel de sidebar in en activeer de richtingstoggle tot RTL.
   - Inspecteer History/Actions/Guides bubbels: boomstructuren moeten van rechts naar links openen en contextmenu’s naast de selectie verschijnen zonder het bericht te overlappen.
   - Start de chain-confirmatiemodal via `..` en controleer dat invoervelden rechts uitlijnen, validatieteksten op de juiste kant staan en dat `Esc` focus teruggeeft aan de composer.

## 2. Popup regression (repeat on both domains)
1. Confirm the extension icon is active when a chat tab is focused.
2. Open the popup and verify the header shows the product title, tagline, and auth status (`Premium features unlocked`, `Signed in (free tier)`, or `Offline mode`).
3. Inspect the **Guides & updates** card:
   - Loading state appears before data resolves.
   - “View” opens a new tab and logs a `telemetry event` row in the background worker console (check `chrome://extensions` → Service worker).
   - “Mark as viewed” toggles badges and persists after reopening the popup.
4. Language/direction controls:
   - Switching the language updates copy immediately, persists after closing/reopening the popup, and the dashboard/content surfaces adopt the new locale on refresh.
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
9. **Sidebar layout toasts**:
   - Open **Sidebar layout**, pin een sectie en bevestig dat er een toast verschijnt met een **Undo**-knop.
   - Activeer **Undo** en controleer dat de sectie direct terugkeert naar de vorige toestand.
   - Verberg dezelfde sectie, volg de toast en gebruik **Redo** om de wijziging opnieuw toe te passen.
10. **Lay-out resetten**:
   - Klik in **Sidebar layout** op **Lay-out resetten** en bevestig dat alle toggles terugvallen naar de standaardstatus (geen secties vastgezet, verborgen of ingeklapt).
   - Controleer dat zowel de popup als de content-zijbalk dezelfde reset tonen en dat er een toast verschijnt met de melding dat de lay-out is hersteld.
   - Gebruik **Undo** vanuit de toast om de vorige toestand terug te halen en **Redo** om de reset opnieuw toe te passen.

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

### 3.6 Passphrase & sync encryptie
1. Open de sectie **Wachtwoordzin & sync-encryptie** in het dashboard. Controleer dat de statusbadge “Nog niet ingesteld” toont bij een schone installatie en dat PBKDF2-iteraties zichtbaar worden zodra een passphrase is opgeslagen.
2. Vul een nieuwe wachtwoordzin van minimaal 8 tekens in, bevestig deze en klik op **Wachtwoordzin opslaan**. Verwacht een groene bevestigingstekst, een badge “Ingesteld · Ontgrendeld” en een iteratiewaarde.
3. Klik op **Nu vergrendelen** en bevestig via de badge dat de status naar “Ingesteld · Vergrendeld” wisselt. Controleer in de background console dat snapshot-mutaties een lock-fout loggen zolang de sleutel niet is ontgrendeld.
4. Vul dezelfde wachtwoordzin in het ontgrendelformulier in en klik op **Ontgrendelen**. Controleer dat de badge terugkeert naar “Ingesteld · Ontgrendeld” en dat je Dexie-acties weer zonder foutmeldingen kunt uitvoeren.
5. Test een foutscenario door een verkeerde wachtwoordzin in te voeren; er moet een rode foutmelding verschijnen zonder statuswijziging. Reset daarna eventueel met de juiste wachtwoordzin.
6. Vergrendel en ontgrendel nogmaals en controleer dat er een notificatiebanner bovenaan de sectie verschijnt met de juiste status (Configuratie, Vergrendeld, Ontgrendeld) en dat je deze handmatig kunt sluiten.

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
6. Locale persistence:
   - Na het wisselen van taal in de popup, open het dashboard en de sidebar opnieuw (Chrome/Edge op beide domeinen) om te bevestigen dat alle labels/knoppen direct dezelfde taal tonen zonder herinitialisatieglitches.
7. Popup-voorkeuren:
   - Open de kaart **Sidebar layout**, zet `Pinned conversations` vast en verberg `Recent conversations`. Controleer dat de content-zijbalk direct de badges `data-ai-companion-pinned-count="1"` en `data-ai-companion-hidden-count="1"` op het shadow-host element toont en dat de secties in/uit beeld schuiven zonder herload.
   - Hef de verborgen status op en bevestig dat de telling terugvalt. Herlaad de ChatGPT-pagina en controleer dat voorkeuren behouden blijven.
   - Gebruik de toast om **Undo**/**Redo** uit te voeren en verifieer dat zowel de popup als de content-zijbalk de herstelactie meteen reflecteren.
8. Dashboard-voorkeuren:
   - Ga naar **Zijbalkindeling** in het dashboard, vink `Prompt templates` uit en `Voice & sync` aan voor inklappen. Bevestig in de content-zijbalk dat `Prompt templates` verdwijnt, `Voice & sync` ingeklapt rendert en de instellingen ook in de popup zichtbaar zijn.
   - Gebruik de toast op het dashboard om Undo/Redo te testen en controleer dat popup en content dezelfde statuswijzigingen tonen.
   - Herhaal in Firefox of Edge (indien beschikbaar) om browserspecifieke persistence te controleren.
   - Klik op **Lay-out resetten**, bevestig dat alle secties terug naar de standaardinstelling gaan in dashboard, popup en content, en gebruik Undo/Redo voor de reset-flow.
9. Toegankelijkheid van zijbalkknoppen:
   - Focus met `Tab` de collapse-knop van elke sectie in de content-zijbalk en controleer in Chrome DevTools → Accessibility pane dat de naam "Collapse/Expand {section}" toont en `aria-expanded` wisselt na `Space` of `Enter`.
   - Open de popup → **Sidebar layout** en navigeer met het toetsenbord door de pin/collapse/hide-knoppen. Verwacht dat elke knop de sectienaam in de aangekondigde labeltekst bevat en dat `aria-pressed` wisselt.
   - Herhaal de stap hierboven na het schakelen naar Nederlands om vertaalde aria-labels te verifiëren.

## 5. Composer counters & prompt launcher
1. Start drafting a message. Word/character counters update live and reset after sending.
2. Open the prompt launcher via `Ctrl+Space`/`⌘+K`; verify focus lands in the search field and the shortcut legend reflects the current platform.
3. Navigate the results list using only the keyboard (`ArrowUp/Down`, `Ctrl+/` scope cycling) and insert a prompt with `Enter`; confirm highlighted tokens reflect the fuzzy search match.
4. Type `//plan` and `..handover` in the composer to trigger the inline launcher. Bevestig dat de getypte tokens direct uit het invoerveld verdwijnen, het prompts-panel `plan` als zoekterm toont, het chain-panel zichtbaar wordt voor `..` en dat het toetsenbordverkeer (`Esc`, pijlen, `Enter`) focus terugbrengt naar de composer na sluiten.
5. Selecteer een prompt chain (via inline trigger of launcher), controleer dat de confirmatiemodal verschijnt met alle `{{variable}}` velden leeg en dat `Esc` de modal sluit zonder eerder ingevoerde waarden te bewaren.
6. Vul variabelen in, verifieer dat de preview realtime `{{variable}}` én `[[step.output]]` placeholders rendert, laat bewust een waarde leeg om de "Required" melding te zien, start de chain en controleer dat de composer de gegenereerde stappen ontvangt.
7. Toggle the favourites filter (`Ctrl+F`) and confirm results narrow accordingly. Switch the interface to RTL and repeat the navigation once.
8. Trigger the instruction overlay (open the launcher three times) and confirm the tip counter decrements until dismissed.

## 6. Privacy & sync verificatie

### 6.1 Encryptieservice
1. Open `chrome://extensions` → background service worker console en voer `chrome.runtime.sendMessage({ type: 'sync/encryption-configure', payload: { passphrase: 'Manual QA secret 01' } })` uit. Verwacht `{ status: 'configured' }` en een bevestigde status via `chrome.runtime.sendMessage({ type: 'sync/encryption-status', payload: {} })` met `configured: true` en `unlocked: true`.
2. Vraag een encryptie aan met `chrome.runtime.sendMessage({ type: 'sync/encryption-encrypt', payload: { plaintext: 'QA roundtrip' } })`. Noteer het ontvangen `envelope` object en valideer dat `status: 'ok'` is.
3. Voer `chrome.runtime.sendMessage({ type: 'sync/encryption-lock', payload: {} })` uit en bevestig via `sync/encryption-status` dat `unlocked: false`.
4. Probeer het opgeslagen `envelope` te decrypten terwijl het slot actief is (`sync/encryption-decrypt`). Verwacht een `{ status: 'locked' }` antwoord.
5. Ontgrendel met dezelfde passphrase (`sync/encryption-unlock`) en herhaal de decryptie. Het resultaat moet `{ status: 'ok', plaintext: 'QA roundtrip' }` opleveren.
6. Test een foutscenario door `sync/encryption-unlock` met een fout wachtwoord aan te roepen; verwacht `{ status: 'invalid' }`. Sluit af met `sync/encryption-lock` en log de console-uitvoer in het retrofitlog.
7. Ontgrendel opnieuw en laat de extensie een snapshot schrijven (bijv. verplaats een gesprek); voer daarna `await chrome.storage.sync.get('ai-companion:snapshot:v2')` uit in de background console. Controleer dat het object `mode: 'delegated'` bevat en dat de `data`-payload base64-gecodeerd is.
8. Activeer `sync/encryption-lock` en herhaal dezelfde Dexie-actie. Verwacht een `SyncSnapshotLockedError` in de background console en noteer de melding in het retrofitlog voordat je opnieuw ontgrendelt.

### 6.2 IndexedDB egress-audit
1. Open een ChatGPT-tab met de extensie actief en start Chrome DevTools (`Ctrl+Shift+I`). Ga naar het **Network**-paneel, selecteer `Fetch/XHR` en schakel **Preserve log** in.
2. Klik op het filterveld en voer `conversation` in. Wis de huidige log (`⟲` icoon) voordat je acties uitvoert.
3. Voer de volgende acties uit terwijl je het netwerk observeert: stuur een nieuw bericht, verplaats een gesprek naar een andere map via de sidebar en start de promptlauncher met `//` gevolgd door het inserten van een prompt. Controleer dat er geen requests naar externe hosts verschijnen met payloads die de volledige chatinhoud bevatten; de enige requests mogen first-party ChatGPT API’s of `chrome-extension://` protocollen zijn.
4. Inspecteer willekeurige verzoeken uit de lijst door op **Headers** → **Request payload** te klikken. Valideer dat teksten uit het gesprek niet naar niet-OpenAI hosts worden verzonden en dat extension-requests enkel metadata (bijv. ids, flags) bevatten.
5. Ga naar het **Application**-paneel → **IndexedDB** en bevestig dat de tabellen `conversations`, `messages`, `folders` en `folder_items` data bevatten. Controleer onder **Storage** → **chrome.storage.sync** dat snapshotdata versleuteld (`mode: 'delegated'` + base64 `data`) of leeg is. Documenteer eventuele afwijkingen in het retrofitlog.

### 6.3 Geautomatiseerde netwerkmonitor
1. Voer `npm run test` uit en controleer dat de output `✓ network monitor incidents captured` vermeldt. Dit script simuleert egress naar een onbekende host en een payload met conversatie-inhoud.
2. Open de background service workerconsole en voer `chrome.runtime.sendMessage({ type: 'monitoring/network-incidents', payload: {} }, console.log)` uit. Controleer dat het antwoord dezelfde incidenten bevat en dat `timestamp` en `reason` kloppen. Stop/Start de service worker na de review om het log te legen.

## 7. Completion & logging
1. Record outcomes, browser versions, domains tested, and any bugs in [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md) under the logbook section.
2. Attach relevant console logs or screenshots to the shared QA archive, referencing them from the log entry.

Keep this checklist synchronized with UI and storage changes. When a step becomes automated (e.g., Playwright coverage), annotate it here and add the scenario ID for quick cross-reference.
