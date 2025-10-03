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

## Feature Delivery Roadmap
1. **MVP**: baseline extension shell (popup, options, background), conversation capture, bookmarks, exports, word/character counter, basic multilingual UI.
2. **Productivity**: GPT folders, prompt creation & chains, pinned chats, advanced search, bulk actions.
3. **Audio Suite**: audio download integration with ChatGPT responses, voice options UI, advanced voice mode pipeline.
4. **Sync & Collaboration**: enhanced multi-device sync, per-browser profile settings, optional cloud backup connectors.
5. **Polish**: side panel experience, performance profiling, telemetry opt-in, expanded localization.

## Immediate Next Steps
- Scaffold Vite + React MV3 project (`npm create vite@latest -- --template react-ts`).
- Integrate CRXJS plugin and configure manifest scaffolding with required permissions.
- Stub out storage module with Dexie + storage.sync bridge.
- Implement minimal UI for popup and options to verify routing and localization toggles.
