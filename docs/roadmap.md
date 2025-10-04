# AI Browser Extension — Architecture & Delivery Roadmap

_Last updated: 2024-07-08_

This living document combines the architectural snapshot, delivery status, and premium launch planning for the AI Browser Extension. Update it whenever shipped functionality or priorities change so contributors have a single source of truth.

## Current implementation snapshot

### Surfaces
- **Content script** – Captures conversations from ChatGPT, keeps a live draft counter, and persists structured messages via Dexie when DOM mutations are observed.【F:src/content/index.ts†L1-L129】
- **Popup** – Shows the five most recent conversations with pin/bookmark toggles, language/RTL controls, and quick links to open chats in new tabs. Placeholder cards reserve space for future bookmarks, pinned, and activity dashboards.【F:src/popup/Popup.tsx†L1-L143】【F:src/popup/Popup.tsx†L145-L199】
- **Options / dashboard** – Composes history, prompts, and media management sections while wiring scheduled exports and direction-aware layout.【F:src/options/Options.tsx†L1-L122】【F:src/options/features/history/HistorySection.tsx†L1-L110】
- **Background service worker** – Hosts authentication state, the in-browser job queue, and messaging routes consumed by popup/options surfaces.【F:src/background/auth.ts†L1-L107】【F:src/background/jobs/queue.ts†L1-L96】

### State & shared services
- **Dexie data model** – IndexedDB contains conversations, messages, prompts, GPTs, folders, bookmarks, settings, jobs, and metadata entries for persisted search snapshots; encryption helpers remain unused for now.【F:src/core/storage/db.ts†L1-L115】
- **Search** – A MiniSearch index persists to IndexedDB and is restored on startup through the shared metadata table. Conversation and message documents stay in sync when records are removed from storage.【F:src/core/services/searchService.ts†L13-L120】
- **Export** – TXT/JSON export helpers gather conversations, messages, and bookmarks entirely on the client. Background jobs trigger the exports, but the worker currently just logs payloads.【F:src/core/services/exportService.ts†L1-L43】【F:src/background/jobs/queue.ts†L1-L96】
- **Authentication** – Tokens are decoded locally to derive premium state; JWKS key fetching is supported but signatures are not validated yet. No audit trail or entitlement storage exists.【F:src/background/auth.ts†L1-L107】

## Delivery phases

| Phase | Theme | Status | Notes |
| --- | --- | --- | --- |
| 0 | MV3 foundation | ✅ Delivered | Manifest, Vite/CRX build, shared Tailwind tokens, lint/build automation are live. |
| 1 | Conversation capture | ✅ Delivered | DOM scanner, Dexie schema, and sync stubs store conversations plus live counters. |
| 2 | Workspace management | ✅ Delivered | Popup cards, dashboard filters, folders, prompt/GPT CRUD, and i18n/RTL wiring are available. |
| 3 | Productivity automation | 🚧 In progress | Job queue, export helpers, and MiniSearch exist but need scheduling UI polish, durable search storage, and automated background handlers. |
| 4 | Audio tooling | 💤 Planned | No audio capture/playback pipeline is present; all references remain TODO. |
| 5 | Sync & collaboration | 💤 Planned | Encryption metadata, cross-device merge logic, and shared workspaces are not implemented. |
| 6 | Intelligence & insights | 💤 Planned | No automation/suggestion workers beyond the existing data capture. |
| 7 | Platform extensibility | 💤 Planned | Side panel integrations and partner APIs are not scoped in code yet. |
| 8 | Quality & growth | 💤 Planned | Telemetry, observability, and localization scorecards remain future work. |

### Near-term backlog (Phase 3 focus)
- Move MiniSearch indexing into a worker or incremental task so large datasets do not block the UI on rebuild.
- ✅ Promote the TXT/JSON export flow beyond manual scheduling by integrating the background handler and download APIs; downloads now trigger automatically from scheduled jobs with export status surfaced in the dashboard.
- ✅ Flesh out job retry/backoff handling and surface status in the dashboard with exponential backoff and a jobs overview widget in the options surface.
- Align feature toggles and placeholder cards with actual data (bookmarks/pinned/activity).

### Future themes (Phases 4–8)
Document outstanding design/ADR links before development starts. Create new ADRs only when implementation work is committed so contributors can trace scope without guessing.

## Premium addendum

The extension currently operates entirely client-side. Premium readiness requires explicit backend work:

- **Identity & entitlement** – Stand up APIs that issue and validate JWTs, enforce JWKS signature verification, and persist entitlements or subscription tiers server-side. The current `AuthManager` only decodes payloads to infer premium status and cannot detect forged tokens.【F:src/background/auth.ts†L39-L107】
- **Billing** – Integrate with the chosen payment provider, handle webhooks, and expose retries/refunds workflows.
- **Telemetry & compliance** – Add privacy reviews, audit logging, and secure storage for premium actions before rolling out gated features.

Document progress in this section instead of maintaining a separate premium roadmap. When backend services ship, link to their repos or ADRs here.

## Maintenance checklist
- Update this file after every release train or scope change.
- Mirror any structural database or surface changes here and in the ADRs under `docs/decisions/`.
- Remove placeholder copy from UI surfaces as features graduate to production, and ensure the regression guide is updated accordingly.
