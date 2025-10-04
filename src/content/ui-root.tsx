import React, { StrictMode, useMemo, useState } from 'react';
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

let sidebarMutationObserver: MutationObserver | null = null;
let sidebarResizeObserver: ResizeObserver | null = null;
let observedSidebar: HTMLElement | null = null;
let activeHost: HTMLElement | null = null;
let locationWatcher: number | null = null;
let lastKnownHref = typeof window !== 'undefined' ? window.location.href : '';

function findSidebarContainer(): HTMLElement | null {
  for (const selector of SIDEBAR_SELECTORS) {
    const nav = document.querySelector(selector) as HTMLElement | null;
    if (nav) {
      return nav.parentElement instanceof HTMLElement ? nav.parentElement : nav;
    }
  }

  const sidebarTestId = document.querySelector('[data-testid="left-sidebar"]');
  if (sidebarTestId instanceof HTMLElement) {
    return sidebarTestId;
  }

  const genericNav = document.querySelector(
    'nav[aria-label*="history" i], nav[aria-label*="recent" i]',
  );
  if (genericNav instanceof HTMLElement) {
    return genericNav.parentElement instanceof HTMLElement ? genericNav.parentElement : genericNav;
  }

  const genericSidebar = document.querySelector('[data-testid*="sidebar" i]');
  if (genericSidebar instanceof HTMLElement) {
    return genericSidebar;
  }

  return null;
}

function ensureHostPlacement(): void {
  if (!activeHost) {
    return;
  }
  const sidebar = findSidebarContainer();
  const fallbackContainer = document.documentElement;

  if (!sidebar) {
    activeHost.setAttribute('data-ai-companion-collapsed', 'true');
    if (fallbackContainer && activeHost.parentElement !== fallbackContainer) {
      fallbackContainer.appendChild(activeHost);
    }
    if (observedSidebar && sidebarResizeObserver) {
      sidebarResizeObserver.unobserve(observedSidebar);
    }
    observedSidebar = null;
    return;
  }

  const rect = sidebar.getBoundingClientRect();
  const collapsed = rect.width < 80 || sidebar.offsetParent === null;

  if (collapsed) {
    activeHost.setAttribute('data-ai-companion-collapsed', 'true');
    if (fallbackContainer && activeHost.parentElement !== fallbackContainer) {
      fallbackContainer.appendChild(activeHost);
    }
  } else {
    activeHost.removeAttribute('data-ai-companion-collapsed');
    if (activeHost.parentElement !== sidebar) {
      sidebar.appendChild(activeHost);
    }
  }

  if (!sidebarResizeObserver) {
    sidebarResizeObserver = new ResizeObserver(() => {
      ensureHostPlacement();
    });
  }

  if (observedSidebar !== sidebar) {
    if (observedSidebar && sidebarResizeObserver) {
      sidebarResizeObserver.unobserve(observedSidebar);
    }

    observedSidebar = sidebar;
    sidebarResizeObserver.observe(sidebar);
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
  const host = document.createElement('div');
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
    :host { all: initial; display: block; width: 100%; }
    :host([data-ai-companion-collapsed="true"]) {
      position: fixed;
      top: 16px;
      right: 16px;
      width: min(20rem, calc(100vw - 32px));
      max-width: calc(100vw - 32px);
      z-index: 2147483646;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }
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

function CompanionOverlay() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeToolbar, setActiveToolbar] = useState<'history' | 'prompts' | 'media'>('history');

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

  return (
    <div className="pointer-events-auto w-full rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-slate-100 shadow-xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">AI Companion</p>
          <h2 className="text-base font-semibold">{toolbarLabel}</h2>
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          Patterns
        </button>
      </header>
      <Tabs defaultValue="history" onChange={(value) => setActiveToolbar(value as typeof activeToolbar)}>
        <TabList className="mb-2 flex gap-2">
          <Tab value="history">History</Tab>
          <Tab value="prompts">Prompts</Tab>
          <Tab value="media">Media</Tab>
        </TabList>
        <TabPanels className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
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
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            onClick={() => setModalOpen(false)}
            type="button"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
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
        <CompanionOverlay />
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
