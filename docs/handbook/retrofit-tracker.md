# Retrofit tracker

_Last reviewed: 2025-02-14_

Dit dossier koppelt de bestaande extensie aan de nieuwe **privacy-first, local-first** roadmap. Gebruik het om pariteit met ChatGPT Toolbox te meten, plus-features te plannen en QA/retrofit-besluiten te loggen. Synchroniseer wijzigingen steeds met [`docs/handbook/product-roadmap.md`](./product-roadmap.md), de regressiegids en relevante ADR's.

## Doel van de extensie
De extensie evolueert naar een **volledige productiviteitssuite** bovenop ChatGPT die gebruikers hun gesprekken, prompts en multimediageneraties laat beheren zonder data uit handen te geven. Uiteindelijk moeten professionals al hun AI-werkstromen binnen één zijbalk kunnen starten en afronden: gesprekken ordenen via mappen en pins, prompts en chains als templates hergebruiken, multimediaproductie (beeld/audio) exporteren en dit alles lokaal opslaan met optionele versleutelde sync. Succes betekent dat de extensie sneller en betrouwbaarder is dan de native ChatGPT-ervaring, terwijl hij privacy-audits doorstaat en enterprise-uitbreidingen (SSO, RBAC, agentische tooling) kan inschakelen wanneer teams opschalen.

## Overzicht pariteit → plus
| Featuregroep | Kernscope | Status | Laatste update |
| --- | --- | --- | --- |
| Gespreksbeheer & mappen | Onbeperkte mappen/submappen, GPT-koppeling, drag & drop, pinned folders, bulk verplaatsing | 🟥 Gap – ontwerp | 2025-02-14 – roadmap geaccepteerd |
| Professionele zijbalk | History search (<150 ms), pin/hide, bulkacties, collapse GPTs, undo flows | 🟧 Gap – analyse | 2025-02-14 – zoekindex benchmark lopend |
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
- Versleutelde sync en audio/media pipelines vereisen service-worker uitbreidingen (nog niet gepland).
- Pluslaag (branching, agent tools, enterprise) blijft op backlog totdat pariteit bereikt is.

## Kernprincipes (bevestigd)
1. **Local-first privacy** – chats in IndexedDB, alleen versleutelde promptsync optioneel.
2. **Sneller dan scrollen** – exacte filters + minisearch index, P95 <150 ms.
3. **Herbruikbaarheid** – `//` voor prompts, `..` voor chains, placeholders en variabelen.
4. **Cross-browser** – Chrome/Edge basiskanaal, Firefox-compatibiliteit in fase 2.

## Actieve iteraties & deliverables
- **Search & sidebar spike**
  - [ ] Dexie-schema uitbreiden met `folders` en `folder_items` tabellen.
  - [ ] MiniSearch indexeren op titel, tags, map-hiërarchie; meten latency bij 10k berichten.
  - [ ] UI-wireframes voor zijbalk pin/hide/collapse flows uitwerken.
- **Launcher ervaring**
  - [ ] Promptlauncher UX (keyboard-first) definiëren; fuzzy search testen.
  - [ ] Chain DSL parser (placeholders, [[step.output]]) prototypen.
  - [ ] Inline triggers `//` en `..` integreren met bestaande composer store.
- **Privacy & sync voorbereiding**
  - [ ] AES-GCM encryptieproof-of-concept in service worker met PBKDF2.
  - [ ] IndexedDB audit: bevestig geen network egress van chatinhoud.
  - [ ] Documenteer verificatiestappen voor QA (DevTools Application/Network).
- **Theming & i18n**
  - [ ] CSS variabelen voor light/dark/high-contrast invoeren.
  - [ ] RTL smoketests uitvoeren in content, popup en options.
  - [ ] Locale switcher koppelen aan instellingenstore met persistente voorkeur.

## Volgende stappen
1. [ ] Dexie-schema uitbreiden met `folders` en `folder_items` tabellen.
   - **Prioritering** – Hoog: blokkert bulkverplaatsing, pins en zoekhiërarchie. Implementatie moet vóór Minisearch-uitbreiding klaar zijn zodat index zich op stabiele sleutels kan baseren. Schat 2 dagen werk: 1 dag schema & migratie, 1 dag API-aanpassing/seeddata.
   - **Documentatie** – Breid `docs/handbook/adr-20240215-auth-and-data-model.md` uit met de nieuwe tabellen, relaties en migratiepad. Update `docs/handbook/product-roadmap.md` sectie "Search & sidebar" naar status "in uitvoering" zodra de migratie start. Voeg migratie-instructies toe aan `docs/handbook/manual-regression-checklist.md` (IndexedDB reset) na implementatie.
   - **QA-notes** – Na oplevering: run `npm run lint`, `npm run test`, `npm run build`. Handmatige check: DevTools Application → IndexedDB (`folders`, `folder_items`) aanmaken/verplaatsen/verwijderen; verify geen Network POSTs met chatcontent. Documenteer bevindingen (browser, datum, dataset) in retrofit logboek en regression checklist.
2. [ ] MiniSearch indexeren op titel, tags, map-hiërarchie; meten latency bij 10k berichten.
3. [ ] UI-wireframes voor zijbalk pin/hide/collapse flows uitwerken.

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

Voeg nieuwe regels toe met `YYYY-MM-DD | commit | scope | details` en noteer welke QA (lint/test/build/manual) is uitgevoerd.
