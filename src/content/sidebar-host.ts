import { initI18n } from '@/shared/i18n';

const HOST_ID = 'ai-companion-shadow-host';

const SIDEBAR_SELECTORS = [
  'nav[aria-label="Chat history"]',
  'nav[aria-label="Chat History"]',
  'nav[aria-label="ChatGPT history"]',
  'nav[aria-label="Conversation history"]',
  'nav[aria-label="Chatgeschiedenis"]',
  'nav[aria-label="Chathistorie"]',
  'nav[aria-label*="chat history" i]',
  'nav[aria-label*="chatgpt history" i]',
  'nav[aria-label*="conversation history" i]',
  'nav[aria-label*="history" i]',
  'nav[aria-label*="geschiedenis" i]',
  'nav[aria-label*="historie" i]',
  'nav[aria-label*="gesprek" i]',
  '[data-testid="left-sidebar"] nav',
  '[data-testid="left-sidebar"] aside',
  '[data-testid="left-sidebar"]',
  '[data-testid="left_sidebar"]'
];

type SidebarStructure = {
  container: HTMLElement;
  target: HTMLElement;
};

function isElement(value: unknown): value is HTMLElement {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return true;
  }
  return (
    'appendChild' in (value as Record<string, unknown>) &&
    typeof (value as { appendChild: unknown }).appendChild === 'function' &&
    'querySelector' in (value as Record<string, unknown>)
  );
}

let sidebarMutationObserver: MutationObserver | null = null;
let sidebarResizeObserver: ResizeObserver | null = null;
let observedSidebar: HTMLElement | null = null;
let activeHost: HTMLElement | null = null;
let locationWatcher: number | null = null;
let lastKnownHref = typeof window !== 'undefined' ? window.location.href : '';

function findListWithin(root: HTMLElement): HTMLElement | null {
  return (
    (root.querySelector('[role="list"]') as HTMLElement | null) ??
    (root.querySelector('ol') as HTMLElement | null) ??
    (root.querySelector('ul') as HTMLElement | null)
  );
}

function resolveStructureFromNav(nav: HTMLElement): SidebarStructure {
  const parent = nav.parentElement;
  const container =
    nav.hasAttribute('data-testid') || !isElement(parent) ? nav : (parent as HTMLElement);
  const list = findListWithin(nav);
  return { container, target: list ?? nav };
}

function resolveStructureFromContainer(container: HTMLElement): SidebarStructure {
  const nav = container.querySelector('nav');
  if (isElement(nav)) {
    const list = findListWithin(nav);
    return { container, target: list ?? (nav as HTMLElement) };
  }
  const list = findListWithin(container);
  return { container, target: list ?? container };
}

function findSidebarStructure(): SidebarStructure | null {
  for (const selector of SIDEBAR_SELECTORS) {
    const nav = document.querySelector(selector);
    if (isElement(nav)) {
      return resolveStructureFromNav(nav as HTMLElement);
    }
  }

  const sidebarTestId = document.querySelector('[data-testid="left-sidebar"]');
  if (isElement(sidebarTestId)) {
    return resolveStructureFromContainer(sidebarTestId as HTMLElement);
  }

  const genericNav = document.querySelector(
    'nav[aria-label*="history" i], nav[aria-label*="recent" i]'
  );
  if (isElement(genericNav)) {
    return resolveStructureFromNav(genericNav as HTMLElement);
  }

  const genericSidebar = document.querySelector('[data-testid*="sidebar" i]');
  if (isElement(genericSidebar)) {
    return resolveStructureFromContainer(genericSidebar as HTMLElement);
  }

  return null;
}

async function waitForSidebarStructure(): Promise<SidebarStructure> {
  const existing = findSidebarStructure();
  if (existing) {
    return existing;
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const candidate = findSidebarStructure();
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

function shouldConsiderCollapsed(container: HTMLElement, width: number): boolean {
  const offsetParent = (container as HTMLElement & { offsetParent?: Element | null }).offsetParent;
  return width < 80 || offsetParent === null;
}

export function ensureHostPlacement(): void {
  if (!activeHost) {
    return;
  }

  const structure = findSidebarStructure();
  const fallbackContainer = document.documentElement;

  if (!structure) {
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

  const { container, target } = structure;

  if (activeHost.parentElement !== target) {
    target.appendChild(activeHost);
  }

  let width = 999;
  if (typeof container.getBoundingClientRect === 'function') {
    try {
      width = container.getBoundingClientRect().width;
    } catch {
      width = 999;
    }
  }

  const collapsed = shouldConsiderCollapsed(container, width);

  if (collapsed) {
    activeHost.setAttribute('data-ai-companion-collapsed', 'true');
  } else {
    activeHost.removeAttribute('data-ai-companion-collapsed');
  }

  if (!sidebarResizeObserver) {
    sidebarResizeObserver = new ResizeObserver(() => {
      ensureHostPlacement();
    });
  }

  if (observedSidebar !== container) {
    if (observedSidebar && sidebarResizeObserver) {
      sidebarResizeObserver.unobserve(observedSidebar);
    }
    observedSidebar = container;
    sidebarResizeObserver.observe(container);
  }
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
        subtree: true
      });
    }
  }

  if (typeof window !== 'undefined' && locationWatcher === null) {
    locationWatcher = window.setInterval(() => {
      if (lastKnownHref !== window.location.href) {
        lastKnownHref = window.location.href;
        ensureHostPlacement();
      }
    }, 750);
  }
}

export async function ensureShadowHost(): Promise<HTMLElement> {
  const i18nInstance = await initI18n();
  const existing = document.getElementById(HOST_ID);
  const placeholder = i18nInstance.t('app.tagline');

  if (existing) {
    existing.textContent = placeholder;
    initializeSidebarWatchers(existing);
    return existing;
  }

  const { target } = await waitForSidebarStructure();
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.textContent = placeholder;
  target.appendChild(host);
  initializeSidebarWatchers(host);
  return host;
}

export function resetSidebarPlacementForTests() {
  if (sidebarMutationObserver) {
    sidebarMutationObserver.disconnect();
    sidebarMutationObserver = null;
  }

  if (sidebarResizeObserver) {
    sidebarResizeObserver.disconnect();
    sidebarResizeObserver = null;
  }

  if (typeof window !== 'undefined' && locationWatcher !== null) {
    window.clearInterval(locationWatcher);
  }

  locationWatcher = null;
  observedSidebar = null;
  activeHost = null;
  lastKnownHref = typeof window !== 'undefined' ? window.location.href : '';
}

