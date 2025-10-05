# Repository Guidelines

## Environment & Tooling
Use Node.js >=20.19.0 with npm 9+. Run `npm install` after cloning and develop through `npm run dev`. Reload the unpacked `dist/` build after content script or manifest changes.

## Project Structure & Module Organization
Runtime code lives in `src/`: `background/` (service worker handling downloads, alarms, messaging), `content/` (DOM hooks for both ChatGPT domains; guard selectors), `popup/` and `options/` (React UIs), `core/` (Dexie-backed storage, schedulers), and `shared/` (Zustand stores, i18n, hooks). Tailwind utilities live in `src/styles`; assets in `assets/`; builds in `dist/`. Tests mirror features in `tests/` with `runAll.ts`. Planning, ADRs, and QA scripts wonen in `docs/handbook/` (roadmap, retrofit tracker, decisions, manual regression).

## Build, Test, and Development Commands
`npm run dev` starts Vite and writes to `dist/`. `npm run build` produces the production bundle; `npm run preview` serves it for smoke checks. `npm run lint` runs the strict TypeScript pass, and `npm run test` executes the Node harness via `tests/ts-node-loader.mjs`. Run lint, test, and build before sharing work.

## Coding Style & Naming Conventions
Stick to TypeScript strict mode, 2-space indentation, and functional React components. Keep shared state in `src/shared/state` via Zustand, reuse Tailwind utility classes, and extend `global.css` sparingly. Name components with PascalCase, helpers with camelCase, tests as `*.spec.ts`, and import shared modules with the `@/` alias. Route storage changes through `core/`, and keep edits ASCII unless adding localized copy.

## Testing & QA
Add Vitest-style specs near related runtime folders and name them after their subject (e.g. `jobScheduler.spec.ts`). Run `npm run test`, recording gaps in `docs/handbook/manual-regression-checklist.md`. Perform manual checks on both chat domains, logging browser, domain, date, and steps in `docs/handbook/retrofit-tracker.md`, and note manual coverage in PRs. Execute the regression checklist for UI or storage changes before review.

## Documentation, Review & Communication
Write conventional commits (`feat:`, `fix:`, `chore:`) and avoid committing `dist/` or `node_modules/`. Pull requests should describe scope, link roadmap items or issues, list verification commands, and attach screenshots or logs for UI/background updates. Update README, `docs/handbook/product-roadmap.md`, `docs/handbook/adr-*.md`, and the retrofit log when behaviour shifts. Confirm localization/RTL impacts, prefix deferred work with `TODO(name):`, and surface blockers early via issues or retrofit notes.

## Review Checklist
- Lint, test, and build commands pass locally.
- The change aligns with current roadmap or milestone goals.
- Localization (EN/NL) and RTL handling remain correct.
- Tests updated or gaps plus manual steps documented.
- Docs and retrofit status refreshed, including regression notes.
