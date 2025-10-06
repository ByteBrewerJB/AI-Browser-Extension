# Prompt launcher — keyboard-first UX spec

_Last updated: 2025-10-05_

## Context
The launcher currently exposes saved prompts and prompt chains inside the composer. The retrofit roadmap promotes it to the
primary entry point for reusable workflows, which means the interaction model must be extremely quick, reliable, and
accessible. This document captures the keyboard-first experience, fuzzy search behaviours, the new chain DSL tokeniser located
in `src/core/chains/chainDslParser.ts`, and instrumentation required before we wire the flows into the shared composer store.

## Goals
- Reduce time-to-insert for prompts/chains to <50 ms after invocation.
- Maintain full control via keyboard for discovery, preview, insertion, and cancellation.
- Provide clear affordances for chain execution, including status feedback and undo/escape hatches.
- Ensure localisation (EN/NL) and RTL work without breaking keyboard navigation.

## Non-goals
- Implementing the Dexie persistence layer (already covered by existing prompt/chains storage).
- Surfacing marketplace/community prompts (handled in a later plus roadmap phase).
- Shipping the chain DSL interpreter (separate spike; launcher only references the registered chains). The initial parser now
  normalises placeholders (`{{variable}}`) and step-output tokens (`[[step.output]]`), enabling the confirmation modal to
  request the right inputs while renderer logic remains stubbed.

## Personas & user stories
1. **Power user** drafting dozens of messages per hour. They expect `Ctrl+Space` (or `⌘+K` on macOS) to open a launcher, type
   a token, and hit `Enter` to insert without leaving the keyboard.
2. **Prompt curator** managing shared templates. Needs to preview metadata (tags, last updated) and confirm they are inserting
the correct version.
3. **Chain operator** running multi-step automations. They want to confirm variable placeholders before executing and cancel if a
step hangs.

## Invocation & layout
- **Trigger shortcuts**
  - `Ctrl+Space` (Windows/Linux) / `⌘+K` (macOS) opens the launcher modal, focusing the search input.
  - Typing `//` or `..` in the composer also opens the launcher inline; de triggers verwijderen zichzelf uit de composer,
    vullen het zoekveld met de getypte query en focussen respectievelijk het prompts- of chainpanel zonder de cursor te
    verliezen.
- **Structure**
  1. Header with title (`Prompt launcher`) and close button.
  2. Search input with pill showing the active scope (`Prompts`, `Chains`, `All`). Scope toggled via `Ctrl+/` cycling or
     `Alt+1/2/3` direct shortcuts.
  3. Results list (virtualised) grouped by scope; each row exposes name, tags, folder path, last run (chains only) and
     available actions.
  4. Preview pane on the right shows content, variables, and estimated run time (chains) or token estimate (prompts).
  5. Footer displays shortcut legend, number of results, and status text (e.g., `3 results · Filter: marketing`).

## Keyboard interactions
| Action | Shortcut | Notes |
| --- | --- | --- |
| Move selection | `ArrowUp` / `ArrowDown` | Wraps around list; page-size jumps with `PgUp`/`PgDn`. |
| Switch scope | `Ctrl+/` | Cycles All → Prompts → Chains. Also accessible via `Alt+1/2/3`. |
| Insert selection | `Enter` | Prompts insert text into composer; chains open variable confirmation first. |
| Open quick actions | `Shift+Enter` | Opens inline menu for `Insert`, `Preview`, `Mark favourite`, `Copy link`. |
| Preview expand/collapse | `Space` | Toggles preview pane focus; retains selection in list. |
| Start chain run | `Enter` on confirmation modal | Confirms variable values and triggers execution with progress toast. |
| Cancel run | `Esc` | Immediately stops in-progress chain execution and rolls back composer text. |
| Close launcher | `Esc` or `Ctrl+W` | Returns focus to composer. |
| Toggle favourites filter | `Ctrl+F` | Limits search to favourited prompts/chains. |
| Insert with variables skipped | `Ctrl+Enter` | Inserts prompt ignoring optional variables (power-user shortcut). |

All shortcuts must be configurable via the future preferences page; expose them via the settings store so localisation can
surface the correct hints.

## Fuzzy search behaviour
- Backed by MiniSearch configured with:
  - Fields: `title`, `tags[]`, `folderPath`, `body`, `chainSteps[].title`, `chainSteps[].outputTokens`.
  - Boost weights: title (4x), tags (2x), folderPath (1.5x), body (1x), chain metadata (1.2x).
  - Prefix search enabled for tokens ≥2 characters; fallback to trigram matching for non-Latin scripts.
- Query pipeline:
  1. Normalise input (trim, lowercase, replace diacritics).
  2. Detect explicit filters (`tag:`, `folder:`, `type:`) and pass them to the Dexie-backed search service for pre-filtering.
  3. Feed residual text into MiniSearch and return ranked results; highlight matched tokens in the UI.
- Empty state shows last-used prompts/chains ordered by recency and favourite score.

## Visual states
- **Loading** – skeleton rows for list and preview, status `Loading recent prompts…`.
- **No results** – message with CTA `Create new prompt` (opens composer to prompt editor) and tip about using filters.
- **Error** – fallback text `Search failed. Retry (Ctrl+R)` and logs error to telemetry.
- **Chain confirmation** – modal listing required variables with smart defaults (previous values, clipboard suggestions).

## Accessibility & localisation
- Modal follows ARIA `dialog` semantics with labelled header, description, and focus trap.
- Results list uses `role=listbox`/`option` for screen reader compatibility.
- Shortcut hints support translation keys and reflect platform-specific modifiers.
- RTL flips layout: preview pane moves to left, list to right, but keyboard order remains top-to-bottom.
- High-contrast mode uses Tailwind tokens `--launcher-surface`, `--launcher-accent`, ensuring 4.5:1 contrast for text.

## Instrumentation
Log the following events through the background telemetry channel:
- `launcher.opened` with source (`shortcut`, `slash`, `composer-menu`).
- `launcher.result_selected` with item id, type, rank, search latency, and query length.
- `launcher.chain_executed` with duration, step count, cancel flag.
- `launcher.closed` with dwell time and whether anything was inserted.

## QA plan
- Automated: add Vitest coverage for the search pipeline (filter parsing, ranking weights) and keyboard reducer for scope and
  selection changes.
- Manual: execute the regression checklist additions (Section 5 update) on Chrome stable and Firefox beta with English and Dutch
  locales. Validate `//` inline trigger in both ChatGPT domains and confirm focus returns to the composer after closing.
- Accessibility: run axe DevTools on the modal, tab through all interactive elements, and confirm screen readers announce the
  selection, preview, and confirmation states.

## Open questions
- Should custom user tags support colour labels in the list, or remain monochrome until theming tokens settle?
- Do we throttle telemetry events for rapid keyboard navigation to avoid flooding logs?
- Can we cache last 5 queries in IndexedDB for offline recall without leaking private prompt names?
