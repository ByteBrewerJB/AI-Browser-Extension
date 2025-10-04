import React, { StrictMode, useEffect, useId, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import globalStylesUrl from '@/styles/global.css?url';

const HOST_ID = 'ai-companion-shadow-host';

const SIDEBAR_SELECTORS = [
  'nav[aria-label="Chat history"]',
  'nav[aria-label="Chat History"]',
  'nav[aria-label="ChatGPT history"]',
  'nav[aria-label="Conversation history"]',
  'nav[aria-label*="chat history" i]',
  'nav[aria-label*="chatgpt history" i]',
  'nav[aria-label*="conversation history" i]',
  'nav[aria-label*="history" i]',
  '[data-testid="left-sidebar"] nav',
  '[data-testid="left-sidebar"] aside',
  '[data-testid="left-sidebar"]',
  '[data-testid="left_sidebar"]',
];

const SIDEBAR_LIST_CANDIDATES = [
  'ol',
  'ul',
  '[role="list"]',
  '[data-testid="nav-list"]',
  '[data-testid="conversation-list"]',
];

let sidebarMutationObserver: MutationObserver | null = null;
let sidebarResizeObserver: ResizeObserver | null = null;
let resizeObserverTarget: HTMLElement | null = null;
let activeHost: HTMLElement | null = null;
let locationWatcher: number | null = null;
let lastKnownHref = typeof window !== 'undefined' ? window.location.href : '';

function findListWithin(element: Element | null): HTMLElement | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  if (element.matches(SIDEBAR_LIST_CANDIDATES.join(', '))) {
    return element;
  }

  for (const selector of SIDEBAR_LIST_CANDIDATES) {
    const list = element.querySelector(selector);
    if (list instanceof HTMLElement) {
      return list;
    }
  }

  return null;
}

function findSidebarContainer(): HTMLElement | null {
  for (const selector of SIDEBAR_SELECTORS) {
    const candidate = document.querySelector(selector) as HTMLElement | null;
    if (!candidate) {
      continue;
    }

    const scope =
      candidate.matches('nav, ol, ul, [role="list"]')
        ? candidate
        : (candidate.closest('nav, [data-testid="left-sidebar"], [data-testid="left_sidebar"]') as HTMLElement | null) ?? candidate;

    const list = findListWithin(scope);
    if (list) {
      return list;
    }
  }

  const sidebarTestId = document.querySelector('[data-testid="left-sidebar"]');
  const sidebarList = findListWithin(sidebarTestId);
  if (sidebarList) {
    return sidebarList;
  }

  const genericNav = document.querySelector(
    'nav[aria-label*="history" i], nav[aria-label*="recent" i]'
  );
  const genericList = findListWithin(genericNav);
  if (genericList) {
    return genericList;
  }

  const fallbackSidebar = document.querySelector('[data-testid*="sidebar" i]');
  const fallbackList = findListWithin(fallbackSidebar);
  if (fallbackList) {
    return fallbackList;
  }

  return null;
}

function ensureHostPlacement(): void {
  if (!activeHost) {
    return;
  }
  const sidebar = findSidebarContainer();

  if (!sidebar) {
    activeHost.setAttribute('data-ai-companion-hidden', 'true');
    if (activeHost.parentElement) {
      activeHost.remove();
    }
    if (resizeObserverTarget && sidebarResizeObserver) {
      sidebarResizeObserver.unobserve(resizeObserverTarget);
    }
    resizeObserverTarget = null;
    return;
  }

  activeHost.removeAttribute('data-ai-companion-hidden');
  if (activeHost.parentElement !== sidebar) {
    sidebar.appendChild(activeHost);
  }

  const measurementTarget =
    (sidebar.closest('[data-testid="left-sidebar"]') as HTMLElement | null) ??
    (sidebar.closest('nav') as HTMLElement | null) ??
    sidebar;

  const rect = measurementTarget.getBoundingClientRect();
  const collapsed =
    rect.width < 80 ||
    measurementTarget.offsetParent === null ||
    measurementTarget.getAttribute('data-state') === 'collapsed' ||
    measurementTarget.classList.contains('collapsed');

  if (collapsed) {
    activeHost.setAttribute('data-ai-companion-collapsed', 'true');
  } else {
    activeHost.removeAttribute('data-ai-companion-collapsed');
  }

  if (!sidebarResizeObserver) {
    sidebarResizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        ensureHostPlacement();
      });
    });
  }

  if (resizeObserverTarget !== measurementTarget) {
    if (resizeObserverTarget && sidebarResizeObserver) {
      sidebarResizeObserver.unobserve(resizeObserverTarget);
    }

    resizeObserverTarget = measurementTarget;
    sidebarResizeObserver.observe(measurementTarget);
  }
}

async function waitForSidebarContainer(): Promise<HTMLElement> {
  const existing = findSidebarContainer();
  if (existing) {
    return existing;
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const candidate = findSidebarContainer();
      if (candidate) {
        observer.disconnect();
        resolve(candidate);
      }
    });

    const target = document.body ?? document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  });
}

function initializeSidebarWatchers(host: HTMLElement) {
  activeHost = host;
  ensureHostPlacement();

  if (!sidebarMutationObserver) {
    sidebarMutationObserver = new MutationObserver(() => {
      ensureHostPlacement();
    });

    const target = document.body ?? document.documentElement;
    if (target) {
      sidebarMutationObserver.observe(target, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (locationWatcher === null) {
    locationWatcher = window.setInterval(() => {
      if (lastKnownHref !== window.location.href) {
        lastKnownHref = window.location.href;
        ensureHostPlacement();
      }
    }, 750);
  }
}

async function ensureShadowHost(): Promise<HTMLElement> {
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    initializeSidebarWatchers(existing);
    return existing;
  }

  const sidebar = await waitForSidebarContainer();
  const host = document.createElement('li');
  host.id = HOST_ID;
  sidebar.appendChild(host);
  initializeSidebarWatchers(host);
  return host;
}

function mountReact(rootElement: HTMLElement) {
  if (rootElement.shadowRoot) {
    return rootElement.shadowRoot as ShadowRoot;
  }
  const shadow = rootElement.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: list-item;
      width: 100%;
      color: inherit;
      font: inherit;
      list-style: none;
      pointer-events: auto;
    }
    :host([data-ai-companion-hidden="true"]) {
      display: none !important;
    }
    :host([data-ai-companion-collapsed="true"]) .ai-companion-label,
    :host([data-ai-companion-collapsed="true"]) .ai-companion-subtitle,
    :host([data-ai-companion-collapsed="true"]) .ai-companion-chevron {
      display: none !important;
    }
    :host([data-ai-companion-collapsed="true"]) .ai-companion-button {
      justify-content: center;
      padding: 0.75rem;
    }
    :host([data-ai-companion-collapsed="true"]) .ai-companion-panel {
      display: none !important;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; padding: 0; }
    a { color: inherit; text-decoration: none; }
    svg { display: block; }
  `;
  shadow.appendChild(style);
  const globalStyles = document.createElement('link');
  globalStyles.rel = 'stylesheet';
  globalStyles.href = globalStylesUrl;
  shadow.appendChild(globalStyles);
  const container = document.createElement('div');
  shadow.appendChild(container);
  return shadow;
}

function CompanionSidebarItem() {
  const panelId = useId();
  const [isExpanded, setExpanded] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeToolbar, setActiveToolbar] = useState<'history' | 'prompts' | 'media'>('history');

  useEffect(() => {
    const host = document.getElementById(HOST_ID);
    if (!host) {
      return;
    }
    if (isExpanded) {
      host.setAttribute('data-ai-companion-open', 'true');
    } else {
      host.removeAttribute('data-ai-companion-open');
    }
  }, [isExpanded]);

  useEffect(() => {
    const host = document.getElementById(HOST_ID);
    if (!host) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (host.getAttribute('data-ai-companion-collapsed') === 'true') {
        setExpanded(false);
      }
    });
    observer.observe(host, { attributes: true, attributeFilter: ['data-ai-companion-collapsed'] });
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      const host = document.getElementById(HOST_ID);
      if (host) {
        host.removeAttribute('data-ai-companion-open');
      }
    };
  }, []);

  const toolbarLabel = useMemo(() => {
    switch (activeToolbar) {
      case 'prompts':
        return 'Prompt toolbox';
      case 'media':
        return 'Voice controls';
      case 'history':
      default:
        return 'Conversation tools';
    }
  }, [activeToolbar]);

  const chevronClasses = `ai-companion-chevron h-4 w-4 text-slate-400 transition-transform duration-200 ${
    isExpanded ? 'rotate-180 text-slate-200' : ''
  }`;
  const panelClasses = `ai-companion-panel ${
    isExpanded
      ? 'mt-2 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-lg backdrop-blur-sm'
      : 'hidden'
  }`;

  return (
    <>
      <button
        aria-controls={panelId}
        aria-expanded={isExpanded}
        aria-label="AI Companion"
        className="ai-companion-button group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        onClick={() => setExpanded((previous) => !previous)}
        type="button"
      >
        <span className="ai-companion-icon flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 text-[11px] font-semibold uppercase tracking-wide text-emerald-950 shadow-sm">
          AI
        </span>
        <span className="ai-companion-label flex-1">
          <span className="block text-sm font-semibold leading-tight text-slate-100">AI Companion</span>
          <span className="ai-companion-subtitle mt-0.5 block text-xs font-normal text-slate-400">
            Quick tools & prompts
          </span>
        </span>
        <svg aria-hidden className={chevronClasses} fill="none" viewBox="0 0 20 20">
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      <div aria-hidden={!isExpanded} className={panelClasses} id={panelId}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">AI Companion</p>
            <h2 className="text-base font-semibold text-slate-50">{toolbarLabel}</h2>
          </div>
          <button
            className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            Patterns
          </button>
        </header>
        <Tabs defaultValue="history" onChange={(value) => setActiveToolbar(value as typeof activeToolbar)}>
          <TabList className="ai-companion-tabs mb-3 flex gap-2 rounded-lg bg-white/5 p-1">
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="history"
            >
              History
            </Tab>
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="prompts"
            >
              Prompts
            </Tab>
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="media"
            >
              Media
            </Tab>
          </TabList>
          <TabPanels className="ai-companion-tab-panels space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200 shadow-inner">
            <TabPanel value="history">
              <p>
                Save and pin chats directly from the conversation view. Table presets created here sync with the dashboard.
              </p>
            </TabPanel>
            <TabPanel value="prompts">
              <p>
                Build prompt chains inline, attach them to GPT folders, and reuse them across popup and options surfaces.
              </p>
            </TabPanel>
            <TabPanel value="media">
              <p>
                Voice overlays reuse the shared modal + overlay primitives to ensure consistent focus management and styling.
              </p>
            </TabPanel>
          </TabPanels>
        </Tabs>
        <Modal labelledBy="overlay-modal-heading" onClose={() => setModalOpen(false)} open={isModalOpen}>
          <ModalHeader>
            <h3 id="overlay-modal-heading" className="text-lg font-semibold text-slate-100">
              Shared component library
            </h3>
            <p className="text-sm text-slate-300">
              Modals, tabs, and overlays are rendered within a shadow root so styles do not collide with ChatGPT.
            </p>
          </ModalHeader>
          <ModalBody>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-200">
              <li>Keyboard shortcuts remain functional thanks to consistent escape handling.</li>
              <li>All surfaces respect RTL layouts and localized labels from the shared i18n bundle.</li>
              <li>Zustand domain stores hydrate content, popup, and options entries without prop drilling.</li>
            </ul>
          </ModalBody>
          <ModalFooter>
            <button
              className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              Close
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </>
  );
}

function init() {
  ensureShadowHost().then((host) => {
    const shadow = mountReact(host);
    const container = shadow.querySelector('div:last-of-type') as HTMLDivElement | null;
    if (!container) {
      throw new Error('Failed to initialize companion overlay container');
    }
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <CompanionSidebarItem />
      </StrictMode>
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
