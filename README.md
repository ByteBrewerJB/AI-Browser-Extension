# AI ChatGPT Companion Extension

A Chrome / Edge extension that captures your ChatGPT conversations, keeps live word and character counts, and provides a multilingual popup/options UI for organizing chats, custom GPTs, and prompt templates. Audio tooling and deeper productivity workflows are planned in upcoming milestones.

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

### Known dev-console warnings

While the dev server is running Chrome may log messages such as `Service worker registration failed. Status code: 3` and `Access to script at 'http://localhost:5173/@vite/client' has been blocked by CORS policy`. These come from the CRXJS dev loader bootstrapping the background worker and are harmless—they disappear in production builds (`npm run build`). If you see them, just confirm the Vite dev server is still running and reload the extension after the first successful compilation.

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

## Tests
```bash
npm run test
```
Runs the Node-based unit tests for the storage layer (prompt chain workflows currently).

## Project Structure
- `docs/` – architecture overview and roadmap.
- `src/background` – service worker for context menus and messaging stubs (bookmark/audio actions).
- `src/content` – DOM integrations on chat.openai.com/chatgpt.com for conversation capture and live metrics.
- `src/core` – Dexie storage, models, and sync bridge helpers shared across surfaces.
- `src/options` – dashboard for conversations, folders, custom GPTs, and prompt template management.
- `src/popup` – quick-access UI for bookmarks, pinned chats, language/direction controls.
- `src/shared` – localization, Zustand stores, and shared hooks.
- `assets/icons` – placeholder extension icons.

## Testing Ideas
- Extend `npm run lint` with ESLint once business logic solidifies.
- Add unit tests for storage/search services when implemented (e.g., Vitest + React Testing Library).
- Manual validation checklist: popup language toggle, RTL switch, content-script counter, background context menu messaging.

## Next Steps
See `docs/architecture-roadmap.md` for the feature roadmap (audio downloads, bulk actions, sync tiers, etc.). Milestone status is tracked in `docs/feature-plan.md`.

