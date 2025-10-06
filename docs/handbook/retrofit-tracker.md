# Retrofit tracker

_Last reviewed: 2025-10-08_

Dit dossier koppelt de bestaande extensie aan de nieuwe **privacy-first, local-first** roadmap. Gebruik het om pariteit met ChatGPT Toolbox te meten, plus-features te plannen en QA/retrofit-besluiten te loggen. Synchroniseer wijzigingen steeds met [`docs/handbook/product-roadmap.md`](./product-roadmap.md), de regressiegids en relevante ADR's.

## Doel van de extensie
De extensie evolueert naar een **volledige productiviteitssuite** bovenop ChatGPT die gebruikers hun gesprekken, prompts en multimediageneraties laat beheren zonder data uit handen te geven. Uiteindelijk moeten professionals al hun AI-werkstromen binnen één zijbalk kunnen starten en afronden: gesprekken ordenen via mappen en pins, prompts en chains als templates hergebruiken, multimediaproductie (beeld/audio) exporteren en dit alles lokaal opslaan met optionele versleutelde sync. Succes betekent dat de extensie sneller en betrouwbaarder is dan de native ChatGPT-ervaring, terwijl hij privacy-audits doorstaat en enterprise-uitbreidingen (SSO, RBAC, agentische tooling) kan inschakelen wanneer teams opschalen.

## Overzicht pariteit → plus
| Featuregroep | Kernscope | Status | Laatste update |
| --- | --- | --- | --- |
| Gespreksbeheer & mappen | Onbeperkte mappen/submappen, GPT-koppeling, drag & drop, pinned folders, bulk verplaatsing | 🟥 Gap – ontwerp | 2025-02-14 – roadmap geaccepteerd |
| Professionele zijbalk | History search (<150 ms), pin/hide, bulkacties, collapse GPTs, undo flows | 🟧 Gap – analyse | 2025-02-16 – MiniSearch tags/mappen, 10k build 1.5 s / query 3 ms |
| Chat pinning & bulkacties | Pin/unpin met shortcut, bulkselectie 500+, exact filters, persistente state | 🟧 Gap – analyse | 2025-02-14 – Dexie schema review |
| Promptbibliotheek | CRUD, tagging, versies, favorieten, `//` launcher ≤50 ms | 🟥 Gap – ontwerp | 2025-02-14 – trigger specs klaar |
| Prompt-chaining (10 stappen) | Placeholder validatie, `..` launcher, batch-run, tussenoutput logging | 🟥 Gap – ontwerp | 2025-02-14 – DSL uitgewerkt |
| Mediagalerij | Raster met prompt/gen/seed metadata, virtuele scroll, ZIP export ≤3 s | 🟥 Gap – ontwerp | 2025-02-14 – datamodel geschetst |
| Audio-export | MP3-pijplijn, voice-presets (free/premium), metadata/ID3, queue | 🟥 Gap – ontwerp | 2025-02-14 – encoder onderzoek |
| UI/UX thema & i18n | Meertaligheid incl. RTL, dynamische thema's, woord/tekenteller | 🟨 Iteratie | 2025-02-14 – thema tokens gereviseerd |
| Privacy & sync | IndexedDB-only content, opt-in AES-GCM promptsync, netwerkverificatie | 🟨 Iteratie | 2025-02-14 – encryptieplan opgesteld |
| Chaining++ (templates/branching/analytics) | Conditionele nodes, sjablonen, runtime-metrics, promptkoppeling | 🟦 Plus backlog | Nog te plannen |
| Agentische tools & SDK | Web/file/computer use, Responses API, extensible SDK | 🟦 Plus backlog | Nog te plannen |
| Enterprise & Azure integraties | SSO/RBAC, auditlog, Key Vault, App Insights, Content Safety | 🟦 Plus backlog | Nog te plannen |

> **Legenda** – 🟥 ontwerp nodig · 🟧 analyse/technische spikes · 🟨 actieve iteratie · 🟩 gereed · 🟦 toekomstige pluslaag.

## Samenvatting voortgang
- Fase 1 (Pariteit MVP) is in architectuurfase: storage, search en launcher-scenario's zijn gespecificeerd maar niet gebouwd.
- RTL/thema-herziening is in uitvoering; andere UI-pariteitsfeatures wachten op componentrefactor.
- Zoekindex verrijkt nu titels met tag- en mappad-tokens; cold build op 10k berichten duurde ~1,5 s met queries rond 3 ms.
- Versleutelde sync en audio/media pipelines vereisen service-worker uitbreidingen (nog niet gepland).
- Pluslaag (branching, agent tools, enterprise) blijft op backlog totdat pariteit bereikt is.

## Kernprincipes (bevestigd)
1. **Local-first privacy** – chats in IndexedDB, alleen versleutelde promptsync optioneel.
2. **Sneller dan scrollen** – exacte filters + minisearch index, P95 <150 ms.
3. **Herbruikbaarheid** – `//` voor prompts, `..` voor chains, placeholders en variabelen.
4. **Cross-browser** – Chrome/Edge basiskanaal, Firefox-compatibiliteit in fase 2.

## Actieve iteraties & deliverables
- **Search & sidebar spike**
  - [x] Dexie-schema uitbreiden met `folders` en `folder_items` tabellen.
  - [x] MiniSearch indexeren op titel, tags, map-hiërarchie; meten latency bij 10k berichten (cold build 1.5 s, query ~3 ms op 10k).
  - [x] UI-wireframes voor zijbalk pin/hide/collapse flows uitwerken.
- **Launcher ervaring**
  - [ ] Promptlauncher UX (keyboard-first) definiëren; fuzzy search testen.
  - [x] Chain DSL parser (placeholders, [[step.output]]) prototypen. _(afgerond 2025-10-05 – parsermodule + evaluatiehooks toegevoegd.)_
  - [x] Inline triggers `//` en `..` integreren met bestaande composer store. _(afgerond 2025-10-06 – triggers ruimen inline tokens op, vullen promptfilter en openen ketenpaneel via composer store.)_
- **Privacy & sync voorbereiding**
  - [x] AES-GCM encryptieproof-of-concept in service worker met PBKDF2.
  - [x] IndexedDB audit: bevestig geen network egress van chatinhoud. _(afgerond 2025-10-10 – codebase gescand op fetch/beacon calls met chatpayloads; DevTools-netwerkstappen gedocumenteerd en regressiegids aangevuld.)_
  - [x] Documenteer verificatiestappen voor QA (DevTools Application/Network).
 - [x] Dexie sync-snapshots versleutelen via passphrase-service met lokale fallback en lock-signalen.
- **Theming & i18n**
  - [x] CSS variabelen voor light/dark/high-contrast invoeren. _(afgerond 2025-10-13 – globale themavariabelen, Tailwind tokens en theme-manager toegevoegd; settings-store bewaart nu voorkeur en surfaces luisteren naar systeemcontrast/kleuren.)_
  - [ ] RTL smoketests uitvoeren in content, popup en options.
  - [ ] Locale switcher koppelen aan instellingenstore met persistente voorkeur.

## Volgende stappen
1. [x] Dexie-schema uitbreiden met `folders` en `folder_items` tabellen. _(afgerond 2025-02-15)_
   - **Prioritering** – Gereed: schema v8 levert stabiele sleutels voor bulkacties en toekomstige Minisearch-indexering. Volgende stap is de indexuitbreiding zodat hiërarchische queries performant blijven.
   - **Documentatie** – ADR `docs/handbook/adr-20240215-auth-and-data-model.md`, roadmap (`docs/handbook/product-roadmap.md`) en regressiegids zijn bijgewerkt met de nieuwe pivot (`folder_items`) en IndexedDB-resetinstructies.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: bij eerstvolgende browserrun DevTools → Application → IndexedDB controleren op `folders`/`folder_items`, basis CRUD uitvoeren en netwerkverkeer inspecteren (geen chatcontent POSTs) en vastleggen in logboek/regressiechecklist.
2. [x] MiniSearch indexeren op titel, tags, map-hiërarchie; meten latency bij 10k berichten. _(afgerond 2025-02-16)_
   - **Prioritering** – Index verrijkt met tag-tokens en volledige mappaden zodat komende UI-flows direct de juiste context tonen; cold build op 10k berichten blijft onder 1,5 s, queries rond 3 ms. Volgende stap is de zijbalk-wireframes finaliseren.
   - **Documentatie** – Retrofitlog (dit bestand) en roadmap bijgewerkt; nieuwe test `tests/core/searchService.spec.ts` documenteert conversatie/tag/folder indexing.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test` (Node 20.19.0). Handmatig: 10k-dataset benchmark via ad-hoc script (`buildSearchIndex` 1.495 s, zoekopdracht 3.067 ms, 100 resultaten).
3. [x] UI-wireframes voor zijbalk pin/hide/collapse flows uitwerken. _(afgerond 2025-02-17)_
   - **Prioritering** – Wireframes dekken pin/hide/collapse flows zodat development van Zustand-state en UI-componenten kan starten; volgende stap is toetsen met accessibility review en integratie met mapnavigatie.
   - **Documentatie** – Nieuwe ontwerpnotitie `docs/design/sidebar-pin-wireframes.md`; tracker (dit bestand) en roadmap-tickets gelinkt voor implementatieplanning.
   - **QA-notes** – Geautomatiseerd: n.v.t. (design deliverable). Handmatig: heuristische UX-review uitgevoerd (consistency, Fitts, keyboard flow) en acties voor A11y-tests genoteerd in ontwerpnotitie.
4. [x] Promptlauncher UX (keyboard-first) definiëren; fuzzy search testen. _(afgerond 2025-02-18)_
   - **Prioritering** – Launcher wordt primaire toegang tot prompts/chains; keyboard-first specificatie borgt <50 ms inserties en maakt de weg vrij voor DSL-integratie. Volgende stap is chain-parserprototype koppelen aan deze UX en shortcuts configureerbaar maken via settings.
   - **Documentatie** – Nieuwe UX-notitie `docs/design/prompt-launcher-ux.md`; roadmap (`docs/handbook/product-roadmap.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) geüpdatet met nieuwe scope en QA-stappen.
 - **QA-notes** – Geautomatiseerd: te plannen Vitest-suite voor searchpipeline en keyboardreducer. Handmatig: heuristische toetsing uitgevoerd (keyboard-only flow, inline `//` trigger, RTL layout) en QA-checklist aangevuld met verificatiestappen voor Chrome/Firefox.
5. [x] Chain DSL parser (placeholders, `[[step.output]]`) prototypen. _(afgerond 2025-10-05)_
   - **Prioritering** – Parser levert nu een token-stream + evaluatiehooks zodat launcher-confirmaties variabelen en step-outputreferenties kunnen resolven. Volgende stap is integratie met de composer store en async step-runner zodat `[[step.output]]` automatisch live-data invult.
   - **Documentatie** – Nieuwe module `src/core/chains/chainDslParser.ts`, testsuite `tests/core/chainDslParser.spec.ts`, retrofitlog (dit bestand), roadmap (`docs/handbook/product-roadmap.md`), UX-spec (`docs/design/prompt-launcher-ux.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) bijgewerkt.
 - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: scenario voor placeholder/step-output validatie beschreven in regressiegids; uitvoering volgt zodra launcher-confirmatie de parser consumeert.
6. [x] Inline triggers `//` en `..` integreren met bestaande composer store. _(afgerond 2025-10-06)_
   - **Prioritering** – Composer-events openen nu het juiste launcherpanel zodra `//` of `..` wordt getypt; tokens worden direct uit het invoerveld verwijderd en promptfilters vullen automatisch. Dit ontsluit keyboard-first flows voor prompts én chains zonder muisklikken. Volgende stap is het aansluiten van de chain-confirmatie op de parser zodat variabelen meteen renderen.
   - **Documentatie** – Nieuwe helpermodule `src/content/inlineLauncherTriggers.ts`, testsuite `tests/content/inlineLauncherTriggers.spec.ts`, retrofitlog (dit bestand), roadmap, UX-spec (`docs/design/prompt-launcher-ux.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) zijn bijgewerkt.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: op beide ChatGPT-domeinen `//plan` en `..handover` typen, bevestigen dat het launcherpanel opent, het zoekveld de query bevat en de composer geen triggertekens achterlaat; resultaat loggen in regressiegids.
7. [x] Chain-confirmatie koppelen aan parser en async step-runner voorbereiden. _(afgerond 2025-10-07)_
   - **Prioritering** – Confirmatiemodal leest nu prompttemplates via de DSL-parser, toont variabelen met live-preview en levert een `ChainRunPlan` aan de content-runner. Daarmee worden inline `//`/`..` flows fouttolerant en staat het fundament voor de asynchrone step-runner (cancel/resume & step-output streaming).
   - **Documentatie** – Roadmap (`docs/handbook/product-roadmap.md`) bijgewerkt met de nieuwe run-plan architectuur; regressiegids (`docs/handbook/manual-regression-checklist.md`) uitgebreid met de modal-verificatie; retrofitlog en logboek aangevuld. Nieuwe types gedocumenteerd in `src/shared/types/promptChains.ts`.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: via `//` en `..` een chain met `{{variable}}` en `[[step.output]]` starten, controleren dat de modal waarden verplicht stelt, placeholders realtime rendert en na annuleren opnieuw lege invoer biedt; resultaten vastleggen in regressiegids.
8. [x] AES-GCM encryptieproof-of-concept in service worker met PBKDF2. _(afgerond 2025-10-08)_
   - **Prioritering** – Sync-roadmap vereist een verifieerbare sleutelafleiding voordat opt-in promptsync kan landen. Dit POC levert een backgroundservice die passphrases via PBKDF2 → AES-GCM sleutels deriveert, verificatieciphertext bewaakt en encrypt/decrypt messaging routes aanbiedt. Volgende stap is het verbinden met Dexie sync-snapshots en UI voor passphrasebeheer.
   - **Documentatie** – Nieuwe module `src/background/crypto/syncEncryption.ts`, type `src/shared/types/syncEncryption.ts`, messaging-contract (`src/shared/messaging/contracts.ts`) en tests `tests/background/syncEncryptionService.spec.ts` toegevoegd. Retrofitlog (dit bestand), roadmap (`docs/handbook/product-roadmap.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) zijn bijgewerkt met de encryptiestroom en QA-instructies.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: in service-worker console `chrome.runtime.sendMessage({ type: 'sync/encryption-configure', payload: { passphrase: 'demo passphrase' } })` uitvoeren, status controleren via `sync/encryption-status`, daarna encrypt/decrypt rondtrip testen en `sync/encryption-lock` + `sync/encryption-unlock` doorlopen; resultaten documenteren in regressiegids.
9. [x] Dexie sync-snapshots koppelen aan AES-GCM passphrase-service en fallback documenteren. _(afgerond 2025-10-09)_
   - **Prioritering** – Storage-service detecteert nu of de passphrase geconfigureerd en ontgrendeld is; snapshots worden gedelegeerd naar de background encryptieservice en vallen terug op de lokale sleutel wanneer sync uit staat. Een lock blokkeert mutaties met een expliciete fout zodat passphrasebeheer in UI de volgende prioriteit is.
   - **Documentatie** – `src/core/storage/service.ts`, `src/core/storage/syncBridge.ts`, roadmap (`docs/handbook/product-roadmap.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) bijgewerkt met de delegatieflow en QA-stappen. Retrofitlog (dit bestand) en logboek aangevuld.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: in de background console `chrome.storage.sync.get('ai-companion:snapshot:v2')` controleren op `mode: 'delegated'`, encryptie locken en bevestigen dat snapshot-updates een `SyncSnapshotLockedError` loggen; bevindingen vastleggen in regressiegids/logboek.
10. [x] IndexedDB audit afronden en netwerkegress controleren. _(afgerond 2025-10-10)_
   - **Prioritering** – Bevestigt het privacy-principe dat chats lokaal blijven; door code-audit + DevTools validatie weten we zeker dat komende sync-functies niet vertrekken van een onveilige basis. Volgende stap is UI voor passphrasebeheer en het automatiseren van netwerkmonitoring in de testharnas.
   - **Documentatie** – Retrofitlog (dit bestand), roadmap (`docs/handbook/product-roadmap.md`), regressiegids (`docs/handbook/manual-regression-checklist.md`) en privacy-notities in `docs/handbook/product-roadmap.md` bijgewerkt met auditbevindingen en expliciete QA-stappen.
   - **QA-notes** – Geautomatiseerd: statische scan via `rg` op `fetch(`, `XMLHttpRequest` en `sendBeacon` (geen nieuwe oproepen buiten de guides-asset). Handmatig: DevTools Network-tab met `Fetch/XHR`-filter en zoekterm `conversation`/`prompt`; tijdens CRUD en launcherflows verschenen geen POST/PUT requests met chatinhoud, enkel `chrome`-extensieroutes en ChatGPT-first-party calls. Application-tab bevestigde dat `AICompanionDB` alle conversatiegegevens bevat en dat `chrome.storage.sync` geen platte tekst opslaat.
11. [x] Passphrasebeheer UI in dashboard/options bouwen. _(afgerond 2025-10-11)_
   - **Prioritering** – Met een dedicated passphrasepaneel in het dashboard kunnen QA en gebruikers de encryptieservice zonder console-scripts bedienen. Dit borgt dat sync-snapshots geblokkeerd blijven bij een vergrendelde sleutel en geeft inzicht in PBKDF2-iteraties. Volgende stap is het automatiseren van netwerkbewaking in het testrunbook en het toevoegen van notificaties wanneer de encryptiestatus wijzigt.
   - **Documentatie** – Nieuwe UI-sectie `src/options/features/privacy/EncryptionSection.tsx`, messaging-client `src/shared/messaging/syncEncryptionClient.ts`, vertalingen (`src/shared/i18n/locales/{en,nl}/common.json`) en testrun `tests/shared/syncEncryptionClient.spec.ts` toegevoegd. Retrofitlog (dit bestand), roadmap (`docs/handbook/product-roadmap.md`) en regressiegids (`docs/handbook/manual-regression-checklist.md`) bijgewerkt met de UI-flow en QA-stappen.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: opties-dashboard openen, passphrase instellen, ontgrendelen en vergrendelen via de UI, statusbadges en iteratiewaarde controleren, en bevestigen dat Dexie-snapshots bij een vergrendelde status foutmeldingen loggen. Resultaten vastleggen in regressiegids/logboek.
12. [x] Netwerkbewaking automatiseren in testrunbook en encryptiestatus-notificaties uitwerken. _(afgerond 2025-10-12)_
   - **Prioritering** – De background service worker hangt nu een fetch-proxy (`createNetworkMonitor`) aan zodat egress naar niet-whitelisted hosts en payloads met `content`/`prompt` direct worden gelogd en via runtime messaging uitleesbaar zijn. Tegelijkertijd stuurt de encryptieservice statusmutaties naar alle surfaces, zodat QA tijdens bulkacties onmiddellijk ziet wanneer een sleutel vergrendeld raakt.
   - **Documentatie** – Nieuwe modules `src/background/monitoring/networkMonitor.ts` en `src/background/monitoring/encryptionNotifier.ts` toegevoegd, plus `src/shared/messaging/encryptionEvents.ts` en de Zustand-store `src/shared/state/encryptionNotificationsStore.ts` met UI (`EncryptionStatusNotifications`). Regressiegids (`docs/handbook/manual-regression-checklist.md`) bevat nu een geautomatiseerde netwerkmonitorsectie en een notificatiecheck; roadmapsectie "Privacy & sync" krijgt een update over de live monitor. Retrofitlog bijgewerkt met verwijzing naar test `tests/background/networkMonitor.spec.ts`.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Het testrun-script controleert nu ook dat de netwerkmonitor incidenten detecteert en terugrapporteert. Handmatig: in opties de wachtwoordzin vergrendelen/ontgrendelen en bevestigen dat de nieuwe notificatiebanner verschijnt en sluitbaar is; in de background console `chrome.runtime.sendMessage({ type: 'monitoring/network-incidents', payload: {} }, console.log)` draaien om incidenten te controleren en daarna de service worker herstarten voor een schone staat.
13. [x] CSS variabelen voor light/dark/high-contrast invoeren. _(afgerond 2025-10-13)_
   - **Prioritering** – Gemeenschappelijke thematokens zorgen dat popup, opties en content dezelfde kleuren, focusringen en contrasten delen en automatisch meebewegen met systeeminstellingen. Dit opent de weg voor een UI-selector en RTL smoketests zonder per surface afwijkende stijlen.
   - **Documentatie** – Themalagen toegevoegd in `src/styles/global.css`, Tailwind uitgebreid (`tailwind.config.js`), theme-manager en voorkeurstypes toegevoegd (`src/shared/theme/*`), instellingenstore aangepast en testdekking opgezet (`tests/shared/theme/themePreference.spec.ts`). Dit retrofitlog, de roadmap en de regressiegids beschrijven nu thema-coverage en QA-stappen.
   - **QA-notes** – Geautomatiseerd: `npm run lint`, `npm run test`, `npm run build` (Node 20.19.0). Handmatig: in Chrome DevTools → Rendering `Emulate CSS prefers-color-scheme` (Light/Dark) én `Emulate CSS prefers-contrast: more` activeren; verifiëren dat `<html data-theme>` meewisselt, achtergronden/tekstcontrast aanpassen en focusringen zichtbaar blijven. Bevindingen loggen in de regressiegids.

## Definition of done per groep
### Gespreksbeheer & mappen
- [ ] CRUD-operaties O(1) in Dexie, inclusief nested structuren.
- [ ] Mapwissel rendeert ≤50 ms bij 2.000 conversaties (Profiler-rapport).
- [ ] Pinned folders staan bovenaan en zijn drag-and-drop reorderbaar.
- [ ] End-to-end: aanmaken → verplaatsen → zoeken → exporteren (TXT/JSON) geslaagd.

### Professionele zijbalk & pinnen
- [ ] Zoekopdrachten returneren <150 ms bij dataset van 10k berichten.
- [ ] Bulkselectie ondersteunt 500 items met undo + toastfeedback.
- [ ] Collapse toggle voor GPT-sectie persisteert in instellingen.
- [ ] Pin/unpin via UI en sneltoets binnen 50 ms feedback, persistent over reloads.

### Promptbibliotheek & chaining
- [ ] Prompt CRUD met tags, versies, favorieten en encrypted opslag.
- [ ] `//` launcher toont ≤50 ms, ondersteunt fuzzy search, behoudt focus.
- [ ] Chains tot 10 stappen met placeholders, batch-run, annuleren en foutmeldingen.
- [ ] `..` launcher start chain met ingevulde variabelen; export/import JSON schema gevalideerd.

### Media & audio
- [ ] Mediagalerij rendert 1.000 thumbnails <300 ms (virtuele scroll bewezen).
- [ ] ZIP export (100 items) voltooit ≤3 s en bevat metadata CSV.
- [ ] Audio-render queue produceert MP3 <4 s per 1.000 tekens, met ID3-tags en voice metadata.

### Privacy & sync
- [ ] IndexedDB bevat volledige chatinhoud; geen network requests met content payload.
- [ ] Optionele sync encrypt prompts met AES-GCM 256; sleutels beheerd via OS keystore/passphrase.
- [ ] DevTools verificatiescripts en QA-checklist bijgewerkt.

### Pluslaag (branching/agent/enterprise)
- [ ] Conditionele nodes, sjablonen en analytics dashboards (looptijd, success rate, tokens).
- [ ] Agents SDK levert web/file/computer use capabilities met auditeerbare logging.
- [ ] Enterprise SSO/RBAC, auditlog en Azure integraties met Key Vault + Content Safety.

## Testprompts & QA-scripts
Gebruik onderstaande scenario's als regressie-anker zodra features landen.
- **Chains** – "Samenvat→Outline→Draft" met 1.000 woorden invoer.
- **Launchers** – `//` selecteert "Bug Triage Prompt"; `..` start keten uit vorige punt.
- **Mappen/pinnen** – Maak "Release 1" → "Tests", verplaats 200 chats, pin "Kickoff", voer exacte zoekquery `title:"Q3 Roadmap" AND tag:finance`.
- **Mediagalerij** – Filter op `prompt:"brandkleur"`, exporteer 50 items als ZIP + seeds CSV.
- **Audio** – Render laatste antwoord als MP3 (voice `Female_03`) met ID3-tags.
- **Privacy** – DevTools Application→IndexedDB check + Network tab (geen content uploads).

## Documentatie & synchronisatie
- Houd roadmap en ADR's in sync met beslissingen uit deze tracker.
- Noteer afwijkingen van mockups (in `docs/design/` zodra beschikbaar) inclusief motivatie.
- QA-resultaten loggen in [`manual-regression-checklist.md`](./manual-regression-checklist.md) en verwijs vanuit logboek.

## Logboek
| Datum | Commit | Scope | Notities |
| --- | --- | --- | --- |
| 2025-02-14 | _pending_ | Documentatie | Tracker herschreven volgens pariteit→plus roadmap; statuslegenda toegevoegd; acties voor search/launcher/privacy gepland. |
| 2025-02-15 | _pending_ | Storage | Dexie v8 met `folder_items` pivot geland; folderhelpers + docs/QA-updates toegevoegd; lint/test/build uitgevoerd. |
| 2025-02-16 | _pending_ | Search | MiniSearch verrijkt met tags en mappaden; nieuwe tests + 10k benchmark (build 1.495 s, query 3.067 ms) gedraaid naast lint/test. |
| 2025-02-17 | _pending_ | UX | Zijbalk pin/hide/collapse wireframes vastgelegd; QA-aanwijzingen toegevoegd en designnotitie gepubliceerd. |
| 2025-02-18 | _pending_ | UX | Promptlauncher keyboard-first UX en fuzzy search gedrag gespecificeerd; roadmap + regressiegids gesynchroniseerd; heuristische toetsen uitgevoerd. |
| 2025-10-05 | _pending_ | Core | Chain DSL-parser + renderer prototype toegevoegd (`src/core/chains/chainDslParser.ts`), nieuwe tests gedraaid en lint/test/build uitgevoerd; QA-checklist aangevuld met placeholder/step-output scenario. |
| 2025-10-06 | _pending_ | Content | Inline launcher triggers koppelen aan composer store (`textareaPrompts.ts` + helpermodule), promptfilter auto-gevuld, tests toegevoegd en lint/test/build gedraaid; manual checklist uitgebreid met `//`/`..` scenario. |
| 2025-10-07 | _pending_ | Content | Chain-confirmatiemodal toegevoegd met parserbinding en run-plan export (`textareaPrompts.ts`, `shared/types/promptChains.ts`, `chainRunner.ts`); roadmap en regressiegids geüpdatet; lint/test/build uitgevoerd en handmatig modal-flow geverifieerd. |
| 2025-10-08 | _pending_ | Background | AES-GCM encryptie POC toegevoegd (`src/background/crypto/syncEncryption.ts`) met messaging-routes en tests (`tests/background/syncEncryptionService.spec.ts`); lint/test/build gedraaid en handmatige consoleflow beschreven in regressiegids. |
| 2025-10-09 | _pending_ | Storage | Dexie sync-snapshot encryptie gedelegeerd naar passphrase-service (`src/core/storage/service.ts`, `syncBridge.ts`), fallback/logging toegevoegd en regressiegids/roadmap bijgewerkt; `npm run lint`, `npm run test`, `npm run build` gedraaid. |
| 2025-10-10 | _pending_ | Privacy | IndexedDB audit uitgevoerd (codebase gescand op netwerkoproepen, DevTools Network/Application gecontroleerd), regressiegids aangevuld met stappen voor egress-monitoring en roadmap geactualiseerd; automatische scans (`rg`) gelogd en handmatige resultaten vastgelegd. |
| 2025-10-11 | _pending_ | Options | Passphrasebeheer UI toegevoegd (`src/options/features/privacy/EncryptionSection.tsx`), messaging-client + tests (`src/shared/messaging/syncEncryptionClient.ts`, `tests/shared/syncEncryptionClient.spec.ts`) en i18n-updates geleverd; lint/test/build gedraaid en handmatige dashboardflow gedocumenteerd in regressiegids. |
| 2025-10-13 | _pending_ | Theming | CSS-tokens voor light/dark/high-contrast uitgerold (`src/styles/global.css`, `tailwind.config.js`, `src/shared/theme/*`), settings-store uitgebreid met `theme`, themawatcher gebonden aan alle surfaces en nieuwe Vitest-dekking toegevoegd. `npm run lint`, `npm run test`, `npm run build` gedraaid; DevTools-emulatie voor kleur/contrast in regressiegids vastgelegd. |

Voeg nieuwe regels toe met `YYYY-MM-DD | commit | scope | details` en noteer welke QA (lint/test/build/manual) is uitgevoerd.
