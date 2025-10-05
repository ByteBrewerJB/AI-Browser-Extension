# Agent Handbook

Guidelines for agents contributing to the AI ChatGPT Companion extension.

## 1. Environment & Tooling
- Node.js >=20.19.0, npm 9+.
- Install deps via `npm install` after cloning.
- Use Vite dev server (`npm run dev`) for popup/options hot reload; content script requires extension reload.

## 2. Coding Standards
- TypeScript strict mode enabled: fix all `tsc --noEmit` errors (`npm run lint`).
- Prefer functional React components with hooks.
- Keep styling in Tailwind classes; add utility classes in `global.css` only when necessary.
- Use Zustand stores for shared state; avoid prop drilling across surfaces.
- When working in content scripts, guard DOM queries and consider mutations on both chat domains.
- Maintain ASCII unless extending existing localized copy.

## 3. Features & Architecture
- Consult `docs/roadmap.md` for active milestones and premium planning; update statuses as you complete work.
- Storage interactions go through a central service (add in `src/shared` or a dedicated `core/` namespace).
- Background service worker handles downloads, alarms, cross-surface messaging.
- Keep localization keys in `src/shared/i18n/locales/{lang}/common.json`; update both EN and NL.
- Whenever functionality changes, update `retrofit.md`—at minimum refresh the status tables and logbook, and capture QA notes—to keep traceability intact.

## 4. Testing & QA
- Minimum: run `npm run lint`, `npm run test`, and `npm run build` before submitting changes.
- Add unit tests (Vitest) as new services are introduced; document gaps when skipping tests.
- For DOM integrations, test against both `https://chat.openai.com` and `https://chatgpt.com`.
- Document manual test steps in PR descriptions when automated coverage is missing.

## 5. Documentation & Commits
- Update README or relevant docs whenever UX or setup changes.
- Record major architectural decisions in `docs/decisions/` using the provided template.
- Follow conventional commits (e.g., `feat: add conversation storage service`); group related changes logically.
- Ensure `.gitignore` excludes generated artifacts; do not commit `dist/` or `node_modules/`.

## 6. Review Checklist
Before requesting review:
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` succeeds.
- [ ] Feature aligns with milestone goals.
- [ ] Localization + RTL considerations addressed.
- [ ] Tests updated or rationale provided.
- [ ] Docs / plan updated.

## 7. Communication
- Leave TODO comments prefixed with `TODO(agent-name):` if work must continue later.
- Surface blockers early via issue updates referencing the relevant milestone section.

Happy building!



