# Feature Delivery Plan

This plan refines the high-level roadmap into concrete, traceable work items derived from the requested feature set. Each item should move from **TODO -> IN PROGRESS -> DONE**, with status tracked in issues or PRs.

## Milestone 0 - Baseline (DONE)
- [x] MV3 project scaffolded with Vite + React + TypeScript.
- [x] Popup and options UI shells with i18n + RTL support.
- [x] Background worker + context menu stubs.
- [x] Content script injects word/character counter.

**Test checklist**
- Manual: popup loads, language toggle works, RTL switch flips layout.
- Manual: context menu entries visible on chat.openai.com and chatgpt.com.
- Manual: word/character counter appears while typing and updates live.
- Command: `npm run lint`.

## Milestone 1 - Conversation Capture Backbone
- [ ] Storage layer
  - [ ] Dexie schema covering conversations, messages, prompts, GPTs, folders, settings.
  - [ ] Sync bridge to `chrome.storage.sync` for metadata mirroring and conflict resolution strategy.
- [ ] Content collection
  - [ ] DOM observer on chat.openai.com/chatgpt.com capturing message bodies (user + assistant) with metadata.
  - [ ] Conversation normalization into storage, update counters to use stored stats.
- [ ] Popup wiring
  - [ ] Render recent conversations with word/char counts from state.
  - [ ] Bookmark pin toggle persists to storage.
- [ ] Options dashboard foundations
  - [ ] Conversations table view (filter, sort by date).
  - [x] Folder tree sidebar (folders + subfolders).

**Test checklist**
- Unit: text metric helpers, storage service (Vitest or manual Dexie smoke test).
- Manual: type/refresh on both ChatGPT domains -> conversations appear in popup/dashboard.
- Manual: bookmark toggle works and persists across reloads.
- Manual: conversation word/char totals match expected sample text.
- Command: `npm run lint`.

## Milestone 2 - Productivity Suite
- [ ] GPT & prompt management
  - [ ] GPT folder hierarchy CRUD.
  - [ ] Prompt template creation + organization.
  - [ ] Prompt chains UI (drag-and-drop ordering).
- [ ] Bulk actions
  - [ ] Multi-select conversations with bulk archive/delete/export.
  - [ ] Bulk GPT/prompt operations.
- [ ] Advanced search
  - [ ] MiniSearch index builder syncing with storage events.
  - [ ] Global search UI with filters (date, GPT, folder, language).
- [ ] Exports
  - [ ] TXT/JSON export service with settings (include metadata, include audio links).
  - [ ] Bulk export wizard in dashboard.

**Test checklist**
- Unit: storage/query helpers for GPTs, prompts, search index.
- Integration: search results respect filters (Vitest + jsdom or Playwright component test).
- Manual: bulk select + action flows behave without regressions (check undo/back confirms).
- Manual: exported TXT/JSON files open and content is correct.
- Command: `npm run lint` plus future `npm run test` when added.

## Milestone 3 - Audio Suite
- [ ] Audio capture & download
  - [ ] Detect audio replies + transcripts in ChatGPT DOM.
  - [ ] Background download handler (filename strategy, download location prompt toggle).
- [ ] Voice options
  - [ ] Voice profile management (built-in list + custom provider placeholders).
  - [ ] Playback controls in popup (speed, pitch, volume when available).
- [ ] Advanced voice mode
  - [ ] MediaRecorder integration for user recordings.
  - [ ] Optional WASM audio processor pipeline (pitch shift, denoise).
  - [ ] UI to chain prompts + voice responses.

**Test checklist**
- Manual: audio detection works on both domains, downloads trigger, saved files playable.
- Manual: voice playback controls respond and remember settings.
- Manual: advanced voice mode flow from recording to playback.
- Unit: audio pipeline helpers (mock web APIs where possible).
- Integration: background <-> content messaging around downloads.
- Command: `npm run lint` plus audio-specific tests when introduced.

## Milestone 4 - Sync & Multi-Device
- [ ] Cross-browser profile sync enhancements (diff resolution, manual merge).
- [ ] Optional cloud backup connector abstraction (export to disk, WebDAV, GDrive placeholder).
- [ ] Settings page for sync preferences, encryption key management.

**Test checklist**
- Manual: sync scenario (browser A <-> B) including conflict cases.
- Manual: backup export/import round-trip.
- Unit: diff/merge helpers.
- Integration: storage.sync listeners and offline fallback behaviour.
- Security review: key management and encryption routines.
- Command: `npm run lint` plus end-to-end sync test script.

## Milestone 5 - Polish & Side Panel
- [ ] Chrome side panel workspace with resizable views.
- [ ] Telemetry opt-in & diagnostics (error reporting, performance metrics).
- [ ] Localization expansion (prioritized languages, add translations).
- [ ] Accessibility pass (focus order, screen-reader hints, contrast checks).
- [ ] Performance tuning (lazy loading large histories, batching DOM writes).

**Test checklist**
- Manual: side panel UI flows and resize behaviour.
- Manual: assistive tech smoke test (keyboard navigation, screen reader labels).
- Manual: verify new languages and RTL support.
- Performance: Lighthouse or Chrome Performance with large history dataset.
- Command: `npm run lint` plus visual regression tests if tooling available.

## Cross-Cutting Tasks
- [ ] Automated tests
  - [ ] Unit: storage services, search, exporters.
  - [ ] Integration: content <-> background messaging (Vitest or Playwright).
  - [ ] End-to-end (Playwright extension harness).
- [ ] Documentation
  - [ ] Update README as features ship.
  - [ ] Maintain API docs for storage/search/audio modules.
  - [ ] Keep milestone status current in this plan.

## Decision Log Template
For significant architectural choices, add entries to `docs/decisions/` following `{YYYYMMDD}-concise-title.md`:
```
# Context
- Problem / motivation

# Decision
- Chosen approach

# Consequences
- Positive / negative trade-offs
```

## Definition of Done (per feature)
- [ ] Types pass `npm run lint`.
- [ ] User-facing copy localized (EN + NL) and RTL verified when relevant.
- [ ] Screenshots or Loom (optional) for UI-heavy changes.
- [ ] README / docs updated.
- [ ] Tests (or rationale for omission) noted in PR.
