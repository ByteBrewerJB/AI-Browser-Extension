import { liveQuery } from 'dexie';
import type { FolderRecord, PromptChainRecord, PromptRecord } from '@/core/models';
import type { BookmarkSummary } from '@/core/storage/insights';
import { db } from '@/core/storage/db';
import { getRecentBookmarks } from '@/core/storage/insights';
import { listPromptChains } from '@/core/storage';
import { initI18n } from '@/shared/i18n';
import { DEFAULT_PROMPT_HINT, initializeSettingsStore, useSettingsStore } from '@/shared/state/settingsStore';
import { createPopover } from '@/ui/components/Popover';
import type { i18n as I18nInstance } from 'i18next';
import { sendRuntimeMessage } from '@/shared/messaging/router';
import { usePromptChainsStore } from '@/shared/state/promptChainsStore';
import { findInlineTrigger } from './inlineLauncherTriggers';

const CONTAINER_ID = 'ai-companion-prompt-launcher';
const MAX_PROMPTS = 100;
const MAX_BOOKMARKS = 40;
const MAX_CHAINS = 40;

type PanelBubbleId = 'prompts' | 'chains' | 'bookmarks' | 'pinned' | 'actions' | 'settings';
type LinkBubbleId = 'dashboard';
type BubbleId = PanelBubbleId | LinkBubbleId;

interface LauncherState {
  prompts: PromptRecord[];
  promptChains: PromptChainRecord[];
  folderNames: Map<string, string>;
  bookmarks: BookmarkSummary[];
  filter: string;
  open: boolean;
  activeBubble: PanelBubbleId | null;
}

interface BubbleConfigBase {
  id: BubbleId;
  variant: 'primary' | 'secondary';
  labelKey: string;
  labelFallback: string;
  ariaKey: string;
  ariaFallback: string;
}

interface PanelBubbleConfig extends BubbleConfigBase {
  id: PanelBubbleId;
  kind: 'panel';
  showSearch: boolean;
  panelTitleKey: string;
  panelTitleFallback: string;
  placeholderTitleKey: string;
  placeholderTitleFallback: string;
  placeholderSubtitleKey: string;
  placeholderSubtitleFallback: string;
}

interface LinkBubbleConfig extends BubbleConfigBase {
  id: LinkBubbleId;
  kind: 'link';
  action: () => void;
}

type BubbleConfig = PanelBubbleConfig | LinkBubbleConfig;

const state: LauncherState = {
  prompts: [],
  promptChains: [],
  folderNames: new Map(),
  bookmarks: [],
  filter: '',
  open: false,
  activeBubble: null
};

let container: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
const bubbleButtons = new Map<BubbleId, { button: HTMLButtonElement; label: HTMLSpanElement }>();
const panelBubbleConfigs = new Map<PanelBubbleId, PanelBubbleConfig>();
let closeButton: HTMLButtonElement | null = null;
let panel: HTMLDivElement | null = null;
let searchWrapper: HTMLDivElement | null = null;
let searchInput: HTMLInputElement | null = null;
let promptList: HTMLUListElement | null = null;
let emptyState: HTMLDivElement | null = null;
let emptyTitleEl: HTMLParagraphElement | null = null;
let emptySubtitleEl: HTMLParagraphElement | null = null;
let titleEl: HTMLHeadingElement | null = null;
let i18nInstance: I18nInstance | null = null;
let promptsSubscription: { unsubscribe(): void } | null = null;
let bookmarksSubscription: { unsubscribe(): void } | null = null;
let promptChainsSubscription: { unsubscribe(): void } | null = null;
let promptChainsRuntimeUnsubscribe: (() => void) | null = null;
let mounted = false;

const DEFAULT_TOKEN_LIMIT = 4096;
const counterNumberFormatter = new Intl.NumberFormat();

let composerCountersContainer: HTMLDivElement | null = null;
let composerWordsLabel: HTMLSpanElement | null = null;
let composerCharactersLabel: HTMLSpanElement | null = null;
let composerTokensLabel: HTMLSpanElement | null = null;
let composerWordsValue: HTMLSpanElement | null = null;
let composerCharactersValue: HTMLSpanElement | null = null;
let composerTokensValue: HTMLSpanElement | null = null;
let composerTokensBadge: HTMLDivElement | null = null;
let activeComposer: HTMLTextAreaElement | HTMLElement | null = null;
let composerInputListener: ((event: Event) => void) | null = null;
let composerObserver: MutationObserver | null = null;
let composerFocusListener: ((event: FocusEvent) => void) | null = null;
let composerEvaluationTimeout: number | null = null;
let composerCountersInitialized = false;
let unsubscribeTokenLimit: (() => void) | null = null;
let tokenLimit = DEFAULT_TOKEN_LIMIT;
let lastComposerMetrics = { words: 0, characters: 0, tokens: 0 };
let suppressInlineTriggerHandling = false;
let composerPlaceholderText: string | null = null;
let composerPlaceholderSignature: string | null = null;
let composerPlaceholderUnsubscribe: (() => void) | null = null;
let composerOriginalPlaceholder: string | null = null;
let composerOriginalDataPlaceholder: string | null = null;
let launcherPopover: HTMLDivElement | null = null;
let launcherPopoverTitle: HTMLHeadingElement | null = null;
let launcherPopoverSubtitle: HTMLParagraphElement | null = null;
let launcherPopoverList: HTMLUListElement | null = null;
let launcherPopoverDismissButton: HTMLButtonElement | null = null;
let launcherPopoverVisible = false;
const launcherPopoverItemLabels = new Map<string, HTMLParagraphElement>();

const MAX_LAUNCHER_TIP_DISPLAYS = 3;

type PromptChainsRuntimeSnapshot = ReturnType<typeof usePromptChainsStore.getState>;

const LAUNCHER_TIP_CONFIGS = [
  {
    id: 'prompts',
    key: '//',
    labelKey: 'content.promptLauncher.tips.prompts',
    labelFallback: 'Type // to browse saved prompts.'
  },
  {
    id: 'chains',
    key: '..',
    labelKey: 'content.promptLauncher.tips.chains',
    labelFallback: 'Use .. to open prompt chains quickly.'
  },
  {
    id: 'bookmarks',
    key: '@@',
    labelKey: 'content.promptLauncher.tips.bookmarks',
    labelFallback: 'Try @@ to bookmark the current message.'
  }
] as const;

function attachEvent<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void
) {
  if (typeof target.addEventListener === 'function') {
    target.addEventListener(type, handler as EventListener);
    return;
  }

  const fallbackTarget = target as unknown as Record<string, unknown>;
  fallbackTarget[`on${String(type)}`] = handler;
}

function attachClickHandler(target: HTMLElement, handler: (event: MouseEvent) => void) {
  attachEvent(target, 'click', handler);
}

const LAUNCHER_STYLES = `
:host {
  all: initial;
}
*, *::before, *::after {
  box-sizing: border-box;
}
button {
  font: inherit;
}
.launcher {
  position: fixed;
  bottom: 96px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  z-index: 2147483647;
  color: #f8fafc;
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
.bubble-dock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.bubble {
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  border-radius: 999px;
  padding: 0;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
}
.bubble span {
  padding: 0 14px;
}
.bubble:hover,
.bubble:focus-visible {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.65);
  color: #34d399;
  outline: none;
}
.bubble[data-active="true"] {
  background: rgba(16, 185, 129, 0.22);
  border-color: rgba(16, 185, 129, 0.75);
  color: #34d399;
}
.bubble-secondary {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(148, 163, 184, 0.35);
  color: #e2e8f0;
}
.bubble-secondary:hover,
.bubble-secondary:focus-visible {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.55);
  color: #f8fafc;
}
.panel {
  width: 300px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
  overflow: hidden;
  backdrop-filter: blur(14px);
}
.panel[hidden] {
  display: none;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
}
.panel-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #e2e8f0;
}
.close {
  border: 1px solid transparent;
  background: rgba(30, 41, 59, 0.65);
  color: rgba(226, 232, 240, 0.8);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.close:hover,
.close:focus-visible {
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  border-color: rgba(148, 163, 184, 0.35);
  outline: none;
}
.search-wrapper {
  padding: 0 18px 12px;
}
.search {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.85);
  padding: 8px 12px;
  font-size: 12px;
  color: #e2e8f0;
}
.search:focus-visible {
  outline: 2px solid rgba(16, 185, 129, 0.65);
  outline-offset: 2px;
}
.search::placeholder {
  color: rgba(148, 163, 184, 0.7);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.list-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
}
.list-item:first-child {
  border-top: none;
}
.list-item-text {
  flex: 1 1 auto;
  min-width: 0;
}
.list-item-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #f8fafc;
}
.list-item-description {
  margin: 0 0 4px;
  font-size: 11px;
  color: rgba(226, 232, 240, 0.82);
}
.list-item-snippet {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(148, 163, 184, 0.85);
}
.list-item-meta {
  margin: 6px 0 0;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.6);
}
.list-item-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.insert-button {
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.65);
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  white-space: nowrap;
}
.insert-button:hover,
.insert-button:focus-visible {
  background: rgba(16, 185, 129, 0.24);
  border-color: rgba(16, 185, 129, 0.9);
  outline: none;
}
.cancel-button {
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.65);
  background: rgba(248, 113, 113, 0.16);
  color: #fca5a5;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  white-space: nowrap;
}
.cancel-button:hover,
.cancel-button:focus-visible {
  background: rgba(248, 113, 113, 0.22);
  border-color: rgba(248, 113, 113, 0.85);
  outline: none;
}
.empty {
  padding: 28px 20px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #f8fafc;
}
.empty-subtitle {
  margin: 0;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.78);
  line-height: 1.5;
}
.composer-counters {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  pointer-events: none;
}
.composer-counters[hidden] {
  display: none;
}
.composer-counter-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: inherit;
}
.composer-counter-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.88);
}
.composer-counter-value {
  font-variant-numeric: tabular-nums;
}
.composer-counter-badge[data-over-limit="true"] {
  background: rgba(185, 28, 28, 0.25);
  border-color: rgba(248, 113, 113, 0.85);
  color: #fecaca;
}
.launcher-popover {
  position: absolute;
  right: calc(100% + 16px);
  bottom: 0;
  width: 260px;
  pointer-events: none;
  z-index: 2;
}
.launcher-popover[data-open="false"],
.launcher-popover[hidden] {
  display: none;
}
.launcher-popover[data-open="true"] {
  display: block;
  pointer-events: auto;
}
.launcher-popover-card {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.45);
  padding: 16px 18px 18px;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.launcher-popover-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
}
.launcher-popover-subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.85);
  line-height: 1.5;
}
.launcher-popover-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.launcher-popover-item {
  display: flex;
  gap: 10px;
  align-items: center;
}
.launcher-popover-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.4);
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #38bdf8;
  letter-spacing: 0.08em;
}
.launcher-popover-label {
  margin: 0;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.4;
}
.launcher-popover-dismiss {
  align-self: flex-end;
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.7);
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 16px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.launcher-popover-dismiss:hover,
.launcher-popover-dismiss:focus-visible {
  background: rgba(16, 185, 129, 0.28);
  border-color: rgba(16, 185, 129, 0.95);
  color: #a7f3d0;
  outline: none;
}
@media (max-width: 768px) {
  .launcher {
    bottom: 78px;
    right: 12px;
  }
  .panel {
    width: 270px;
    max-height: 320px;
  }
}
`;

const BUBBLE_CONFIGS: BubbleConfig[] = [
  {
    id: 'prompts',
    kind: 'panel',
    variant: 'primary',
    labelKey: 'content.dock.prompts',
    labelFallback: 'Prompts ({{count}})',
    ariaKey: 'content.dock.promptsAria',
    ariaFallback: 'Toggle prompts bubble ({{count}} available)',
    showSearch: true,
    panelTitleKey: 'content.promptLauncher.title',
    panelTitleFallback: 'Saved prompts',
    placeholderTitleKey: 'content.promptLauncher.emptyTitle',
    placeholderTitleFallback: 'No prompts yet',
    placeholderSubtitleKey: 'content.promptLauncher.emptySubtitle',
    placeholderSubtitleFallback: 'Save prompts in the dashboard or popup to reuse them here.'
  },
  {
    id: 'chains',
    kind: 'panel',
    variant: 'primary',
    labelKey: 'content.dock.chains',
    labelFallback: 'Chains ({{count}})',
    ariaKey: 'content.dock.chainsAria',
    ariaFallback: 'Open chains bubble ({{count}} available)',
    showSearch: false,
    panelTitleKey: 'content.bubblePanels.chains.title',
    panelTitleFallback: 'Prompt chains',
    placeholderTitleKey: 'content.bubblePanels.chains.emptyTitle',
    placeholderTitleFallback: 'No chains yet',
    placeholderSubtitleKey: 'content.bubblePanels.chains.emptySubtitle',
    placeholderSubtitleFallback:
      'Group prompts into chains in the dashboard to launch them here.'
  },
  {
    id: 'bookmarks',
    kind: 'panel',
    variant: 'primary',
    labelKey: 'content.dock.bookmarks',
    labelFallback: 'Bookmarks ({{count}})',
    ariaKey: 'content.dock.bookmarksAria',
    ariaFallback: 'Open bookmark bubble ({{count}} available)',
    showSearch: false,
    panelTitleKey: 'content.bubblePanels.bookmarks.title',
    panelTitleFallback: 'Conversation bookmarks',
    placeholderTitleKey: 'content.bubblePanels.bookmarks.emptyTitle',
    placeholderTitleFallback: 'No bookmarks yet',
    placeholderSubtitleKey: 'content.bubblePanels.bookmarks.emptySubtitle',
    placeholderSubtitleFallback:
      'Bookmark ChatGPT messages to keep quick references handy in this bubble.'
  },
  {
    id: 'pinned',
    kind: 'panel',
    variant: 'primary',
    labelKey: 'content.dock.pinned',
    labelFallback: 'Pinned',
    ariaKey: 'content.dock.pinnedAria',
    ariaFallback: 'Open pinned bubble',
    showSearch: false,
    panelTitleKey: 'content.bubblePanels.pinned.title',
    panelTitleFallback: 'Pinned conversations',
    placeholderTitleKey: 'content.bubblePanels.pinned.placeholderTitle',
    placeholderTitleFallback: 'Quick pin controls on the way',
    placeholderSubtitleKey: 'content.bubblePanels.pinned.placeholderSubtitle',
    placeholderSubtitleFallback:
      'Manage pins and favorite folders without leaving ChatGPT once this bubble unlocks.'
  },
  {
    id: 'actions',
    kind: 'panel',
    variant: 'primary',
    labelKey: 'content.dock.actions',
    labelFallback: 'Actions',
    ariaKey: 'content.dock.actionsAria',
    ariaFallback: 'Open actions bubble',
    showSearch: false,
    panelTitleKey: 'content.bubblePanels.actions.title',
    panelTitleFallback: 'Actions & shortcuts',
    placeholderTitleKey: 'content.bubblePanels.actions.placeholderTitle',
    placeholderTitleFallback: 'Contextual actions arriving shortly',
    placeholderSubtitleKey: 'content.bubblePanels.actions.placeholderSubtitle',
    placeholderSubtitleFallback:
      'This bubble will soon bundle quick operations like bookmarking, exporting, and sharing.'
  },
  {
    id: 'settings',
    kind: 'panel',
    variant: 'secondary',
    labelKey: 'content.dock.settings',
    labelFallback: 'Settings',
    ariaKey: 'content.dock.settingsAria',
    ariaFallback: 'Open settings bubble',
    showSearch: false,
    panelTitleKey: 'content.bubblePanels.settings.title',
    panelTitleFallback: 'Settings',
    placeholderTitleKey: 'content.bubblePanels.settings.placeholderTitle',
    placeholderTitleFallback: 'Adjust the Companion without leaving the chat',
    placeholderSubtitleKey: 'content.bubblePanels.settings.placeholderSubtitle',
    placeholderSubtitleFallback:
      'Dock visibility, direction, and audio toggles will land in this bubble soon.'
  },
  {
    id: 'dashboard',
    kind: 'link',
    variant: 'secondary',
    labelKey: 'content.dock.dashboard',
    labelFallback: 'Dashboard',
    ariaKey: 'content.dock.dashboardAria',
    ariaFallback: 'Open dashboard',
    action: openDashboard
  }
];

function translate(key: string, fallback: string, options?: Record<string, unknown>): string {
  if (i18nInstance) {
    return i18nInstance.t(key, { defaultValue: fallback, ...(options ?? {}) });
  }

  if (!options) {
    return fallback;
  }

  return fallback.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = options[token];
    return value === undefined ? '' : String(value);
  });
}

async function ensureI18n() {
  if (!i18nInstance) {
    try {
      i18nInstance = await initI18n();
    } catch (error) {
      console.error('[ai-companion] failed to initialize i18n for prompt launcher', error);
    }
  }
}

function ensureContainer() {
  if (container) {
    return;
  }

  container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('role', 'presentation');
    document.body.appendChild(container);
  }

  const supportsShadowDom = typeof container.attachShadow === 'function';
  if (supportsShadowDom) {
    shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: 'open' });
  } else {
    const fallbackRoot = document.createElement('div');
    fallbackRoot.setAttribute('data-ai-companion', 'shadow-fallback');
    container.textContent = '';
    container.appendChild(fallbackRoot);
    shadowRoot = fallbackRoot as unknown as ShadowRoot;
  }

  shadowRoot.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = LAUNCHER_STYLES;
  shadowRoot.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.className = 'launcher';
  shadowRoot.appendChild(wrapper);

  createLauncherPopover(wrapper);

  const dock = document.createElement('div');
  dock.className = 'bubble-dock';
  wrapper.appendChild(dock);

  bubbleButtons.clear();
  panelBubbleConfigs.clear();

  for (const config of BUBBLE_CONFIGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = config.variant === 'secondary' ? 'bubble bubble-secondary' : 'bubble';
    button.setAttribute('data-active', 'false');

    const label = document.createElement('span');
    button.appendChild(label);

    if (config.kind === 'panel') {
      panelBubbleConfigs.set(config.id, config);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      attachClickHandler(button, () => {
        if (state.activeBubble === config.id) {
          closePanel();
        } else {
          openPanel(config.id);
        }
      });
    } else {
      attachClickHandler(button, () => {
        config.action();
      });
    }

    dock.appendChild(button);
    bubbleButtons.set(config.id, { button, label });
  }

  panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'ai-companion-prompt-launcher-title');
  panel.hidden = true;
  wrapper.appendChild(panel);

  const header = document.createElement('div');
  header.className = 'panel-header';
  panel.appendChild(header);

  titleEl = document.createElement('h2');
  titleEl.id = 'ai-companion-prompt-launcher-title';
  titleEl.className = 'panel-title';
  header.appendChild(titleEl);

  closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close';
  attachClickHandler(closeButton, () => closePanel({ focusTrigger: true }));
  closeButton.textContent = '\u00D7';
  header.appendChild(closeButton);

  searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-wrapper';
  panel.appendChild(searchWrapper);

  searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'search';
  attachEvent(searchInput, 'input', () => {
    if (state.activeBubble !== 'prompts') {
      return;
    }
    state.filter = searchInput?.value ?? '';
    renderPromptList();
  });
  searchWrapper.appendChild(searchInput);

  emptyState = document.createElement('div');
  emptyState.className = 'empty';
  panel.appendChild(emptyState);

  emptyTitleEl = document.createElement('p');
  emptyTitleEl.className = 'empty-title';
  emptyState.appendChild(emptyTitleEl);

  emptySubtitleEl = document.createElement('p');
  emptySubtitleEl.className = 'empty-subtitle';
  emptyState.appendChild(emptySubtitleEl);

  promptList = document.createElement('ul');
  promptList.className = 'list';
  panel.appendChild(promptList);

  composerCountersContainer = document.createElement('div');
  composerCountersContainer.className = 'composer-counters';
  composerCountersContainer.setAttribute('data-ai-companion', 'composer-counters');
  composerCountersContainer.hidden = true;
  wrapper.appendChild(composerCountersContainer);

  const wordsBadge = document.createElement('div');
  wordsBadge.className = 'composer-counter-badge';
  composerCountersContainer.appendChild(wordsBadge);

  composerWordsLabel = document.createElement('span');
  composerWordsLabel.className = 'composer-counter-label';
  wordsBadge.appendChild(composerWordsLabel);

  composerWordsValue = document.createElement('span');
  composerWordsValue.className = 'composer-counter-value';
  composerWordsValue.textContent = '0';
  wordsBadge.appendChild(composerWordsValue);

  const charactersBadge = document.createElement('div');
  charactersBadge.className = 'composer-counter-badge';
  composerCountersContainer.appendChild(charactersBadge);

  composerCharactersLabel = document.createElement('span');
  composerCharactersLabel.className = 'composer-counter-label';
  charactersBadge.appendChild(composerCharactersLabel);

  composerCharactersValue = document.createElement('span');
  composerCharactersValue.className = 'composer-counter-value';
  composerCharactersValue.textContent = '0';
  charactersBadge.appendChild(composerCharactersValue);

  composerTokensBadge = document.createElement('div');
  composerTokensBadge.className = 'composer-counter-badge';
  composerCountersContainer.appendChild(composerTokensBadge);

  composerTokensLabel = document.createElement('span');
  composerTokensLabel.className = 'composer-counter-label';
  composerTokensBadge.appendChild(composerTokensLabel);

  composerTokensValue = document.createElement('span');
  composerTokensValue.className = 'composer-counter-value';
  composerTokensValue.textContent = '0';
  composerTokensBadge.appendChild(composerTokensValue);

  lastComposerMetrics = { words: 0, characters: 0, tokens: 0 };
  setComposerCountersValues(0, 0, 0);

  applyTranslations();
  renderActivePanel();
}

function createLauncherPopover(wrapper: HTMLDivElement) {
  launcherPopoverVisible = false;
  launcherPopoverItemLabels.clear();

  const instance = createPopover({
    shortcuts: LAUNCHER_TIP_CONFIGS.map((config) => ({ id: config.id, key: config.key })),
    onDismiss: (event) => {
      event.preventDefault();
      hideLauncherPopover({ markDismissed: true });
    },
    rootClassName: 'launcher-popover',
    cardClassName: 'launcher-popover-card',
    titleClassName: 'launcher-popover-title',
    subtitleClassName: 'launcher-popover-subtitle',
    listClassName: 'launcher-popover-list',
    itemClassName: 'launcher-popover-item',
    keyClassName: 'launcher-popover-key',
    labelClassName: 'launcher-popover-label',
    dismissButtonClassName: 'launcher-popover-dismiss'
  });

  launcherPopover = instance.root;
  launcherPopoverTitle = instance.title;
  launcherPopoverSubtitle = instance.subtitle;
  launcherPopoverList = instance.list;
  launcherPopoverDismissButton = instance.dismissButton;

  launcherPopover.setAttribute('role', 'dialog');
  launcherPopover.setAttribute('aria-live', 'polite');
  launcherPopover.setAttribute('aria-hidden', 'true');
  launcherPopover.setAttribute('data-open', 'false');
  launcherPopover.hidden = true;

  if (!launcherPopoverTitle.id) {
    launcherPopoverTitle.id = 'ai-companion-launcher-tips-title';
  }
  if (!launcherPopoverSubtitle.id) {
    launcherPopoverSubtitle.id = 'ai-companion-launcher-tips-subtitle';
  }

  launcherPopoverList.setAttribute('aria-labelledby', launcherPopoverTitle.id);
  launcherPopoverList.setAttribute('aria-describedby', launcherPopoverSubtitle.id);

  launcherPopoverItemLabels.clear();
  for (const [id, label] of instance.itemLabels.entries()) {
    launcherPopoverItemLabels.set(id, label);
  }

  wrapper.appendChild(launcherPopover);
}

function applyLauncherPopoverTranslations() {
  if (!launcherPopover) {
    return;
  }

  if (launcherPopoverTitle) {
    launcherPopoverTitle.textContent = translate('content.promptLauncher.tipsTitle', 'Composer shortcuts');
  }

  if (launcherPopoverSubtitle) {
    launcherPopoverSubtitle.textContent = translate(
      'content.promptLauncher.tipsSubtitle',
      'Use quick prefixes to speed up your workflow.'
    );
  }

  for (const config of LAUNCHER_TIP_CONFIGS) {
    const label = launcherPopoverItemLabels.get(config.id);
    if (label) {
      label.textContent = translate(config.labelKey, config.labelFallback);
    }
  }

  if (launcherPopoverDismissButton) {
    const text = translate('content.promptLauncher.tipsDismiss', 'Got it');
    launcherPopoverDismissButton.textContent = text;
    launcherPopoverDismissButton.setAttribute('aria-label', text);
  }
}

function showLauncherPopover() {
  if (!launcherPopover || launcherPopoverVisible) {
    return;
  }

  applyLauncherPopoverTranslations();

  launcherPopover.hidden = false;
  launcherPopover.setAttribute('data-open', 'true');
  launcherPopover.setAttribute('aria-hidden', 'false');
  launcherPopoverVisible = true;

  window.setTimeout(() => {
    launcherPopoverDismissButton?.focus({ preventScroll: true });
  }, 0);
}

function hideLauncherPopover(options: { markDismissed?: boolean } = {}) {
  if (!launcherPopover) {
    return;
  }

  if (!launcherPopoverVisible) {
    launcherPopover.hidden = true;
    launcherPopover.setAttribute('data-open', 'false');
    launcherPopover.setAttribute('aria-hidden', 'true');
    return;
  }

  launcherPopoverVisible = false;
  launcherPopover.hidden = true;
  launcherPopover.setAttribute('data-open', 'false');
  launcherPopover.setAttribute('aria-hidden', 'true');

  if (options.markDismissed) {
    const settings = useSettingsStore.getState();
    if (settings.dismissedLauncherTips < MAX_LAUNCHER_TIP_DISPLAYS) {
      settings.incrementDismissedLauncherTips();
    }
  }
}

function maybeShowLauncherPopover(bubbleId: PanelBubbleId) {
  if (bubbleId !== 'prompts') {
    hideLauncherPopover();
    return;
  }

  const settings = useSettingsStore.getState();
  if (!settings.hydrated) {
    return;
  }

  if (settings.dismissedLauncherTips >= MAX_LAUNCHER_TIP_DISPLAYS) {
    hideLauncherPopover();
    return;
  }

  showLauncherPopover();
}

function applyTranslations() {
  applyLauncherPopoverTranslations();

  if (!closeButton || !searchInput || !titleEl || !emptyTitleEl || !emptySubtitleEl) {
    return;
  }

  refreshBubbleLabels();
  applyCounterTranslations();

  const closeLabel = translate('content.dock.closePanelAria', 'Close bubble panel');
  closeButton.setAttribute('aria-label', closeLabel);
  closeButton.setAttribute('title', closeLabel);

  if (state.activeBubble === 'prompts') {
    searchInput.placeholder = translate('content.promptLauncher.searchPlaceholder', 'Search prompts...');
  }

  if (!state.open) {
    emptyTitleEl.textContent = translate('content.promptLauncher.emptyTitle', 'No prompts yet');
    emptySubtitleEl.textContent = translate(
      'content.promptLauncher.emptySubtitle',
      'Save prompts in the dashboard or popup to reuse them here.'
    );
    return;
  }

  renderActivePanel();
}

function sanitizeTokenLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_TOKEN_LIMIT;
  }
  return Math.round(value);
}

const COMPOSER_PLACEHOLDER_TEMPLATES: Record<string, string> = {
  en: 'Message ChatGPT normally. {{hint}}',
  nl: 'Stuur ChatGPT zoals normaal. {{hint}}',
  default: 'Message ChatGPT normally. {{hint}}'
};

function buildComposerPlaceholder(language: string, promptHint: string | null | undefined): string {
  const normalizedLanguage = typeof language === 'string' ? language.toLowerCase() : '';
  const baseLanguage = normalizedLanguage.split('-')[0] ?? '';
  const hint = typeof promptHint === 'string' && promptHint.trim().length > 0
    ? promptHint.trim()
    : DEFAULT_PROMPT_HINT;
  const template =
    COMPOSER_PLACEHOLDER_TEMPLATES[normalizedLanguage] ??
    (baseLanguage ? COMPOSER_PLACEHOLDER_TEMPLATES[baseLanguage] : undefined) ??
    COMPOSER_PLACEHOLDER_TEMPLATES.default;
  return template.replace('{{hint}}', hint);
}

function setComposerPlaceholder(element: HTMLTextAreaElement | HTMLElement, placeholder: string) {
  if (isHtmlTextAreaElement(element)) {
    if (composerOriginalPlaceholder === null) {
      composerOriginalPlaceholder = element.getAttribute('placeholder');
    }

    if (element.placeholder !== placeholder) {
      element.placeholder = placeholder;
      element.setAttribute('placeholder', placeholder);
    }
    return;
  }

  if (isHtmlContentEditable(element)) {
    if (composerOriginalDataPlaceholder === null) {
      composerOriginalDataPlaceholder = element.getAttribute('data-placeholder');
    }

    if (composerOriginalPlaceholder === null) {
      composerOriginalPlaceholder = element.getAttribute('placeholder');
    }

    if (element.getAttribute('data-placeholder') !== placeholder) {
      element.setAttribute('data-placeholder', placeholder);
    }

    if (element.getAttribute('placeholder') !== placeholder) {
      element.setAttribute('placeholder', placeholder);
    }
  }
}

function restoreComposerPlaceholder(element: HTMLTextAreaElement | HTMLElement) {
  if (isHtmlTextAreaElement(element)) {
    if (composerOriginalPlaceholder === null || composerOriginalPlaceholder.length === 0) {
      element.removeAttribute('placeholder');
    } else {
      element.placeholder = composerOriginalPlaceholder;
      element.setAttribute('placeholder', composerOriginalPlaceholder);
    }
  } else if (isHtmlContentEditable(element)) {
    if (composerOriginalDataPlaceholder === null || composerOriginalDataPlaceholder.length === 0) {
      element.removeAttribute('data-placeholder');
    } else {
      element.setAttribute('data-placeholder', composerOriginalDataPlaceholder);
    }

    const originalAttribute = composerOriginalPlaceholder;
    if (originalAttribute === null || originalAttribute.length === 0) {
      element.removeAttribute('placeholder');
    } else {
      element.setAttribute('placeholder', originalAttribute);
    }
  }

  composerOriginalPlaceholder = null;
  composerOriginalDataPlaceholder = null;
}

function updateComposerPlaceholder(
  language: string,
  promptHint: string | null | undefined,
  target?: HTMLTextAreaElement | HTMLElement | null
) {
  const placeholder = buildComposerPlaceholder(language, promptHint);
  composerPlaceholderText = placeholder;

  const candidate = target ?? activeComposer ?? getComposerElement();
  if (!candidate) {
    return;
  }

  setComposerPlaceholder(candidate, placeholder);
}

function handleSettingsForPlaceholder() {
  const state = useSettingsStore.getState();
  const signature = `${state.language}::${state.promptHint}`;
  if (composerPlaceholderSignature === signature) {
    return;
  }

  composerPlaceholderSignature = signature;
  updateComposerPlaceholder(state.language, state.promptHint);
}

function initComposerPlaceholder() {
  handleSettingsForPlaceholder();

  if (composerPlaceholderUnsubscribe) {
    return;
  }

  composerPlaceholderUnsubscribe = useSettingsStore.subscribe(() => {
    handleSettingsForPlaceholder();
  });
}

function teardownComposerPlaceholder() {
  if (composerPlaceholderUnsubscribe) {
    composerPlaceholderUnsubscribe();
    composerPlaceholderUnsubscribe = null;
  }

  composerPlaceholderSignature = null;
  composerPlaceholderText = null;
}

function setComposerCountersVisibility(visible: boolean) {
  if (!composerCountersContainer) {
    return;
  }
  composerCountersContainer.hidden = !visible;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function isHtmlTextAreaElement(value: unknown): value is HTMLTextAreaElement {
  return typeof HTMLTextAreaElement !== 'undefined' && value instanceof HTMLTextAreaElement;
}

function isHtmlContentEditable(value: unknown): value is HTMLElement {
  return isHtmlElement(value) && value.isContentEditable;
}

function formatTokensValue(count: number, limit: number) {
  return translate('content.composerCounters.tokensValue', '{{count}} / {{limit}}', {
    count: counterNumberFormatter.format(Math.max(0, count)),
    limit: counterNumberFormatter.format(Math.max(0, limit))
  });
}

function setComposerCountersValues(words: number, characters: number, tokens: number) {
  lastComposerMetrics = {
    words: Math.max(0, words),
    characters: Math.max(0, characters),
    tokens: Math.max(0, tokens)
  };

  if (!composerCountersContainer) {
    return;
  }

  if (composerWordsValue) {
    composerWordsValue.textContent = counterNumberFormatter.format(lastComposerMetrics.words);
  }

  if (composerCharactersValue) {
    composerCharactersValue.textContent = counterNumberFormatter.format(lastComposerMetrics.characters);
  }

  const limit = sanitizeTokenLimit(tokenLimit);
  if (composerTokensValue) {
    composerTokensValue.textContent = formatTokensValue(lastComposerMetrics.tokens, limit);
  }

  if (composerTokensBadge) {
    composerTokensBadge.setAttribute('data-over-limit', lastComposerMetrics.tokens > limit ? 'true' : 'false');
  }
}

function applyCounterTranslations() {
  if (!composerCountersContainer) {
    return;
  }

  if (composerWordsLabel) {
    composerWordsLabel.textContent = translate('content.composerCounters.wordsLabel', 'Words');
  }

  if (composerCharactersLabel) {
    composerCharactersLabel.textContent = translate('content.composerCounters.charactersLabel', 'Characters');
  }

  if (composerTokensLabel) {
    composerTokensLabel.textContent = translate('content.composerCounters.tokensLabel', 'Tokens');
  }

  setComposerCountersValues(lastComposerMetrics.words, lastComposerMetrics.characters, lastComposerMetrics.tokens);
}

function readComposerText(target: HTMLTextAreaElement | HTMLElement | null): string {
  if (!target) {
    return '';
  }

  if (isHtmlTextAreaElement(target)) {
    return target.value ?? '';
  }

  if (isHtmlContentEditable(target)) {
    return target.textContent ?? '';
  }

  return '';
}

function getComposerCaretOffset(target: HTMLTextAreaElement | HTMLElement): number | null {
  if (isHtmlTextAreaElement(target)) {
    return target.selectionStart ?? target.value.length;
  }

  if (isHtmlContentEditable(target)) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!target.contains(range.startContainer)) {
      return null;
    }

    const preRange = range.cloneRange();
    preRange.selectNodeContents(target);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  return null;
}

function resolveContentEditablePosition(
  root: HTMLElement,
  offset: number
): { node: Node; offset: number } | null {
  const totalLength = root.textContent?.length ?? 0;
  const clampedOffset = Math.max(0, Math.min(offset, totalLength));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let remaining = clampedOffset;
  let lastText: Text | null = null;

  while (true) {
    const current = walker.nextNode() as Text | null;
    if (!current) {
      break;
    }

    lastText = current;
    const length = current.textContent?.length ?? 0;
    if (remaining <= length) {
      return { node: current, offset: remaining };
    }

    remaining -= length;
  }

  if (lastText) {
    const length = lastText.textContent?.length ?? 0;
    return { node: lastText, offset: length };
  }

  return { node: root, offset: root.childNodes.length };
}

function dispatchComposerInputEvent(target: HTMLTextAreaElement | HTMLElement, data = '') {
  const event =
    typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, data })
      : new Event('input', { bubbles: true });

  target.dispatchEvent(event);
}

function replaceComposerRange(
  target: HTMLTextAreaElement | HTMLElement,
  start: number,
  end: number,
  replacement: string
): boolean {
  const text = readComposerText(target);
  const boundedStart = Math.max(0, Math.min(start, end, text.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, text.length));

  if (isHtmlTextAreaElement(target)) {
    target.setSelectionRange(boundedStart, boundedEnd);
    target.setRangeText(replacement, boundedStart, boundedEnd, 'end');
    const caret = boundedStart + replacement.length;
    target.setSelectionRange(caret, caret);
    dispatchComposerInputEvent(target, replacement);
    return true;
  }

  if (isHtmlContentEditable(target)) {
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    try {
      target.focus({ preventScroll: true });
    } catch {
      // Ignore focus errors for cross-origin elements.
    }

    const startPosition = resolveContentEditablePosition(target, boundedStart);
    const endPosition = resolveContentEditablePosition(target, boundedEnd);
    if (!startPosition || !endPosition) {
      return false;
    }

    const range = document.createRange();
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
    range.deleteContents();

    if (replacement.length > 0) {
      range.insertNode(document.createTextNode(replacement));
    }

    const caretOffset = boundedStart + replacement.length;
    const caretPosition = resolveContentEditablePosition(target, caretOffset);
    if (caretPosition) {
      selection.removeAllRanges();
      const caretRange = document.createRange();
      caretRange.setStart(caretPosition.node, caretPosition.offset);
      caretRange.collapse(true);
      selection.addRange(caretRange);
    }

    dispatchComposerInputEvent(target, replacement);
    return true;
  }

  return false;
}

function maybeHandleInlineTrigger() {
  if (!activeComposer || suppressInlineTriggerHandling) {
    return;
  }

  const caret = getComposerCaretOffset(activeComposer);
  if (caret === null) {
    return;
  }

  const text = readComposerText(activeComposer);
  const match = findInlineTrigger(text, caret);
  if (!match) {
    return;
  }

  suppressInlineTriggerHandling = true;
  const removed = replaceComposerRange(activeComposer, match.start, match.end, '');
  suppressInlineTriggerHandling = false;

  if (!removed) {
    return;
  }

  updateComposerCounterValues();

  if (match.target === 'prompts') {
    state.filter = match.query;
  } else {
    state.filter = '';
  }

  openPanel(match.target);

  if (match.target === 'prompts') {
    if (searchInput) {
      searchInput.value = match.query;
    }
    renderPromptList();
  }
}

function computeComposerMetrics(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const tokens = trimmed ? Math.max(words, Math.ceil(trimmed.length / 4)) : 0;
  return { words, characters, tokens };
}

function updateComposerCounterValues() {
  const text = readComposerText(activeComposer);
  const metrics = computeComposerMetrics(text);
  setComposerCountersValues(metrics.words, metrics.characters, metrics.tokens);
}

function attachToComposer(element: HTMLTextAreaElement | HTMLElement) {
  if (activeComposer === element) {
    setComposerCountersVisibility(true);
    updateComposerCounterValues();
    const state = useSettingsStore.getState();
    updateComposerPlaceholder(state.language, state.promptHint, element);
    return;
  }

  detachComposer();
  activeComposer = element;

  const listener = (event: Event) => {
    updateComposerCounterValues();
    if (event.type === 'input') {
      maybeHandleInlineTrigger();
    }
  };
  composerInputListener = listener;

  element.addEventListener('input', listener);
  if (!isHtmlTextAreaElement(element)) {
    element.addEventListener('keyup', listener);
  }

  setComposerCountersVisibility(true);
  updateComposerCounterValues();

  const state = useSettingsStore.getState();
  updateComposerPlaceholder(state.language, state.promptHint, element);
}

function detachComposer() {
  if (activeComposer && composerInputListener) {
    activeComposer.removeEventListener('input', composerInputListener);
    activeComposer.removeEventListener('keyup', composerInputListener);
  }

  if (activeComposer) {
    restoreComposerPlaceholder(activeComposer);
  }

  activeComposer = null;
  composerInputListener = null;

  setComposerCountersVisibility(false);
  setComposerCountersValues(0, 0, 0);
}

function scheduleComposerEvaluation() {
  if (composerEvaluationTimeout !== null) {
    return;
  }

  composerEvaluationTimeout = window.setTimeout(() => {
    composerEvaluationTimeout = null;
    evaluateComposer();
  }, 50);
}

function evaluateComposer() {
  const candidate = getComposerElement();
  if (candidate) {
    attachToComposer(candidate);
  } else {
    detachComposer();
  }
}

function initComposerCounters() {
  if (composerCountersInitialized) {
    updateComposerCounterValues();
    return;
  }

  composerCountersInitialized = true;
  tokenLimit = sanitizeTokenLimit(useSettingsStore.getState().maxTokens);

  unsubscribeTokenLimit = useSettingsStore.subscribe((state) => {
    const nextLimit = sanitizeTokenLimit(state.maxTokens);
    if (nextLimit === tokenLimit) {
      return;
    }
    tokenLimit = nextLimit;
    setComposerCountersValues(lastComposerMetrics.words, lastComposerMetrics.characters, lastComposerMetrics.tokens);
  });

  if (typeof document !== 'undefined') {
    composerObserver = new MutationObserver(() => {
      scheduleComposerEvaluation();
    });

    const target = document.body ?? document.documentElement;
    if (target) {
      composerObserver.observe(target, { childList: true, subtree: true });
    }

    composerFocusListener = () => {
      scheduleComposerEvaluation();
    };
    document.addEventListener('focusin', composerFocusListener, true);
  }

  evaluateComposer();
}

function teardownComposerCounters() {
  if (composerObserver) {
    composerObserver.disconnect();
    composerObserver = null;
  }

  if (composerFocusListener) {
    document.removeEventListener('focusin', composerFocusListener, true);
    composerFocusListener = null;
  }

  if (composerEvaluationTimeout !== null) {
    window.clearTimeout(composerEvaluationTimeout);
    composerEvaluationTimeout = null;
  }

  if (unsubscribeTokenLimit) {
    unsubscribeTokenLimit();
    unsubscribeTokenLimit = null;
  }

  detachComposer();
  composerCountersInitialized = false;
  tokenLimit = DEFAULT_TOKEN_LIMIT;
}

function refreshBubbleLabels() {
  for (const config of BUBBLE_CONFIGS) {
    const entry = bubbleButtons.get(config.id);
    if (!entry) {
      continue;
    }

    const { button, label } = entry;
    const count =
      config.id === 'prompts'
        ? state.prompts.length
        : config.id === 'chains'
          ? state.promptChains.length
          : config.id === 'bookmarks'
            ? state.bookmarks.length
            : undefined;
    const options = typeof count === 'number' ? { count } : undefined;
    const labelText = translate(config.labelKey, config.labelFallback, options);

    label.textContent = labelText;
    button.setAttribute('title', labelText);

    const ariaLabel = translate(config.ariaKey, config.ariaFallback, options);
    button.setAttribute('aria-label', ariaLabel);

    if (config.kind === 'panel') {
      const isActive = state.open && state.activeBubble === config.id;
      button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      button.setAttribute('data-active', isActive ? 'true' : 'false');
    } else {
      button.removeAttribute('aria-expanded');
      button.setAttribute('data-active', 'false');
    }
  }
}

function openPanel(bubbleId: PanelBubbleId) {
  state.activeBubble = bubbleId;
  state.open = true;

  if (bubbleId !== 'prompts') {
    state.filter = '';
    if (searchInput) {
      searchInput.value = '';
    }
  }

  refreshBubbleLabels();
  renderActivePanel();

  maybeShowLauncherPopover(bubbleId);

  if (bubbleId === 'prompts') {
    searchInput?.focus({ preventScroll: true });
  }
}

function closePanel(options: { focusTrigger?: boolean } = {}) {
  if (!state.open) {
    state.activeBubble = null;
    refreshBubbleLabels();
    return;
  }

  const previousBubble = state.activeBubble;
  state.open = false;
  state.activeBubble = null;
  state.filter = '';

  hideLauncherPopover();

  if (searchInput) {
    searchInput.value = '';
  }

  renderActivePanel();
  refreshBubbleLabels();

  if (options.focusTrigger && previousBubble) {
    const entry = bubbleButtons.get(previousBubble);
    entry?.button.focus({ preventScroll: true });
  }
}

function renderActivePanel() {
  if (
    !panel ||
    !titleEl ||
    !emptyState ||
    !emptyTitleEl ||
    !emptySubtitleEl ||
    !promptList ||
    !searchWrapper ||
    !closeButton
  ) {
    return;
  }

  if (!state.open || !state.activeBubble) {
    panel.hidden = true;
    panel.removeAttribute('data-bubble');
    searchWrapper.hidden = true;
    promptList.hidden = true;
    emptyState.hidden = false;
    titleEl.textContent = translate('content.promptLauncher.title', 'Saved prompts');
    return;
  }

  const config = panelBubbleConfigs.get(state.activeBubble);
  if (!config) {
    panel.hidden = true;
    panel.removeAttribute('data-bubble');
    return;
  }

  panel.hidden = false;
  panel.setAttribute('data-bubble', config.id);

  const titleText = translate(config.panelTitleKey, config.panelTitleFallback);
  titleEl.textContent = titleText;

  if (config.showSearch) {
    searchWrapper.hidden = false;
    if (searchInput) {
      searchInput.placeholder = translate('content.promptLauncher.searchPlaceholder', 'Search prompts...');
    }
    renderPromptList();
    return;
  }

  searchWrapper.hidden = true;

  if (config.id === 'chains') {
    renderChainList();
    return;
  }

  if (config.id === 'bookmarks') {
    renderBookmarkList();
    return;
  }

  promptList.innerHTML = '';
  promptList.hidden = true;
  emptyState.hidden = false;
  emptyTitleEl.textContent = translate(config.placeholderTitleKey, config.placeholderTitleFallback);
  emptySubtitleEl.textContent = translate(
    config.placeholderSubtitleKey,
    config.placeholderSubtitleFallback
  );
}

function subscribeToPrompts() {
  promptsSubscription?.unsubscribe();

  promptsSubscription = liveQuery(async () => {
    const [prompts, folders] = await Promise.all([
      db.prompts.orderBy('updatedAt').reverse().limit(MAX_PROMPTS * 2).toArray(),
      db.folders.where('kind').equals('prompt').toArray()
    ]);
    return { prompts, folders };
  }).subscribe({
    next: ({ prompts, folders }) => {
      state.prompts = prompts;
      state.folderNames = new Map(folders.map((folder: FolderRecord) => [folder.id, folder.name]));
      refreshBubbleLabels();
      if (state.activeBubble === 'prompts') {
        renderPromptList();
      }
    },
    error: (error) => {
      console.error('[ai-companion] prompt launcher query failed', error);
    }
  });
}

function subscribeToPromptChains() {
  promptChainsSubscription?.unsubscribe();

  promptChainsSubscription = liveQuery(() => listPromptChains()).subscribe({
    next: (chains) => {
      state.promptChains = chains;
      refreshBubbleLabels();
      if (state.activeBubble === 'chains') {
        renderChainList();
      }
    },
    error: (error) => {
      console.error('[ai-companion] prompt chain launcher query failed', error);
    }
  });
}

function subscribeToBookmarks() {
  bookmarksSubscription?.unsubscribe();

  bookmarksSubscription = liveQuery(() => getRecentBookmarks(MAX_BOOKMARKS)).subscribe({
    next: (bookmarks) => {
      state.bookmarks = bookmarks;
      refreshBubbleLabels();
      if (state.activeBubble === 'bookmarks') {
        renderBookmarkList();
      }
    },
    error: (error) => {
      console.error('[ai-companion] bookmark launcher query failed', error);
    }
  });
}

function subscribeToPromptChainRuntime() {
  promptChainsRuntimeUnsubscribe?.();
  promptChainsRuntimeUnsubscribe = usePromptChainsStore.subscribe(() => {
    if (state.activeBubble === 'chains') {
      renderChainList();
    }
  });
}

function renderPromptList() {
  if (!promptList || !emptyState || !emptyTitleEl || !emptySubtitleEl) {
    return;
  }

  if (state.activeBubble !== 'prompts') {
    return;
  }

  const term = state.filter.trim().toLowerCase();
  const prompts = state.prompts ?? [];
  const filtered = term
    ? prompts.filter((prompt) => matchesPrompt(prompt, term))
    : prompts;

  promptList.innerHTML = '';

  if (filtered.length === 0) {
    promptList.hidden = true;
    emptyState.hidden = false;

    if (prompts.length === 0) {
      emptyTitleEl.textContent = translate('content.promptLauncher.emptyTitle', 'No prompts yet');
      emptySubtitleEl.textContent = translate(
        'content.promptLauncher.emptySubtitle',
        'Save prompts in the dashboard or popup to reuse them here.'
      );
    } else if (term.length > 0) {
      emptyTitleEl.textContent = translate(
        'content.promptLauncher.emptyFilteredTitle',
        'No prompts match your search'
      );
      emptySubtitleEl.textContent = translate(
        'content.promptLauncher.emptyFilteredSubtitle',
        'Adjust the search or create a new template.'
      );
    }
    return;
  }

  emptyState.hidden = true;
  promptList.hidden = false;

  const limited = filtered.slice(0, MAX_PROMPTS);
  const items = limited.map((prompt) => createPromptListItem(prompt));
  promptList.append(...items);
}

function renderChainList() {
  if (!promptList || !emptyState || !emptyTitleEl || !emptySubtitleEl) {
    return;
  }

  if (state.activeBubble !== 'chains') {
    return;
  }

  const chains = state.promptChains ?? [];
  promptList.innerHTML = '';

  if (chains.length === 0) {
    promptList.hidden = true;
    emptyState.hidden = false;
    emptyTitleEl.textContent = translate('content.bubblePanels.chains.emptyTitle', 'No chains yet');
    emptySubtitleEl.textContent = translate(
      'content.bubblePanels.chains.emptySubtitle',
      'Group prompts into chains in the dashboard to launch them here.'
    );
    return;
  }

  emptyState.hidden = true;
  promptList.hidden = false;

  const runtime = usePromptChainsStore.getState();
  const limited = chains.slice(0, MAX_CHAINS);
  const items = limited.map((chain) => createChainListItem(chain, runtime));
  promptList.append(...items);
}

function renderBookmarkList() {
  if (!promptList || !emptyState || !emptyTitleEl || !emptySubtitleEl) {
    return;
  }

  if (state.activeBubble !== 'bookmarks') {
    return;
  }

  const bookmarks = state.bookmarks ?? [];
  promptList.innerHTML = '';

  if (bookmarks.length === 0) {
    promptList.hidden = true;
    emptyState.hidden = false;
    emptyTitleEl.textContent = translate('content.bubblePanels.bookmarks.emptyTitle', 'No bookmarks yet');
    emptySubtitleEl.textContent = translate(
      'content.bubblePanels.bookmarks.emptySubtitle',
      'Bookmark ChatGPT messages to keep quick references handy in this bubble.'
    );
    return;
  }

  emptyState.hidden = true;
  promptList.hidden = false;

  const limited = bookmarks.slice(0, MAX_BOOKMARKS);
  const items = limited.map((bookmark) => createBookmarkListItem(bookmark));
  promptList.append(...items);
}

function openDashboard() {
  const dashboardUrl =
    chrome.runtime?.getURL?.('src/options/index.html') ??
    chrome.runtime?.getURL?.('options.html');

  if (chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage(() => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        console.error('[ai-companion] failed to open options page', lastError);
        if (dashboardUrl) {
          window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
        } else {
          console.error('[ai-companion] unable to resolve dashboard URL for fallback navigation');
        }
      }
    });
    return;
  }

  if (dashboardUrl) {
    window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  console.error('[ai-companion] dashboard URL could not be resolved');
}

function buildConversationUrl(conversationId: string) {
  const origin = window.location.origin.replace(/\/$/, '');
  if (!conversationId || conversationId.startsWith('local-')) {
    return origin || window.location.origin;
  }
  return `${origin || window.location.origin}/c/${conversationId}`;
}

function openConversation(conversationId: string) {
  const url = buildConversationUrl(conversationId);
  if (!url) {
    return;
  }

  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    try {
      chrome.tabs.create({ url }, () => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          console.error('[ai-companion] failed to open conversation tab', lastError);
        }
      });
      return;
    } catch (error) {
      console.error('[ai-companion] failed to open conversation via chrome.tabs.create', error);
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function matchesPrompt(prompt: PromptRecord, term: string) {
  const values = [
    prompt.name,
    prompt.description,
    prompt.content,
    prompt.folderId ? state.folderNames.get(prompt.folderId) : undefined
  ];

  return values.some((value) =>
    typeof value === 'string' ? value.toLowerCase().includes(term) : false
  );
}

function createPromptListItem(prompt: PromptRecord) {
  const item = document.createElement('li');
  item.className = 'list-item';

  const text = document.createElement('div');
  text.className = 'list-item-text';
  item.appendChild(text);

  const title = document.createElement('p');
  title.className = 'list-item-title';
  title.textContent = prompt.name;
  text.appendChild(title);

  if (prompt.description) {
    const description = document.createElement('p');
    description.className = 'list-item-description';
    description.textContent = prompt.description;
    text.appendChild(description);
  }

  const snippet = document.createElement('p');
  snippet.className = 'list-item-snippet';
  snippet.textContent = createSnippet(prompt.content);
  text.appendChild(snippet);

  const meta = document.createElement('p');
  meta.className = 'list-item-meta';
  const parts: string[] = [];

  if (prompt.folderId) {
    const folderName = state.folderNames.get(prompt.folderId);
    if (folderName) {
      parts.push(
        translate('content.promptLauncher.folderLabel', 'Folder: {{name}}', { name: folderName })
      );
    }
  }

  parts.push(
    translate('content.promptLauncher.updatedAt', 'Updated {{time}}', {
      time: formatDateTime(prompt.updatedAt)
    })
  );

  meta.textContent = parts.join(' | ');
  text.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  item.appendChild(actions);

  const insertBtn = document.createElement('button');
  insertBtn.type = 'button';
  insertBtn.className = 'insert-button';
  insertBtn.textContent = translate('content.promptLauncher.insertButton', 'Insert');
  attachClickHandler(insertBtn, (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleInsert(prompt);
  });
  actions.appendChild(insertBtn);

  return item;
}

function createChainListItem(chain: PromptChainRecord, runtime: PromptChainsRuntimeSnapshot) {
  const item = document.createElement('li');
  item.className = 'list-item';

  const text = document.createElement('div');
  text.className = 'list-item-text';
  item.appendChild(text);

  const title = document.createElement('p');
  title.className = 'list-item-title';
  title.textContent = chain.name;
  text.appendChild(title);

  if (chain.variables.length > 0) {
    const variables = document.createElement('p');
    variables.className = 'list-item-description';
    variables.textContent = translate(
      'content.bubblePanels.chains.variablesLabel',
      'Variables: {{count}}',
      { count: chain.variables.length }
    );
    text.appendChild(variables);
  }

  const meta = document.createElement('p');
  meta.className = 'list-item-meta';
  const metaParts = [formatChainStepCount(chain.nodeIds.length)];
  const statusText = formatChainStatus(chain, runtime);
  if (statusText) {
    metaParts.push(statusText);
  }
  meta.textContent = metaParts.join(' · ');
  text.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  item.appendChild(actions);

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'insert-button';

  const isRunning = runtime.status === 'running' && runtime.activeChainId === chain.id;
  const isBusy = runtime.status === 'running' && runtime.activeChainId !== chain.id;

  if (isRunning) {
    startButton.textContent = translate('content.bubblePanels.chains.runningButton', 'Running…');
    startButton.disabled = true;
    startButton.setAttribute(
      'aria-label',
      translate('content.bubblePanels.chains.runningAria', 'Prompt chain {{name}} is running', {
        name: chain.name
      })
    );
  } else {
    startButton.textContent = translate('content.bubblePanels.chains.startButton', 'Start chain');
    startButton.disabled = isBusy;
    const ariaLabel = isBusy
      ? translate('content.bubblePanels.chains.busyAria', 'Another chain is running')
      : translate('content.bubblePanels.chains.startAria', 'Start chain {{name}}', { name: chain.name });
    startButton.setAttribute('aria-label', ariaLabel);
  }

  attachClickHandler(startButton, (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (startButton.disabled) {
      return;
    }
    void handleRunChain(chain);
  });

  actions.appendChild(startButton);

  if (isRunning) {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = translate('content.bubblePanels.chains.cancelButton', 'Cancel run');
    cancelButton.setAttribute(
      'aria-label',
      translate('content.bubblePanels.chains.cancelAria', 'Cancel chain {{name}}', { name: chain.name })
    );
    attachClickHandler(cancelButton, (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleCancelChain(chain.id);
    });
    actions.appendChild(cancelButton);
  }

  return item;
}

function createBookmarkListItem(bookmark: BookmarkSummary) {
  const item = document.createElement('li');
  item.className = 'list-item';

  const text = document.createElement('div');
  text.className = 'list-item-text';
  item.appendChild(text);

  const fallbackTitle = translate('popup.untitledConversation', 'Untitled conversation');
  const title = document.createElement('p');
  title.className = 'list-item-title';
  title.textContent = bookmark.conversationTitle?.trim().length
    ? bookmark.conversationTitle
    : fallbackTitle;
  text.appendChild(title);

  const preview = document.createElement('p');
  preview.className = 'list-item-snippet';
  preview.textContent = bookmark.messagePreview
    ? bookmark.messagePreview
    : translate('popup.bookmarkConversationOnly', 'Conversation bookmark');
  text.appendChild(preview);

  if (bookmark.note) {
    const note = document.createElement('p');
    note.className = 'list-item-description';
    note.textContent = translate('popup.bookmarkNote', 'Note: {{note}}', { note: bookmark.note });
    text.appendChild(note);
  }

  const meta = document.createElement('p');
  meta.className = 'list-item-meta';
  const metaParts: string[] = [];
  if (bookmark.conversationPinned) {
    metaParts.push(translate('popup.pinnedBadge', 'Pinned'));
  }
  metaParts.push(
    translate('popup.bookmarkSaved', 'Saved {{time}}', {
      time: formatDateTime(bookmark.createdAt)
    })
  );
  meta.textContent = metaParts.join(' · ');
  text.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  item.appendChild(actions);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'insert-button';
  openButton.textContent = translate('popup.openConversation', 'Open');
  attachClickHandler(openButton, (event) => {
    event.preventDefault();
    event.stopPropagation();
    openConversation(bookmark.conversationId);
  });
  actions.appendChild(openButton);

  return item;
}

function createSnippet(content: string, maxLength = 160) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatChainStepCount(count: number) {
  if (count === 1) {
    return translate('content.bubblePanels.chains.stepCountOne', '1 step');
  }

  return translate('content.bubblePanels.chains.stepCountOther', '{{count}} steps', { count });
}

function formatChainStatus(chain: PromptChainRecord, runtime: PromptChainsRuntimeSnapshot) {
  const { status, activeChainId, totalSteps, completedSteps, error, completedAt } = runtime;
  const normalizedTotal = totalSteps > 0 ? totalSteps : Math.max(1, chain.nodeIds.length);

  if (status === 'running') {
    if (activeChainId === chain.id) {
      const current = Math.min(Math.max(completedSteps, 0), normalizedTotal);
      return translate('content.bubblePanels.chains.runningStatus', 'Running ({{current}} / {{total}})', {
        current,
        total: normalizedTotal
      });
    }
    return translate('content.bubblePanels.chains.busyStatus', 'Another chain is running');
  }

  if (status === 'error' && activeChainId === chain.id) {
    return translate('content.bubblePanels.chains.errorStatus', 'Failed: {{message}}', {
      message:
        error ?? translate('content.bubblePanels.chains.genericError', 'Something went wrong')
    });
  }

  if (status === 'completed' && activeChainId === chain.id) {
    const timestamp = completedAt ?? chain.lastExecutedAt ?? new Date().toISOString();
    return translate('content.bubblePanels.chains.completedStatus', 'Completed {{time}}', {
      time: formatDateTime(timestamp)
    });
  }

  if (status === 'cancelled' && activeChainId === chain.id) {
    const timestamp = completedAt ?? new Date().toISOString();
    const current = Math.min(Math.max(completedSteps, 0), normalizedTotal);
    return translate(
      'content.bubblePanels.chains.cancelledStatus',
      'Cancelled ({{current}} / {{total}}) · {{time}}',
      {
        current,
        total: normalizedTotal,
        time: formatDateTime(timestamp)
      }
    );
  }

  if (chain.lastExecutedAt) {
    return translate('content.bubblePanels.chains.lastUsed', 'Last used {{time}}', {
      time: formatDateTime(chain.lastExecutedAt)
    });
  }

  return translate('content.bubblePanels.chains.lastUsedNever', 'Not run yet');
}

async function handleRunChain(chain: PromptChainRecord) {
  try {
    const response = await sendRuntimeMessage('content/run-chain', { chainId: chain.id });
    if (response.status === 'busy') {
      console.warn('[ai-companion] a prompt chain is already running');
    } else if (response.status === 'empty') {
      console.warn('[ai-companion] prompt chain has no steps to run');
    } else if (response.status === 'not_found') {
      console.warn('[ai-companion] prompt chain not found for execution');
    } else if (response.status === 'error') {
      console.error('[ai-companion] prompt chain run failed', response.message);
    } else if (response.status === 'cancelled') {
      console.info('[ai-companion] prompt chain run cancelled');
    }
  } catch (error) {
    console.error('[ai-companion] failed to start prompt chain run', error);
  }
}

function handleCancelChain(chainId: string) {
  const runtime = usePromptChainsStore.getState();
  if (runtime.status !== 'running' || runtime.activeChainId !== chainId) {
    return;
  }

  runtime.cancelRun();
}

export function insertTextIntoComposer(text: string): boolean {
  const target = getComposerElement();
  if (!target) {
    console.warn('[ai-companion] no ChatGPT composer element detected for prompt insert');
    return false;
  }

  if (isHtmlTextAreaElement(target)) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus({ preventScroll: false });
    return true;
  }

  if (isHtmlContentEditable(target)) {
    insertIntoContentEditable(target, text);
    return true;
  }

  console.warn('[ai-companion] unsupported composer element for prompt insert');
  return false;
}

function handleInsert(prompt: PromptRecord) {
  const inserted = insertTextIntoComposer(prompt.content);
  if (!inserted) {
    return;
  }

  closePanel();
}

function insertIntoContentEditable(element: HTMLElement, text: string) {
  try {
    element.focus({ preventScroll: false });
  } catch (error) {
    console.error('[ai-companion] failed to focus content editable composer', error);
  }

  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();

  if (range) {
    if (!selection || !element.contains(range.startContainer)) {
      range.selectNodeContents(element);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else {
    element.append(text);
  }

  const inputEvent =
    typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, data: text })
      : new Event('input', { bubbles: true });

  element.dispatchEvent(inputEvent);
}

function getComposerElement(): HTMLTextAreaElement | HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const active = document.activeElement;
  if (isHtmlTextAreaElement(active)) {
    return active;
  }
  if (isHtmlContentEditable(active)) {
    return active;
  }

  const selectors = [
    'textarea[data-id="root"]',
    'textarea[aria-label]',
    'form textarea',
    '[contenteditable="true"][data-id]',
    '[contenteditable="true"][role="textbox"]'
  ];

  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (isHtmlTextAreaElement(candidate)) {
      return candidate;
    }
    if (isHtmlContentEditable(candidate)) {
      return candidate;
    }
  }

  return null;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

function handleDocumentClick(event: MouseEvent) {
  if (!state.open || !container) {
    return;
  }
  const path = event.composedPath();
  if (path.includes(container)) {
    return;
  }
  closePanel();
}

function handleKeyDown(event: KeyboardEvent) {
  if (!state.open || event.key !== 'Escape') {
    return;
  }
  if (container && event.composedPath().includes(container)) {
    event.preventDefault();
    closePanel({ focusTrigger: true });
  }
}

function handlePageHide() {
  cleanup();
}

function cleanup() {
  closePanel();
  promptsSubscription?.unsubscribe();
  promptsSubscription = null;
  bookmarksSubscription?.unsubscribe();
  bookmarksSubscription = null;
  promptChainsSubscription?.unsubscribe();
  promptChainsSubscription = null;
  promptChainsRuntimeUnsubscribe?.();
  promptChainsRuntimeUnsubscribe = null;
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('pagehide', handlePageHide);
  teardownComposerPlaceholder();
  teardownComposerCounters();
  composerCountersContainer = null;
  composerWordsLabel = null;
  composerCharactersLabel = null;
  composerTokensLabel = null;
  composerWordsValue = null;
  composerCharactersValue = null;
  composerTokensValue = null;
  composerTokensBadge = null;
  launcherPopover = null;
  launcherPopoverTitle = null;
  launcherPopoverSubtitle = null;
  launcherPopoverList = null;
  launcherPopoverDismissButton = null;
  launcherPopoverVisible = false;
  launcherPopoverItemLabels.clear();
  mounted = false;
}

export async function mountPromptLauncher(): Promise<void> {
  if (mounted) {
    return;
  }
  mounted = true;

  await initializeSettingsStore();
  await ensureI18n();
  ensureContainer();
  applyTranslations();
  subscribeToPrompts();
  subscribeToPromptChains();
  subscribeToBookmarks();
  subscribeToPromptChainRuntime();
  initComposerCounters();
  initComposerPlaceholder();

  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('pagehide', handlePageHide, { once: true });
}






