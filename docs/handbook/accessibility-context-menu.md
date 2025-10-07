# Content contextmenu accessibility playbook

_Last reviewed: 2024-10-20_

This playbook documents how the custom context menu that ships with the content sidebar behaves and which accessibility guarantees it currently makes. Keep it handy when wiring new quick actions or refactoring the sidebar so the captured behaviour stays intact.

## Implementation snapshot
- The listener lives inside `CompanionSidebarRoot` (`src/content/ui-root.tsx`). When the sidebar is hydrated **and** `showSidebar` is enabled we attach `document.addEventListener('contextmenu', handleContextMenu, true)` so the extension can intercept right-click or `Shift+F10` on ChatGPT messages.
- The handler only reacts to elements that expose `data-message-author-role`. It reads the surrounding conversation id/title, captures a 160-character preview, and stores the selection in `ContextMenuState` with the pointer location capped to keep the overlay inside the viewport.
- Rendering happens through `ContextMenuOverlay`. It draws a focusable card inside the extension shadow-root with semantic buttons for each quick action (bookmark, save prompt, copy, pin/unpin, open dashboard). Labels are sourced from the translation bundle so both EN/NL stay in sync.
- Toast feedback for each action is handled by `ActionToastView`, ensuring assistive tech users receive a visual acknowledgement even when the underlying action (e.g., copy) is silent.
- Clean-up hooks clear the overlay on Escape, scroll, additional contextmenu events, or when the sidebar hides (domain switch, manual toggle). This prevents orphaned overlays from lingering on the page.

## Keyboard & pointer interactions
| Flow | Expected behaviour | Notes |
| --- | --- | --- |
| Open menu | Right-click or `Shift+F10` on a message attaches state and renders the overlay near the pointer. | We cap `clientX/clientY` to 272×216px away from the viewport edges so buttons never overflow the window. |
| Close menu | `Escape`, scrolling, clicking outside, or invoking the browser context menu again calls `closeContextMenu()`. | The handler also resets `contextMenuPending` so disabled states clear automatically. |
| Navigate items | Buttons are part of a regular DOM flow; users can Tab through actions, and the overlay stops propagation so keyboard users stay inside the menu. | We do not currently trap focus. Screen readers jump to the first actionable button automatically because it gains focus on render. |
| Execute action | Button click triggers the corresponding handler and sets `contextMenuPending` while async work finishes. On success we show a toast and close the menu. | Bookmark opens the inline modal, prompt/copy/pin perform async work, and “Open dashboard” launches the options page. |

## Accessibility affordances
- **Role & context copy** – The header surfaces the message role (`formatBookmarkRole`) plus the captured preview so non-visual users know what they are acting on.
- **Disabled explanations** – When a message lacks selectable text the “Save as prompt” and “Copy message text” buttons show a localized disabled helper (`contextMenuNoText`).
- **Announcements** – Toasts reuse `showToast` which keeps each message on screen for three seconds. Use success/error tones (`contextMenuPromptSaved`, `contextMenuError`, etc.) so colour-blind users can still distinguish outcomes.

## Known limitations & follow-ups
- We rely on the browser focus order rather than an explicit roving tabindex. If we ever add separators or non-button elements we should upgrade the overlay to a proper ARIA menu with arrow-key navigation.
- Because the overlay consumes the full viewport with a transparent layer, screen readers recognise it as a modal dialog. If we add more than five actions consider announcing the total option count to help orientation.
- The current implementation does not restore focus to the previously active element after closing. Capture `document.activeElement` in `handleContextMenu` and refocus it inside `closeContextMenu()` when we enhance focus management.

## Testing expectations
- Automated plan: `tests/e2e/context-menu.spec.ts` contains the canonical Playwright checklist. When we expand coverage, update this doc and the scenario plan together.
- Manual spot checks (record in the regression log):
  1. Trigger the menu with `Shift+F10`, Tab through each button, and confirm disabled states narrate “Message has no text to reuse.”
  2. Invoke the bookmark action and ensure the inline modal opens inside the shadow-root with the selected message preloaded.
  3. Confirm a toast appears after copy/prompt actions and that it vanishes automatically without leaving focus stuck.
  4. Hide the sidebar via the popup toggle; the overlay should close and the native browser menu should work again immediately.

Keep this file updated whenever we change the overlay structure, button order, or clean-up logic so assistive technology users get an identical experience across releases.
