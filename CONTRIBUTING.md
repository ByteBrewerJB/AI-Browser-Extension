# Contributing Guide

Thanks for helping improve the AI ChatGPT Companion extension! This guide explains how to set up your environment, collaborate on changes, and prepare your work for review.

## Project Setup
- Install Node.js >=20.19.0 and npm 9+.
- Run `npm install` to install dependencies.
- Use the Vite dev server for rapid iteration: `npm run dev`.
- Reload the browser extension when testing content scripts to ensure the latest bundle is loaded.

## Development Workflow
1. Create a feature branch named after the issue or enhancement you are addressing.
2. Follow conventional commits (e.g., `feat: add conversation storage service`). Group related changes in a single commit when possible.
3. Keep React components functional and prefer hooks. Share state through Zustand stores instead of prop drilling.
4. Update localization files for both English and Dutch when adding new copy.
5. Run the required checks locally before pushing:
   - `npm run lint`
   - `npm run build`
   - Add or update Vitest specs when introducing new services or logic.
6. Document notable architectural decisions in `docs/decisions/` using the provided template when applicable.

## Review Expectations
Before requesting a review, confirm that:
- [ ] Linting (`npm run lint`) passes.
- [ ] The production build (`npm run build`) succeeds.
- [ ] Tests are added or updated as needed, and manual steps are documented when automated coverage is missing.
- [ ] Documentation such as the README, feature plans, or decision records are updated to reflect your changes.
- [ ] Localization, RTL considerations, and cross-domain compatibility (chat.openai.com and chatgpt.com) are addressed.

Add TODO comments using the format `TODO(agent-name): description` if follow-up work is required. Surface blockers early by updating the relevant issue or milestone section.
