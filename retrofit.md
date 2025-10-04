# Retrofitplan voor voorbeeldfunctionaliteit

## Context
- De map `example/jlalnhjkfiogoeonamcnngdndjbneina/4.0.9_0` bevat uitsluitend mappenamen (zoals `scripts/chatMenu`, `scripts/pinnedChats`, `html/promptLibrary`). Ze geven de gewenste surfaces en workflows weer, maar bevatten geen bronbestanden.
- In deze sessie is `src/content/textareaPrompts.ts` toegevoegd en aangesloten vanuit `src/content/index.ts`. Hiermee bestaat nu een floating promptlauncher die opgeslagen prompts in de ChatGPT-composer kan invoegen.
- De content-zijbalk (`src/content/ui-root.tsx`) toont nu vastgezette gesprekken, recente updates, bladwijzers en een snelle promptlijst binnen dezelfde shadow-root. Verdere toggles en voorkeuren staan hieronder in de checklist.
- Popup en Options tonen nu een schakelaar om de ChatGPT-zijbalk te activeren of verbergen (gesynchroniseerd via de gedeelde store).
- Onderstaande acties beschrijven hoe de overige "scripts" en "html" mappen uit het voorbeeld vertaald kunnen worden naar onze huidige architectuur (Dexie + Zustand + React voor popup/options + vanilla overlay in content).

## Prioriteiten en stappen per featuregroep

### 1. Conversatiebeheer en zijbalk (`scripts/sidebar`, `scripts/manageChats`, `scripts/featuresCollapse`)
- [x] **Shadow-root container:** gerealiseerd via `src/content/sidebar-host.ts` + `src/content/ui-root.tsx`; React surface mounted in ChatGPT-zijbalk.
- [x] **Zustand bridge:** `src/shared/state/settingsStore.ts` hydrateert nu `showSidebar` via `chrome.storage` en synchroniseert popup/options/content.
- [x] **Datalaag:** huidige sidebar gebruikt `usePinnedConversations`, `useRecentConversations`, `useRecentBookmarks`, `usePrompts` voor basispanelen.
- [ ] **Collapse functionaliteit:** lokale Zustand store (`useSidebarStore`) met persistente voorkeuren (`storageService.writeLocal` voor `sidebar:sections`).
- [ ] **Toetscombinaties en focus:** sneltoets (bijv. `Alt+Shift+K`) om sidebar te toggelen + focus restore/escape-handling.

### 2. Pinnen, verplaatsen en bulkacties (`scripts/manageChats`, `scripts/moveChat`, `scripts/pinnedChats`, `scripts/pinnedFolders`)
1. **Pinned surface:** breid de nieuwe zijbalk uit met een sectie die `togglePinned` en `archiveConversations` gebruikt als inline acties. Toon twee kolommen: vastgezette gesprekken en snelkoppelingen naar mapstructuur (`useFolderTree('conversation')`).
2. **Bulkselectie:** voeg in `HistorySection` (options) selectievakjes toe (Zustand store uitbreiden om selectie bij te houden). Gebruik nieuwe helper `toggleSelection` en voer `archiveConversations`/`deleteConversations` uit op de selectie.
3. **Verplaatsen naar map:** roep `upsertConversation` aan met nieuw `folderId` vanuit een "Move"-dialoog. Bouw een gedeelde component `MoveDialog` in `src/ui/components` die zowel in popup als in de toekomstige sidebar hergebruikt kan worden.
4. **Pinned folders:** uitbreiden van `folders.ts` met een boolean `favorite` om sneltoetsen naar mappen te tonen. Voeg migratie toe in `db.version(6)` met `favorite` index. Exposeer helpers `toggleFavoriteFolder`.

### 3. Bladwijzers in de conversatie (`scripts/bookmarkMessage`, `scripts/chatMenu`)
1. **Inline actieknoppen:** in `src/content/index.ts` voeg tijdens `collectMessageElements()` extra knoppen toe in elke ChatGPT-berichtbubble (gebruik `element.querySelector('[data-message-author-role]')`). Maak een utility die voorkomt dat we dubbele knoppen plaatsen.
2. **Bookmark API-koppeling:** gebruik `toggleBookmark(conversationId, messageId, note)` om bladwijzers te beheren. Voorzie een modaal (shadow-root) om notities toe te voegen. Hergebruik `Modal` component (render via portal naar shadow-root).
3. **Context menu (`chatMenu`):** implementeer een rechtsklik-menu (custom contextmenu) dat acties bevat als "Opslaan als prompt", "Pin gesprek", "Open in dashboard".
4. **Synchronisatie naar popup/options:** zorg dat `useRecentBookmarks` de nieuwe metadata (notities, messagePreview) kan tonen; breid `db.bookmarks` uit met `messagePreview` door bij het opslaan eerste 200 chars op te nemen.

### 4. Promptbibliotheek en waardeketens (`scripts/promptLibrary`, `scripts/promptValues`, `scripts/chainValues`)
1. **Prompt variabelen:** voeg in `PromptRecord` een veld `variables: string[]` toe (Dexie migratie). Update UI-formulieren in `PromptsSection` om variabele tags te beheren.
2. **Prompt invulscherm:** breid `textareaPrompts` uit met een stap na selectie: toon formulier om variabelen te vervangen. Gebruik modale overlay + simpele form state. Na invullen injecteer template met `{{var}}` vervangen.
3. **Prompt chain execution:** bouw een runner in content script (`chainRunner.ts`) die `PromptChainRecord` ophaalt en sequentieel prompts in de composer plaatst met pauzes. Koppel via `messageRouter.register('content/run-chain')` zodat popup/options knoppen kunnen sturen.
4. **Koppeling met GPT's:** wanneer een prompt gekoppeld is aan een GPT, toon in overlay snelkoppelingen om direct dat GPT te openen (`chrome.tabs.create` met GPT-URL die in storage is opgeslagen).

### 5. Mapbeheer voor prompts en GPT's (`scripts/addFolder`, `scripts/manageFolder`, `scripts/manageFolders`, `scripts/GPTs`, `scripts/managePrompts`)
1. **Submap UI:** breid `FolderTreeList` in `src/options/features/shared.tsx` uit met drag & drop (bijv. `@dnd-kit/core`). Maak API-functies `reparentFolder`, `reorderFolder` in `core/storage/folders.ts`.
2. **Inline toevoeging (`addFolder`):** in popup en sidebar een compacte input die `createFolder` met `kind` parameter gebruikt. Valideer op duplicaten binnen dezelfde parent.
3. **GPT detailmodaal:** voeg modal in `PromptsSection` om GPT-details te bewerken inclusief weergave van gekoppelde prompts (`promptCounts`). Sta toe om GPT uit content script te selecteren voor "set assistant" scenario's.
4. **Bulkimport/exports:** implementeer `importPrompts(payload)` en `exportPrompts()` in `core/services/exportService.ts`, zodat promptbibliotheek synchroniseert met JSON.

### 6. Geavanceerde conversatieanalyse (`scripts/historySearch`, `scripts/conversation`, `scripts/exportChat`)
1. **Full-text search:** gebruik bestaande webworker `searchIndex.worker.ts`. Voeg indexing van prompt content en bookmark notities toe. Bied in popup een zoekbalk die realtime resultaten uit worker toont.
2. **Conversation analytics:** bereken extra metrics (gemiddelde antwoordlengte, responstijd) in `computeTextMetrics`. Sla aggregaten op in nieuw Dexie-table `insights`. Toon grafieken in options (d3 of chart.js).
3. **Export UI:** Markeer exportjobs per formaat. Voeg `format` selectie (json/txt/csv) aan options toe; voer `jobs/schedule-export` aan met format payload. Voeg ook "export geselecteerde" in history tabel.

### 7. Media en audio (`scripts/mediaGallery`, `html/mediaGallery`, `scripts/downloadVoice`, `scripts/textareaPrompts` integratie)
1. **Audio capture:** in content script observeer audio-elementen (`audio` tags ChatGPT voice). Indien `autoDownloadEnabled`, roep nieuwe achtergrond message `media/download-audio` aan die `chrome.downloads.download` gebruikt (hergebruik `exportHandler.triggerDownload`).
2. **Media gallery UI:** vul `MediaSection` met echte data uit nieuwe Dexie-table `mediaAssets` (veld: id, conversationId, type, url, createdAt). Toon preview in modal `MediaOverlay`.
3. **Sync voice presets:** gebruik `storageService.writeEncrypted('voice-presets', ...)` zodat ingestelde stemmen cross-device synchroniseren.
4. **Textarea prompts audio cues:** uitbreid `textareaPrompts` met een "Play" knop als een prompt audio-referenties bevat (metadata veld `audioUrl`).

### 8. Richting (RTL) en instellingen (`scripts/direction`, `scripts/settings`, `html/direction`)
1. **Taalwissel on-the-fly:** luister in content script naar `chrome.storage.onChanged` voor `settings:language` en wissel `document.documentElement.dir` en `mountPromptLauncher` labels.
2. **Direction toggles:** voeg in popup een switch die `useSettingsStore.toggleDirection()` aanroept. Content script moet op `messageRouter` kanaal `settings/direction` luisteren en inline UI spiegelen.
3. **Instellingenpagina:** bouw in options een nieuw tabblad "Instellingen" dat alle toggles (auto download, show sidebar, direction) groepeert en storage service gebruikt voor persistente schrijf/lees.

### 9. Info & betalingen (`scripts/infoAndUpdates`, `scripts/payments`)
1. **Release notes surface:** voeg in popup een collapsible kaart die markdown release notes laadt uit `public/updates.json`. Maak een Dexie tabel `announcements` om gezien-status te bewaren.
2. **Billing CTA:** implementeer in options een sectie "AI Companion Plus" met knoppen die `chrome.tabs.create` naar billing-URL openen. Gebruik `settingsStore` om premium-flag op te slaan (al aanwezig in auth status response).
3. **Webhook poller:** breid `background/jobs/scheduler` uit met jobtype `billing-sync` dat periodiek status ophaalt (stub API). Toon resultaten in popup kaart "Abonnement".

## Technische overwegingen
- Voeg nieuwe Dexie-versie 6 toe voor extra velden (`favorite`, `variables`, `mediaAssets`). Update tests in `tests/storage` zodra beschikbaar.
- Houd rekening met `approval_policy=never`; scripts mogen geen destructieve bewerkingen doen zonder fallback.
- Documenteer elke nieuwe surface in `docs/architecture.md` zodat toekomstige sessies ingestoken features herkennen.
- Breid `tests` uit met Playwright/E2E scenario's voor prompt-insert, sidebar toggle, bookmark flows.

## Afronding
- Wanneer de bovengenoemde stappen afgerond zijn, actualiseer `README.md` met nieuwe surface-screenshots en korte featurelijst.
- Hergebruik `retrofit.md` als checklist: vink secties af en noteer datum + commit in een log onderaan dit document.




