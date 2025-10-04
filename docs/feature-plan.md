# Feature Delivery Plan

This plan refines the high-level roadmap into concrete, traceable work items derived from the requested feature set. Each item should move from **TODO -> IN PROGRESS -> DONE**, with status tracked in issues or PRs.

Roadmap 2.0 introduces phased delivery (0–8) that mirrors the architecture roadmap. Each phase below outlines scope, deliverables, dependencies, and a feasibility signal so contributors can plan workstreams and reference reusable assets.

## Fase 0 – Baseline Extension Shell (Status: Gereed)
- **Scope**: Bewaken van het MV3-raamwerk, de popup/options shells en de ontwikkeltooling die snelle iteratie mogelijk maken.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | MV3 manifest + Vite/CRX buildketen | Gereed | Dagelijkse build & reload workflows stabiel. |
  | Globale Tailwind tokens en layout shells | Gereed | Popup/options delen navigatie en statebeheer. |
  | Basis content-script teller | Gereed | Word/char teller blijft als regressie-indicator. |
- **Afhankelijkheden**: Chrome MV3 API’s, Vite toolchain, lint/build pipelines.
- **Haalbaarheidsinschatting**: Laag risico; onderhoudswerk past in reguliere releasecadans.

## Fase 1 – Conversation Capture Backbone (Status: Gereed)
- **Scope**: Gestructureerde conversaties opslaan met offline-first garanties en gespiegelde metadata-sync.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Dexie-database + migraties | Gereed | Hergebruiken als basis voor alle opslag. |
  | SyncBridge naar `chrome.storage.sync` | Gereed | Zie `src/core/storage/syncBridge.ts`; monitor quota. |
  | DOM-ingestiedienst | Gereed | Retry/backoff aanwezig; regressies gedekt door handmatig script. |
  | Captureregressie-checklist | Gereed | Zie `docs/testing/manual-regression.md`. |
- **Afhankelijkheden**: Chrome storage quota, DOM-selectors op chat.openai.com/chatgpt.com, Dexie-runtime.
- **Haalbaarheidsinschatting**: Laag risico; belangrijkste risico is upstream DOM-wijziging.

## Fase 2 – Prompt & Kennis Tooling (Status: Hergebruiken)
- **Scope**: Promptketens, GPT-mappen en kennisartefacten aanbieden als herbruikbare modules.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Prompt chain composer | Hergebruiken | UI gereed; uitbreidbaar met drag & drop (fase 3). |
  | GPT-map- en templatebeheer | Hergebruiken | CRUD-stromen productieklaar. |
  | Toolbar- en tabelprimitieven | Hergebruiken | Delen selectie-, filter- en statecomponenten. |
  | Validatiebibliotheek gedeeld met storage | Hergebruiken | Houdt schema’s synchroon met Dexie. |
- **Afhankelijkheden**: Fase 1 storagecontracten, i18n/RTL dekking, Zustand stores.
- **Haalbaarheidsinschatting**: Laag risico; uitbreidingen kunnen incrementeel.

## Fase 3 – Productivity Automation (Status: Actief)
- **Scope**: Bulkacties, globale zoekopdrachten, exportstromen en inline werkbalken versnellen dagelijkse workflows.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Command queue + undo-metadata in background | In uitvoering | Geplande ADR `docs/decisions/20240201-command-queue.md` definieert patronen. |
  | MiniSearch-gedreven globale zoekindex | Gepland | Bouwt voort op Dexie change streams; geplande ADR `docs/decisions/20240210-search-indexer.md`. |
  | Bulkactie-UX (conversaties/prompts/GPT’s) | In uitvoering | Gebruikt toolbarprimitieven uit fase 2. |
  | TXT/JSON exportservice | Gepland | Background worker voert grote batches uit. |
  | Inline quick settings tray | Gepland | Deelt Zustand stores met dashboard. |
- **Afhankelijkheden**: Fase 1–2 opslaglagen, background messaging, virtualisatielaag voor tabellen.
- **Haalbaarheidsinschatting**: Middel risico door afhankelijkheden tussen worker, opslag en UI-performance.

## Fase 4 – Audio Suite (Status: Gepland)
- **Scope**: Audio-antwoorden detecteren, downloaden en afspelen met aanpasbare voice-profielen.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Audio-detectieservice | Gepland | Volgt markup op ChatGPT; koppelen aan capture flags. |
  | Downloadorkestratie in background | Gepland | Geplande ADR `docs/decisions/20240218-audio-pipeline.md` beschrijft codecs. |
  | Popup playback & voice-presets | Gepland | UI hergebruikt bestaande componentlibrary. |
  | Optionele WASM-audiobewerkingspipeline | Gepland | Inschatten prestaties en bundelgrootte. |
- **Afhankelijkheden**: Chrome download API, MediaRecorder, optionele WASM toolchain.
- **Haalbaarheidsinschatting**: Middel risico; afhankelijk van permissies en audio-assets upstream.

## Fase 5 – Sync & Collaboration (Status: Gepland)
- **Scope**: Betrouwbare multi-device ervaring met diffinzicht, versleutelde backups en gedeelde voorkeuren.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Diff/merge-helpers + conflictdialoog | Gepland | Referentie: geplande ADR `docs/decisions/20240305-sync-strategy.md`. |
  | Cloud-backupproviders (WebDAV, Drive, disk) | Gepland | Versleutelingslagen delen modules met fase 8. |
  | Sync-instellingen + sleutelbeheer UI | Gepland | Vereist duidelijke onboarding en herstelpaden. |
  | Samenwerkingsmetadata (gedeelde labels) | Gepland | Gebruikt background command queue uit fase 3. |
- **Afhankelijkheden**: Uitgebreide telemetry (fase 8), storage bridge, encryptiebibliotheken.
- **Haalbaarheidsinschatting**: Middel/hoog risico door quota, encryptie UX en provider-API’s.

## Fase 6 – Intelligence & Assistive Features (Status: Gepland)
- **Scope**: Proactieve aanbevelingen en workflow-automatiseringen bouwen op basis van opgeslagen data.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Suggestie-engine voor vervolgstappen | Gepland | Gebruikt zoekindex en conversation analytics. |
  | Workflow-automatiseringen (reminders, chaining) | Gepland | Vereist command queue-uitbreiding. |
  | Samenvattings- en analyseworkers | Gepland | Onder beheer van privacyrichtlijnen uit geplande ADR `docs/decisions/20240320-intelligence-guardrails.md`. |
  | Notificatie- & insights-oppervlakken | Gepland | Popup/options + toekomstige side panel surface. |
- **Afhankelijkheden**: Telemetry, storage analytics, model-API’s, privacyreviews.
- **Haalbaarheidsinschatting**: Hoog risico; afhankelijk van externe AI-diensten en databescherming.

## Fase 7 – Platform Extensibility (Status: Gepland)
- **Scope**: Uitbreidbaarheid naar side panel en partnerintegraties borgen.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Chrome side panel workspace | Gepland | Performantie-audits noodzakelijk (zie architecture-roadmap). |
  | Extensie-API’s voor partners | Gepland | Vereist permissiemodel + documentatie. |
  | Integratiekaders (webhooks/exports) | Gepland | Hergebruikt exportservice en command queue. |
  | Partner-onboardinghandleiding | Gepland | Documenteert contracten en QA.
- **Afhankelijkheden**: Productivity automation, telemetry dashboards, security checklist.
- **Haalbaarheidsinschatting**: Middel risico; nieuwe oppervlaktes vragen extra QA en governance.

## Fase 8 – Quality, Telemetry & Growth (Status: Gepland)
- **Scope**: Structurele kwaliteits- en groeikanalen realiseren.
- **Deliverables**:
  | Deliverable | Status | Opmerkingen |
  | --- | --- | --- |
  | Observabilitystack (metrics + logging) | Gepland | Zie geplande ADR `docs/decisions/20240130-observability.md`. |
  | Releasekwaliteit-scorecard | Gepland | Combineert testdekking, bugintake en MTTR-metrics. |
  | Lokalisatie-uitbreiding & toegankelijkheidsaudit | Gepland | Kwartaalrapportage met WCAG-score. |
  | Dataretentie & governancebeleid | Gepland | Samenhang met privacy-ADR’s en sync beleid. |
- **Afhankelijkheden**: Bestaande lint/build pipelines, telemetry hooks uit fase 3+, product analytics tooling.
- **Haalbaarheidsinschatting**: Middel risico; vereist doorlopende inzet en teamcapaciteit.

## Cross-Cutting Initiatieven & Meetpunten
- **Testautomatisering**: Vergroot dekking met Vitest, Playwright en rooktests voor content/background messaging. Meetpunten: percentage geslaagde CI-runs, gemiddelde doorlooptijd naar fix bij falende run.
- **Telemetry & observability**: Meet capture-latency, sync-queue diepte, zoek-responstijd. Koppel dashboards aan Roadmap 2.0 fase- en releasebesluitvorming.
- **Toegankelijkheid & lokalisatie**: Kwartaalreviews met WCAG-checklist en EN/NL vertaaldichtheid; rapporteer score in release notes.
- **Security & privacy**: Voor nieuwe dataflows verplicht ADR-referentie (sync, audio, intelligence) en threat-model checklist vóór implementatie.
- **Documentatie-hygiëne**: Featureplan en architecture-roadmap gelijktijdig bijwerken; markeer updates in changelog en verwijs naar relevante ADR’s zodat contributors actuele context behouden.
