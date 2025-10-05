# Retrofit tracker

_Last reviewed: 2025-02-17_

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

Voeg nieuwe regels toe met `YYYY-MM-DD | commit | scope | details` en noteer welke QA (lint/test/build/manual) is uitgevoerd.
