# Retrofitplan voor voorbeeldfunctionaliteit

## Samenvatting

Dit document is het leidende werkdossier om de `example/example/1`-mockups in lijn te brengen met de huidige extensie. Het bundelt welke flows al live zijn, wat actief ontwikkeld wordt, en welke items nog in de ontwerpfase zitten.

| Featuregroep | Scope in dit retrofit | Status | Laatste update |
| --- | --- | --- | --- |
| Conversatiedock & bubbels | Shadow-root host, dock rechts, contextuele bubbels, sneltoetsen | ✅ Gereed | 2024-06-15 |
| Pin- & bulkbeheer | Pinned-overzicht, bulkacties, verplaatsingen, favoriete mappen | 🚧 Ontwikkeling | 2025-10-13 – _pending_ (dockfavorieten + caching) |
| Bladwijzers & contextmenu | Bubbelgestuurde acties, notitiemodaal, contextmenu, popup-sync | 🚧 Ontwikkeling | 2025-10-08 – 6361a26 (bookmark-modal preview + regressietest) |
| Promptbibliotheek & ketens | Variabelen, invulscherm, chain runner, GPT-koppelingen | 🚧 Ontwikkeling | 2025-10-09 – _pending_ (variabelen + cancel runner) |
| Mapbeheer & GPT's | Drag & drop, inline create, GPT-detailmodaal, import/export | 📝 Ontwerp | _nog te plannen_ |
| Conversatieanalyse & export | Full-text search, analytics, export-UI | 📝 Ontwerp | _nog te plannen_ |
| Media & audio | Audio capture, mediagalerij, voice presets, audio cues | 💤 Gepland | _nog te plannen_ |
| Richting & instellingen | Dynamische taal/dir, settings-tab | 🚧 Ontwikkeling | _bijwerken tijdens iteratie_ |
| Info & betalingen | Release notes, billing CTA, webhook-poller | 📝 Ontwerp | _nog te plannen_ |
| Composer uitbreidingen | Telleroverlay, placeholderhelper, instructieoverlay, ketentab | 🚧 Ontwikkeling | 2025-10-07 – _pending_ (ketentab live, keten-runner QA volgt) |
| Onboarding & gidsen | Guides dataset, kaart in options/popup, modal in content | 📝 Ontwerp | _nog te plannen_ |
| Internationalisatie | Locale-generator, initI18n updates, RTL helpers, tests | 📝 Ontwerp | _nog te plannen_ |
| Iconen, beelden & audio | Icon-generator, styleguide, media-assets, notificatiesound | 📝 Ontwerp | _nog te plannen_ |
| Account & premium | Auth-service, account-store, premium gating, sync-job | 📝 Ontwerp | _nog te plannen_ |
| Sync, database & export | Backup schema, sync queue, uitgebreide export, QA | 📝 Ontwerp | _nog te plannen_ |

> **Onderhoudstip** – Werk de kolom “Laatste update” telkens bij met datum + commit (bijv. `2024-07-10 – abc1234`). Voeg extra rijen toe als een featuregroep moet worden opgesplitst of gedelegeerd.

## Context

- De map `example\example\1` bevat uitsluitend mappenamen (zoals `scripts/chatMenu`, `scripts/pinnedChats`, `html/promptLibrary`). Ze geven de gewenste surfaces en workflows weer, maar bevatten geen bronbestanden.
- In deze sessie is `src/content/textareaPrompts.ts` toegevoegd en aangesloten vanuit `src/content/index.ts`. Hiermee bestaat nu een floating promptlauncher die opgeslagen prompts in de ChatGPT-composer kan invoegen.
- Het conversatiedock aan de rechterzijde (`src/content/ui-root.tsx`) is nu het primaire navigatiepunt. Vanuit de shadow-root worden bubbels voor prompts, dashboard, bookmarks en toekomstige workflows aangestuurd.
- De inline zijbalk op de linkerkant is uitgefaseerd; alle navigatie en acties worden vanuit het bubblemenu rechts gestart.
- Popup en Options tonen nu een schakelaar om het bubbledock te activeren of verbergen (gesynchroniseerd via de gedeelde store).
- Onderstaande acties beschrijven hoe de overige "scripts" en "html" mappen uit het voorbeeld vertaald kunnen worden naar onze huidige architectuur (Dexie + Zustand + React voor popup/options + vanilla overlay in content).

## Werkwijze

1. **Prioriteer per tranche** – Focus op de onderdelen die in bovenstaande tabel als “🚧 Ontwikkeling” staan. Dat zijn de paden die direct waarde leveren bovenop bestaande componenten binnen het bubblemenu.
2. **Check ondersteunende documentatie** – Spiegel keuzes met `docs/roadmap.md` (planning) en `docs/testing/manual-regression.md` (kwaliteitsborging). Leg structurele beslissingen vast in `docs/decisions/`.
3. **Log voortgang** – Noteer onderaan in het logboek welke stappen afgerond zijn, inclusief datum, commit, tests en openstaande acties.
4. **Bewaar pariteit met voorbeeldfunctionaliteit** – Controleer per onderdeel welke UX-elementen in de voorbeeldmap beschreven zijn en documenteer expliciet wanneer je ervan afwijkt.

## Sessieresultaten 2025-10-05

- **Folders & favorieten** – Dexie-schema versie 6 met `favorite` vlag staat live; `toggleFavoriteFolder` + ster-iconen zijn beschikbaar in options (`HistorySection`) en het rechterdock (`HistoryTab`).
- **Verplaatsdialogen** – Gedeelde `MoveDialog` component staat in `src/ui/components/MoveDialog.tsx` en is verbonden met zowel de dock-kaarten als de conversation-tabel in options. Conversations krijgen nu een "Verplaats"-knop die via `upsertConversation` de map bijwerkt.
- **Pinned workflow** – Pinned-lijst toont favorieten en gebruikt dezelfde dialoog; folder-snelkoppelingen tonen nieuwe `Fav`-badges.

## Sessieresultaten 2025-10-08

- **Bookmark-modal preview** – Bubble-overlay toont nu messagePreview + opgeslagen-badge binnen `BookmarkDialog`; popup toont dezelfde metadata. Regressietest `tests/content/bookmarks.test.ts` waarborgt opslagpad voor `toggleBookmark`.

## Volgende stappen

1. **Bladwijzer-overlay afronden** –
   - ✅ Modal binnen de shadow-root toont nu een inline preview, bestaande notitie en "saved"-badge met `createdAt`-tijdstempel (`BookmarkDialog`).
   - ✅ `useRecentBookmarks` en popup/options surface tonen `messagePreview` en notities; regressietest `tests/content/bookmarks.test.ts` bewaakt toggle-pad en Dexie-opslag.
   - ✅ QA: smoke-test uitgevoerd op Chrome 129 (Linux) en Edge 128 (Windows VM) – overlay rendert binnen shadow-root, sluit op `Escape`, en noteer focus-trapgedrag in [`docs/testing/manual-regression.md`](docs/testing/manual-regression.md#bookmark-overlay-smoke-test).
2. **Contextmenu herintroduceren** – ✅ Custom contextmenu beschikbaar vanuit de chatberichten met acties voor bookmarken, prompt opslaan, kopiëren en pinnen (rendered via `CompanionSidebarRoot`). Laatste updates:
   - ✅ Guard toegevoegd die het menu sluit bij unmount van `CompanionSidebarRoot` en bij het verbergen van de sidebar.
   - ✅ Toetscombinaties en toegankelijkheidslabels vastgelegd in `docs/accessibility/context-menu.md` + Playwright-scenarioplan vastgelegd in `tests/e2e/context-menu.spec.ts`.
3. **Promptketens en variabelen** –
   - ✅ `src/core/models/records.ts` uitgebreid met `variables` + `lastExecutedAt` zodat recente runs bovenaan verschijnen.
   - ✅ Formulierlogica in `src/options/features/prompts/PromptsSection.tsx` ondersteunt variabelenpillen met `promptVariablesSchema`-validatie.
   - ✅ Chain-runner (`textareaPrompts`) gekoppeld aan `usePromptChainsStore` en aangevuld met een cancel-pad zodat runtime state gedeeld en afbreekbaar is.
   - ✅ QA-notes in `docs/testing/manual-regression.md` (sectie "Promptketens") documenteren volledige flow inclusief annuleren tijdens uitvoering.
4. **Bulkexport conversaties** –
   - ✅ Dashboard/Options toont nu een "Selectie exporteren"-actie in de gesprekssectie inclusief JSON/TXT-keuze en planning via `jobs/schedule-export`.
   - ✅ QA: Exportmodal getest met één en meerdere gesprekken en genoteerd in de regressiegids (Dashboard stap 6) + job zichtbaar in de kaart "Scheduled exports".
5. **Verplaatsdialogen afronden** –
   - ✅ Options-geschiedenis hergebruikt `MoveDialog` per rij zodat gesprekken naar mapstructuur of bovenste niveau verplaatst kunnen worden.
   - ✅ QA: Chrome 129 (Linux) – verplaatsing heen en terug gevalideerd; nieuwe stap toegevoegd aan regressiegids (Dashboard stap 7).
6. **Bulkverplaatsing gesprekken** –
   - ✅ Selectie in Dashboard/Options opent nu dezelfde verplaatsdialoog zodat meerdere gesprekken in één actie naar een map of het hoofdniveau kunnen worden verplaatst.
   - ✅ QA: Bulk-move gevalideerd op de dashboardtabel; regressiegids uitgebreid met stap 8 en logboek bijgewerkt.
7. **Favoriete mappen in het dock beheren** –
   - ✅ Map-snelkoppelingen in de History-tab tonen sterknoppen zodat favorieten direct vanuit het bubbledock aangepast kunnen worden.
   - ✅ `useBubbleLauncherStore` hydrateert via `chrome.storage.local` (`initializeBubbleLauncherStore`) en cachet de geflatteerde mapstructuur, zodat favorieten onmiddellijk zichtbaar zijn bij heropenen.
   - ✅ QA: Nieuwe regressiestap voor dock-favorieten toegevoegd aan [`docs/testing/manual-regression.md`](docs/testing/manual-regression.md#bookmark--pin-workflow).

8. **Gidsstatus synchroniseren** –
   - ✅ `useSettingsStore` bewaart `dismissedGuideIds` en synchroniseert wijzigingen tussen popup, options en content.
   - ✅ Options- en popup-surfaces tonen een “Markeer als bekeken”-toggle inclusief badge, persistente status en omkeeractie.
   - ✅ QA: Regressiegids uitgebreid met stappen voor gids-toggles in zowel dashboard als popup.

## Prioriteiten en stappen per featuregroep


### 1. Conversatiedock en bubbels (`scripts/sidebar`, `scripts/manageChats`, `scripts/featuresCollapse`)
- [x] **Shadow-root container:** gerealiseerd via `src/content/sidebar-host.ts` + `src/content/ui-root.tsx`; React surface gemount in het rechter dock en losstaand van de standaard ChatGPT-zijbalk.
- [x] **Zustand bridge:** `src/shared/state/settingsStore.ts` hydrateert nu `showDock` via `chrome.storage` en synchroniseert popup/options/content.
- [x] **Bubbelrouter:** het dock gebruikt `useBubbleLauncherStore` om per bubbel (prompts, dashboard, bladwijzers, instellingen) state te bewaren en overlays te openen.
- [x] **Contextuele panelen:** elke bubbel laadt een eigen paneel met `usePinnedConversations`, `useRecentConversations`, `useRecentBookmarks`, `usePrompts` als basis.
- [x] **Toetscombinaties en focus:** `Alt+Shift+K` toggelt het dock, `Escape` sluit de actieve bubbeloverlay en focus wordt teruggezet naar de vorige context.

### 2. Pinnen, verplaatsen en bulkacties (`scripts/manageChats`, `scripts/moveChat`, `scripts/pinnedChats`, `scripts/pinnedFolders`)
1. **Pinned bubblepaneel:** breid de dock-bubbel "Pinned" uit met een paneel dat `togglePinned` en `archiveConversations` als kaartacties aanbiedt. Toon twee kolommen: vastgezette gesprekken en snelkoppelingen naar mapstructuur (`useFolderTree('conversation')`).
2. **Bulkselectie:** voeg in `HistorySection` (options) selectievakjes toe (Zustand store uitbreiden om selectie bij te houden). Gebruik nieuwe helper `toggleSelection` en voer `archiveConversations`/`deleteConversations` uit op de selectie.
3. **Verplaatsen naar map:** roep `upsertConversation` aan met nieuw `folderId` vanuit een "Move"-dialoog. Bouw een gedeelde component `MoveDialog` in `src/ui/components` die zowel in popup als in het dockpaneel hergebruikt kan worden.
4. **Pinned folders:** breid `folders.ts` uit met een boolean `favorite` om snelkoppelingen naar mappen direct in de bubbel te tonen. Voeg migratie toe in `db.version(6)` met `favorite` index. Exposeer helpers `toggleFavoriteFolder` en zorg dat `useBubbleLauncherStore` deze indices cachet voor snelle rendering.

### 3. Bladwijzers in de conversatie (`scripts/bookmarkMessage`, `scripts/chatMenu`)
1. **Bubbelgestuurde acties:** ✅ Actions-bubbel in het rechterdock toont nu een berichtenlijst op basis van `collectMessageElements()`, laat een doel selecteren en biedt bookmark-, prompt-, kopieer- en pin-acties inclusief "Refresh" voor nieuwe DOM-updates. QA: regressiegids aangevuld met een stappenblok voor de Actions-bubbel.
2. **Bookmark API-koppeling:** gebruik `toggleBookmark(conversationId, messageId, note)` om bladwijzers te beheren. Voorzie een modaal (shadow-root) om notities toe te voegen. Hergebruik `Modal` component (render via portal naar shadow-root) en open het via de bubbel "Bookmarks".
3. **Context menu (`chatMenu`):** implementeer een rechtsklik-menu (custom contextmenu) dat acties bevat als "Opslaan als prompt", "Pin gesprek", "Open in dashboard" en deze via `useBubbleLauncherStore` koppelt aan de corresponderende bubbels.
4. **Synchronisatie naar popup/options:** zorg dat `useRecentBookmarks` de nieuwe metadata (notities, messagePreview) kan tonen; breid `db.bookmarks` uit met `messagePreview` door bij het opslaan eerste 200 chars op te nemen en surface dit in zowel de bubbel als popup/options.

### 4. Promptbibliotheek en waardeketens (`scripts/promptLibrary`, `scripts/promptValues`, `scripts/chainValues`)
1. **Prompt variabelen:** voeg in `PromptRecord` een veld `variables: string[]` toe (Dexie migratie). Update UI-formulieren in `PromptsSection` om variabele tags te beheren.
2. **Prompt invulscherm:** breid `textareaPrompts` uit met een stap na selectie: toon formulier om variabelen te vervangen. Gebruik modale overlay + simpele form state. Na invullen injecteer template met `{{var}}` vervangen.
3. **Prompt chain execution:** bouw een runner in content script (`chainRunner.ts`) die `PromptChainRecord` ophaalt en sequentieel prompts in de composer plaatst met pauzes. Koppel via `messageRouter.register('content/run-chain')` zodat popup/options knoppen kunnen sturen.
4. **Koppeling met GPT's:** wanneer een prompt gekoppeld is aan een GPT, toon in overlay snelkoppelingen om direct dat GPT te openen (`chrome.tabs.create` met GPT-URL die in storage is opgeslagen).

### 5. Mapbeheer voor prompts en GPT's (`scripts/addFolder`, `scripts/manageFolder`, `scripts/manageFolders`, `scripts/GPTs`, `scripts/managePrompts`)
1. **Submap UI:** breid `FolderTreeList` in `src/options/features/shared.tsx` uit met drag & drop (bijv. `@dnd-kit/core`). Maak API-functies `reparentFolder`, `reorderFolder` in `core/storage/folders.ts`.
2. **Inline toevoeging (`addFolder`):** in popup en dockpaneel een compacte input die `createFolder` met `kind` parameter gebruikt. Valideer op duplicaten binnen dezelfde parent.
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
- ✅ **Taalwissel on-the-fly:** `mountPromptLauncher` synchroniseert i18n en direction zodra `chrome.storage` updates binnenkomen; labels en placeholders vernieuwen direct.
- ✅ **Direction toggles:** popup en dashboard-switches sturen nu `settings/direction` runtime-berichten waardoor content, popup en options realtime in sync blijven.
- ✅ **Instellingenpagina:** nieuw "Settings"-tabblad in options bundelt dock-, direction- en audio-toggles met persistente opslag via `useSettingsStore`.

### 9. Info & betalingen (`scripts/infoAndUpdates`, `scripts/payments`)
1. **Release notes surface:** voeg in popup een collapsible kaart die markdown release notes laadt uit `public/updates.json`. Maak een Dexie tabel `announcements` om gezien-status te bewaren.
2. **Billing CTA:** implementeer in options een sectie "AI Companion Plus" met knoppen die `chrome.tabs.create` naar billing-URL openen. Gebruik `settingsStore` om premium-flag op te slaan (al aanwezig in auth status response).
3. **Webhook poller:** breid `background/jobs/scheduler` uit met jobtype `billing-sync` dat periodiek status ophaalt (stub API). Toon resultaten in popup kaart "Abonnement".

### 10. Composer uitbreidingen (`scripts/counter`, `scripts/textareaPrompts`)
- [x] Introduceer `initComposerCounters` in `src/content/textareaPrompts.ts` die, naar analogie met `example/example/1/scripts/counter/injectWordsCounter.js`, via een `MutationObserver` de actieve ChatGPT-composer detecteert. Render een `div[data-ai-companion="composer-counters"]` in dezelfde shadow-root als de promptlauncher en toon woorden-, tekens- en tokenaantallen. Baseer tokenlimits op `settingsStore.maxTokens` (fallback 4096) en kleur de badge rood zodra limieten overschreden worden.
- [x] Vervang de placeholderlogica in `textareaPrompts` door een helper `updateComposerPlaceholder(language, promptHint)` die het bestaande `CHATGPT_PROMPT_PLACEHOLDER`-patroon uit de voorbeeldmanifest ("Message ChatGPT Normally, Use // ...") gebruikt. Luister naar `chrome.storage.onChanged` zodat taalwissels of aangepaste hints direct worden toegepast zoals in `scripts/textareaPrompts/changeDefaultPlaceholder.js`.
- [x] Voeg een instructieoverlay toe gebaseerd op `example/example/1/scripts/textareaPrompts/promptListInstructions.js`: richt een `Popover`-component in `src/ui/components` in die de combinaties `//` (prompt), `..` (keten) en `@@` (bookmark) uitlegt. Toon deze overlay de eerste drie keer nadat de launcher openklapt en bewaar de teller in `settingsStore.dismissedLauncherTips`.
- [x] Breid het launcherpanel uit met een tab "Ketens" waarin `PromptChainRecord`s compact getoond worden (titel, aantal stappen, laatst gebruikt). Hergebruik de instructies uit `scripts/textareaPrompts/chainListUI.js` door een React-versie (`ChainPreviewList`) te bouwen. Center de call-to-action "Start keten" rechtsboven en koppel aan het `content/run-chain` bericht dat in sectie 4 wordt toegevoegd. _(2025-10-07 – content runner + launcher UI live)_

### 11. Onboarding en gidsen (`assets/data/guides.json`, `html/infoAndUpdates`)
1. ✅ Kopieer `example/example/1/assets/data/guides.json` naar `public/guides.json` en breid het schema uit met `title`, `description` en `badgeColor` zodat we eigen copy kunnen plaatsen. Maak een type `GuideResource` in `src/core/models/guides.ts` met validatie via Zod. _(2025-10-16 – dataset + schema live)_
2. ✅ Bouw in `src/options/features/infoAndUpdates/GuideResourcesCard.tsx` een kaart die de gidsen toont met knoppen "Bekijken". Gebruik `chrome.tabs.create` om de Guideflow-URL in een nieuw tabblad te openen en log kliktelemetrie via `background/jobs/scheduler` (event `guide-opened`). _(2025-10-17 – _pending_ (GuideResourcesCard + event logging))_
3. Introduceer in `useSettingsStore` een veld `dismissedGuideIds: string[]`. Voeg een "Markeer als bekeken"-toggle toe per gids (zowel in options als in popup) en synchroniseer de status naar `chrome.storage.local` vergelijkbaar met het voorbeeld `setPreviousModal`/`setSelectedManageTabsItem` patroon.
4. Plaats in het promptlauncher-dock een nieuwe bubble "Guides" die de `GuideResourcesCard` in een modal opent. Gebruik `Modal` component en zorg dat het modaal in de content-shadow-root rendert zodat de gebruiker in-context hulp krijgt zoals in `html/infoAndUpdates`.

### 12. Internationalisatie en direction (`locales/*.json`)
1. Importeer de talen uit `example/example/1/locales` (ar, de, en, es, fr, he, hi, it, ja, zh). Schrijf een script `scripts/generate-locales.ts` dat de sleutel-naamgeving omzet naar onze `content.dock.*` structuur en voeg de resultaten toe aan `src/shared/i18n/locales/<lang>/common.json`.
2. Breid `initI18n` uit met `supportedLngs` en detecteer de taal van ChatGPT (`document.documentElement.lang`). Val terug op Engels indien onbekend en update `settingsStore.language` automatisch, met respect voor handmatige overrides.
3. Koppel `document.documentElement.dir` aan de taalrichting (zoals `isLTR` in de voorbeeldbestanden). Voeg in content een helper `applyDirectionToComposer(dir)` toe die body-, sidebar- en launcherklassen bijwerkt zodat RTL-aanpassingen correct renderen.
4. Schrijf Vitest-unit tests voor `generate-locales` (validate dat placeholders `{{ }}` intact blijven) en Playwright-scenario's die controleren dat een RTL-taal (bijv. Arabic) zowel in popup, options als content correct omschakelt.

### 13. Iconen, beelden en audio (`assets/icons`, `assets/images`, `assets/sounds/alert.mp3`)
1. Maak een generator `scripts/build-icons.ts` die de string-exporten uit `example/example/1/assets/icons/*.ts` omzet naar typed React-componenten in `src/ui/icons/*.tsx`. Voeg automatische booleaanse props toe (`size`, `strokeWidth`) en exporteer een index `@/ui/icons`.
2. Vervang hardgecodeerde Heroicons in dock/promptlauncher door de nieuwe iconen zodat de look overeenkomt met de voorbeeldextensie. Documenteer in `docs/styleguide.md` hoe iconen gekozen worden (lineair 1px, kleur via currentColor).
3. Selecteer uit `assets/images` een set achtergrondplaten (bijv. `ai-toolbox-banner.png`) en plaats ze in `public/media`. Gebruik ze in `infoAndUpdates` en premium-cards met `picture` voor responsive weergave.
4. Koppel `assets/sounds/alert.mp3` aan onze snackbar/notification flow: voeg in `src/shared/utils/notifications.ts` een optie `audible: true` die bij premium-events het mp3-bestand via `chrome.runtime.getURL` laadt en afspeelt. Respecteer een nieuwe instelling `settingsStore.playSounds`.

### 14. Account, authenticatie en premium-gating (`api/auth.js`, `api/payments.js`, `html/freeUser`)
1. Creeer `src/core/services/authService.ts` dat de flows uit `example/example/1/api/auth.js` herschrijft: `generateJWT`, `setAuthToken`, `setServerToken`, `setIsPaidUser`. Gebruik `fetch` met onze backend-URL (`ENV.API_BASE_URL`) en implementeer retries + exponential backoff.
2. Vorm een shared store `useAccountStore` (Zustand) met statevelden `accountId`, `isPaidUser`, `subscriptionTier`, `serverToken`. Synchroniseer de state via `chrome.storage.local` zoals de voorbeeldfunctie `setInitialStore` doet.
3. Bouw een hook `usePremiumGate(feature: PremiumFeature)` die UI-componenten laat controleren of een feature free of premium is. Toon modals vergelijkbaar met `html/freeUser` / `html/premiumModal` (met upgrade CTA) en log `feature_blocked` events voor analytics.
4. Integreer een backend-poll in `background/jobs/scheduler.ts` (`jobType: 'account-sync'`) die elke 6 uur `authService.refreshAccount()` draait. Bij downgrade moeten pinned-limieten en media-downloads automatisch gelimiteerd worden (follow-up events en UI notificaties).

### 15. Synchronisatie, database en export (`scripts/database.js`, `scripts/sync.js`, `scripts/exportConversations.js`)
1. Breid `src/core/storage/db.ts` uit met een `backup` schema (Dexie table `backups`) waarin snapshots van conversations/prompts worden opgeslagen. Gebruik `navigator.storage.persist()` en bewaar enkel een rolling window (laatste 10).
2. Introduceer `SyncQueue` in `src/core/storage/syncBridge.ts` dat de logica uit `example/.../scripts/sync.js` vertaalt: queue items (type, payload, retries) in `chrome.storage.local`, verstuur via background worker en markeer status.
3. Breng exportfunctionaliteit naar parity met `scripts/exportConversations.js`: voeg in `background/jobs/exportHandler.ts` support voor PDF, Markdown en CSV toe. Gebruik `assets/html/templates` (te maken) om exports te stylen en bied in options bulkselectie + progressbar.
4. Schrijf jest-tests voor `SyncQueue` (retry/backoff) en end-to-end tests die verifiëren dat bulkexport een zip met per-conversatie-bestanden oplevert. Documenteer in `docs/data-safety.md` hoe back-ups, sync en export samenwerken.

## Technische overwegingen

- Voeg nieuwe Dexie-versie 6 toe voor extra velden (`favorite`, `variables`, `mediaAssets`). Update tests in `tests/storage` zodra beschikbaar.
- Houd rekening met `approval_policy=never`; scripts mogen geen destructieve bewerkingen doen zonder fallback.
- Documenteer elke nieuwe surface in `docs/architecture.md` zodat toekomstige sessies ingestoken features herkennen.
- Breid `tests` uit met Playwright/E2E scenario's voor prompt-insert, dock toggle, bookmark flows.

## Afronding

- Wanneer de bovengenoemde stappen afgerond zijn, actualiseer `README.md` met nieuwe surface-screenshots en korte featurelijst.
- Hergebruik `retrofit.md` als checklist: vink secties af en noteer datum + commit in een log onderaan dit document.

## Logboek

| Datum | Commit | Featuregroep(en) | Opmerkingen |
| --- | --- | --- | --- |
| 2025-10-05 | _pending_ | Conversatiedock; pin/verplaats | Dexie v6 favoriete mappen + MoveDialog toegevoegd; lint uitgevoerd |
| 2025-10-05 | _pending_ | Bladwijzers & contextmenu | Bookmarkbubble toont live Dexie-data + notities; lint/test/build uitgevoerd |
| 2025-10-05 | _pending_ | Bladwijzers & contextmenu | Bookmarkmodal voor selectie & notities in content; lint/test/build uitgevoerd |
| 2025-10-05 | 4a71f23 | Composer uitbreidingen | initComposerCounters + composer telleroverlay; lint/test/build uitgevoerd |
| 2025-10-06 | _pending_ | Composer uitbreidingen | Placeholder helper + settings promptHint sync; lint/test/build uitgevoerd |
| 2025-10-06 | _pending_ | Bladwijzers & contextmenu | Contextmenu met bookmark/prompt/pin/copy-acties + toastfeedback toegevoegd; lint/test/build gepland |
| 2025-10-06 | _pending_ | Composer uitbreidingen | Launcher-instructiepopover + teller in settings; lint/test/build uitgevoerd |
| 2025-10-07 | _pending_ | Bladwijzers & contextmenu | Contextmenu sluit bij unmount; accessibiliteitsnotitie + E2E-plan toegevoegd; lint/test/build gepland |
| 2025-10-07 | _pending_ | Composer uitbreidingen | Ketentab + ketenrunner in launcher; npm run lint/test/build uitgevoerd |
| 2025-10-09 | _pending_ | Promptbibliotheek & ketens | Promptketen-variabelen, cancel-runner + QA-notes; npm run lint/test/build uitgevoerd |
| 2025-10-10 | _pending_ | Bladwijzers & contextmenu | Chrome 129 (Linux) + Edge 128 smoke-test bookmark overlay; npm run lint/test/build uitgevoerd |
| 2025-10-11 | _pending_ | Pin- & bulkbeheer | Bulkexportmodal ingepland voor selectie (JSON/TXT) + regressiegids bijgewerkt; npm run lint/test/build uitgevoerd |
| 2025-10-11 | _pending_ | Pin- & bulkbeheer | MoveDialog in options-geschiedenis + statusnotitie en regressiestap; npm run lint/test/build uitgevoerd |
| 2025-10-12 | _pending_ | Pin- & bulkbeheer | Bulkverplaatsing voor selectie + regressiestap bijgewerkt; npm run lint/test/build uitgevoerd |
| 2025-10-13 | _pending_ | Pin- & bulkbeheer | Dock-favorieten toggle + caching; npm run lint/test/build uitgevoerd |
| 2025-10-14 | _pending_ | Richting & instellingen | RTL-synchronisatie + dashboard-instellingen; npm run lint/test/build |
| 2025-10-15 | _pending_ | Bladwijzers & contextmenu | Actions-bubbel activeert selecties + snelle acties; npm run lint/test/build uitgevoerd |
| 2025-10-16 | _pending_ | Onboarding & gidsen | Guides dataset + Zod-validatie toegevoegd; npm run lint/test uitgevoerd |
| 2025-10-17 | _pending_ | Onboarding & gidsen | Options-gidsenkaart + telemetry event logging; npm run lint/test/build uitgevoerd |
| 2025-10-18 | _pending_ | Pin- & bulkbeheer | Dock-favorieten cache hydrateert via chrome.storage; unit test bubbleLauncherStore + lint/test/build uitgevoerd |
| 2025-10-18 | _pending_ | Onboarding & gidsen | Guides “Markeer als bekeken”-toggles + storage sync; npm run lint/test/build uitgevoerd |
| _vul in_ | _vul in_ | _vul in_ | _korte notitie over tests, regressies, follow-up_ |

