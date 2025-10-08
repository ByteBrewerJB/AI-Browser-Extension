import assert from 'node:assert/strict';

import { ensureShadowHost, resetSidebarPlacementForTests } from '@/content/sidebar-host';
import { __resetSettingsStoreForTests } from '@/shared/state/settingsStore';
import {
  __resetSidebarVisibilityStoreForTests,
  initializeSidebarVisibilityStore,
  useSidebarVisibilityStore
} from '@/shared/state/sidebarVisibilityStore';
import { getSidebarSectionDefinitions } from '@/shared/types/sidebar';

import { setupDomEnvironment } from '../utils/domEnvironment';

class ResizeObserverMock implements ResizeObserver {
  constructor(_: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions | undefined): void {}

  unobserve(_target: Element): void {}

  disconnect(): void {}

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

type AsyncTest = [name: string, execute: () => Promise<void>];

function createSidebarEnvironment(language: string) {
  const env = setupDomEnvironment();
  const { document } = env;

  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  Object.defineProperty(globalThis, 'navigator', {
    value: { language },
    configurable: true,
    enumerable: true,
    writable: true
  });

  (globalThis as any).ResizeObserver = ResizeObserverMock;
  (globalThis as any).HTMLElement = (document.createElement('div') as any).constructor;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-testid', 'left-sidebar');
  (wrapper as any).setBoundingRectWidth(240);
  (wrapper as any).offsetParent = wrapper;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Chat history');

  const list = document.createElement('ol');
  nav.appendChild(list);

  wrapper.appendChild(nav);
  document.body.appendChild(wrapper);

  return {
    list,
    cleanup() {
      resetSidebarPlacementForTests();
      env.cleanup();
      delete (globalThis as any).ResizeObserver;
      delete (globalThis as any).HTMLElement;

      if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      } else {
        delete (globalThis as any).navigator;
      }
    }
  };
}

const tests: AsyncTest[] = [
  [
    'updates host data attributes when sidebar preferences change',
    async () => {
      const env = createSidebarEnvironment('en-US');

      try {
        resetSidebarPlacementForTests();
        __resetSettingsStoreForTests();
        __resetSidebarVisibilityStoreForTests();
        await initializeSidebarVisibilityStore();

        const host = await ensureShadowHost();
        assert.equal(host.getAttribute('data-ai-companion-pinned-count'), null);
        assert.equal(host.getAttribute('data-ai-companion-hidden-count'), null);
        assert.equal(host.getAttribute('data-ai-companion-sidebar-empty'), null);

        const store = useSidebarVisibilityStore;
        store.getState().setSectionPinned('history.pinned', true);
        assert.equal(host.getAttribute('data-ai-companion-pinned-count'), '1');

        store.getState().setSectionHidden('history.recent', true);
        assert.equal(host.getAttribute('data-ai-companion-hidden-count'), '1');
        assert.equal(host.getAttribute('data-ai-companion-sidebar-empty'), null);

        for (const definition of getSidebarSectionDefinitions()) {
          store.getState().setSectionHidden(definition.id, true);
        }
        assert.equal(host.getAttribute('data-ai-companion-sidebar-empty'), 'true');

        store.getState().setSectionHidden('history.pinned', false);
        assert.equal(host.getAttribute('data-ai-companion-hidden-count'), String(getSidebarSectionDefinitions().length - 1));
        assert.equal(host.getAttribute('data-ai-companion-sidebar-empty'), null);
      } finally {
        env.cleanup();
      }
    }
  ]
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    try {
      await execute();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`✖ ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();
