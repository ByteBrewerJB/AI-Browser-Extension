# AI Browser Extension Architecture & Roadmap

## Overview
This Chrome/Edge extension augments ChatGPT with richer conversation management, audio tooling, and workflow automation. It ships as a Manifest V3 project compiled with TypeScript and React, bundled by Vite, and persists data with the browser `storage` APIs plus optional cloud sync later.

## Target Surfaces
- **Content script** injected into chat.openai.com to add UI affordances and capture data streams.
- **Popup** for quick actions (bookmarks, pinned prompts, active chat metrics).
- **Options / dashboard page** for full management: chat archive, GPTs, prompt chains, bulk actions, exports.
- **Background service worker** to centralize storage sync, schedule backups, and broker audio downloads.
- **Side panel (optional)** leveraging the Chrome side panel API for persistent workspace tools.

## Tech Stack
- TypeScript + React 18 UI components.
- Tailwind CSS for rapid styling with RTL/LTR utilities.
- Vite + `@crxjs/vite-plugin` to emit MV3 artifacts.
- Zustand for lightweight app state shared between surfaces.
- IndexedDB (via Dexie) for structured, offline-first data. Mirror critical metadata into `chrome.storage.sync` for multi-device sync.
- Web Speech API / `chrome.tts` for advanced voice playback; `MediaRecorder` for capture when available.
- WebAssembly-enabled audio processor (phase 2) to support advanced voice mode features such as pitch shifting.

## High-Level Modules
- **core/storage**: abstraction over IndexedDB + storage.sync mirroring + conflict resolution.
- **core/models**: schemas for conversations, messages, prompts, GPT configs, bookmarks.
- **core/services**: audio pipeline, export service (TXT/JSON), search index builder, sync orchestrator.
- **ui/components**: shared React building blocks with RTL/LTR awareness and multilingual copy support via i18next.
- **features/** grouped by domain (conversations, prompts, GPTs, audio, search).
- **background/** service worker entry orchestrating alarms, context menus, download handling.
- **content/** script enhancements interacting with ChatGPT DOM.

## Data & Sync Strategy
- Primary store: IndexedDB tables (`conversations`, `messages`, `gpts`, `prompts`, `folders`, `settings`).
- Change tracking: per-record `updatedAt` timestamps + event log for reconciliation.
- Sync tiers:
  1. Browser-level sync using `chrome.storage.sync` for metadata (names, ids, timestamps) to enable multi-device awareness.
  2. Optional encrypted backup to user-selected provider (future enhancement) to fully share message bodies.
- Search: build incremental index using MiniSearch stored in IndexedDB, refreshed per change batch.

## Accessibility & Localization
- All UI surfaces respect keyboard navigation, high-contrast mode, and screen-reader labels.
- `i18next` with JSON locale bundles, defaulting to English and supporting dynamic language switching.
- Text direction toggled globally; layout components read from `dir` state.

## Current Status
- ✅ **Milestone 0 (Baseline shell) is complete.** The MV3 scaffold, popup/options shells with RTL + i18n, background worker stubs, and the initial word/character counter shipped and have lint coverage.
- ✅ **Shared foundations are in place.** Tailwind theming, Zustand store scaffolding, route wiring, and localization utilities are functional across popup, options, and content script surfaces.
- ✅ **Developer experience is stable.** Vite dev flow, CRXJS bundling, and lint/test scripts run reliably for day-to-day iteration.
- ✅ **Prompt chain builder shipped.** Options dashboard now provides a prompt chain composer with accessible ordering controls backed by the new storage API and Node-based unit tests.
- 🚧 **Milestone 1 capture work is underway.** Dexie storage, conversation/bookmark metadata sync, DOM ingestion, popup stats, and the options folder tree/table are live; filtering and advanced management are the remaining gaps.

The next stages focus on layering robust storage, capture, and productivity systems atop this baseline.

## Feature Delivery Roadmap
1. **MVP**: baseline extension shell (popup, options, background), conversation capture, bookmarks, exports, word/character counter, basic multilingual UI.
2. **Productivity**: GPT folders, prompt creation & chains, pinned chats, advanced search, bulk actions.
3. **Audio Suite**: audio download integration with ChatGPT responses, voice options UI, advanced voice mode pipeline.
4. **Sync & Collaboration**: enhanced multi-device sync, per-browser profile settings, optional cloud backup connectors.
5. **Polish**: side panel experience, performance profiling, telemetry opt-in, expanded localization.

## Immediate Next Steps (Milestone 1 Focus)
1. **Finalize the storage backbone**
   - Define Dexie tables and TypeScript models for conversations, messages, prompts, GPTs, folders, and settings.
   - Build a storage service in `src/core/storage` that exposes CRUD helpers, change streams, and conflict resolution against `chrome.storage.sync` mirrors.
2. **Capture conversations from the DOM**
   - Ship a resilient observer in the content script that normalizes user/assistant turns, captures metadata (timestamps, tokens, GPT variant), and debounces writes into storage.
   - Update the word/character counter to read from stored data so metrics stay consistent across reloads.
3. **Surface stored data in the UI**
   - Hydrate the popup with recent conversations from Zustand selectors, including bookmark toggles that persist back into storage.
   - Scaffold the options dashboard with a virtualized table view and folder tree, relying on the new storage service.
4. **Harden tooling & QA**
   - Add Vitest suites for storage helpers and DOM parsing utilities.
   - Document manual regression steps that cover both chat.openai.com and chatgpt.com.

## Near-Term Architecture Phases

### Phase 1 — Conversation Capture Backbone (Milestone 1)
- **Schema & migrations**: introduce Dexie versioning with upgrade handlers to evolve tables safely.
- **Sync bridge**: implement a background-driven queue that batches diffs into `chrome.storage.sync`, with throttling and collision detection.
- **Content ingestion**: encapsulate DOM scraping and mutation observers behind a service with retry/backoff and feature flags for quick disable.
- **State wiring**: centralize derived selectors (recent conversations, stats) in Zustand, memoizing heavy computations.
- **Testing**: run lint + new unit suites in CI, add a manual capture smoke test checklist to docs.

### Phase 2 — Productivity Suite Foundations (Milestone 2)
- **Domain modules**: create dedicated modules for GPT management and prompt chains, sharing validators with the storage layer.
- **Search infrastructure**: spin up a MiniSearch-powered indexer worker that listens to storage events and emits debounced updates to UI surfaces.
- **Bulk action engine**: design a command pattern (queue with undo metadata) executed by the background worker to keep UIs responsive.
- **Export service**: add a background-led exporter that formats TXT/JSON payloads, shared between popup quick actions and dashboard bulk workflows.
- **Telemetry hooks**: start instrumenting optional analytics (locally stubbed until Milestone 5) to understand feature adoption.

### Phase 3 — Audio & Sync Enhancements (Milestones 3-4)
- **Audio pipeline**: abstract response audio detection, downloads, and playback controllers, ensuring background/content messaging is typed and resilient to permission errors.
- **Voice mode UI**: integrate media controls into popup/options with accessibility-first keyboard interactions and persisted user presets.
- **Advanced sync**: extend the storage bridge with diff/merge helpers, conflict UI prompts, and encrypted backup adapters with pluggable providers.
- **Resilience tooling**: add monitoring hooks, retry policies, and storage vacuum jobs executed by alarms in the background worker.

### Phase 4 — Polish & Side Panel (Milestone 5)
- **Side panel workspace**: share layout primitives with popup/options while optimizing for resize and lazy loading of large histories.
- **Performance tuning**: profile heavy surfaces, add virtualization, and cache computed aggregates.
- **Accessibility & localization expansion**: audit ARIA roles, contrast, focus order, and extend locale bundles beyond EN/NL with contributor guidelines.
- **Diagnostics**: surface an options page diagnostics tab with log streaming, version info, and exportable support bundles.

## Risks & Mitigations
- **Storage contention**: Chrome `storage.sync` quota limitations could throttle sync. Mitigate by batching updates, compressing payloads, and allowing users to opt into reduced-sync mode.
- **DOM churn on ChatGPT**: upstream markup changes may break content capture. Maintain selector guards, feature flags, and a detection health monitor with telemetry hooks.
- **Performance regressions**: large histories and MiniSearch indexing can degrade UX. Adopt virtualization, worker-based indexing, and incremental sync strategies early.
- **Privacy considerations**: backups and voice features handle sensitive data. Enforce opt-in flows, encryption at rest for backups, and clear documentation of what is stored.

## Documentation & Communication Plan
- Update this roadmap at the close of each milestone with accomplishments, blockers, and adjustments.
- Mirror implementation details into `docs/feature-plan.md` and create decision records for non-trivial architectural choices.
- Publish contributor onboarding notes covering storage schema, messaging contracts, and testing expectations.
