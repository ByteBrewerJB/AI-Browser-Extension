# AI ChatGPT Companion Extension

A Chrome / Edge extension that enhances ChatGPT with audio tooling, advanced conversation management, multilingual UX, and productivity workflows. The current milestone ships a Dexie-powered storage layer with Chrome Sync mirroring, live conversation capture from the ChatGPT UI, popup quick actions, and an options dashboard with filtering and folder organization.

## Prerequisites
- Node.js 18 or newer
- npm 9+

## Setup
```bash
npm install
```

## Development
Start Vite in watch mode and load the unpacked extension in your browser (targets https://chat.openai.com and https://chatgpt.com):
```bash
npm run dev
```
1. In Chrome/Edge open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `dist` once Vite finishes the first build.
4. Keep the dev server running for hot-reload of popup/options. Re-load the extension page after manifest changes.

## Build
Produce a production build in `dist/`:
```bash
npm run build
```
You can zip the folder manually or via automation later for store submission.

## Lint & Type Check
```bash
npm run lint
```
This runs TypeScript in `--noEmit` mode. Add ESLint/Prettier if you need additional linting rules.

## Project Structure
- `docs/` – architecture overview and roadmap.
- `src/core` – data models plus IndexedDB storage helpers and the storage.sync bridge.
- `src/background` – service worker for context menus and messaging.
- `src/content` – DOM integrations on chat.openai.com capturing conversations + live metrics.
- `src/options` – dashboard for managing conversations, prompts, GPTs, audio, and sync settings (includes filters and folder tree).
- `src/popup` – quick-access UI for bookmarks, pinned chats, and controls.
- `src/shared` – localization, Zustand stores, and shared types.
- `assets/icons` – placeholder extension icons.

## Testing Ideas
- Extend `npm run lint` with ESLint once business logic solidifies.
- Add unit tests for storage/search services when implemented (e.g., Vitest + React Testing Library).
- Manual validation checklist: popup language toggle, RTL switch, content-script counter, background context menu messaging.

## Next Steps
See `docs/architecture-roadmap.md` for the feature roadmap (audio downloads, bulk actions, sync tiers, etc.).

