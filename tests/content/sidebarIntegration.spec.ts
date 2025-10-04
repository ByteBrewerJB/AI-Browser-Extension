import assert from 'node:assert/strict';

import { ensureHostPlacement, ensureShadowHost, resetSidebarPlacementForTests } from '@/content/sidebar-host';

import { setupDomEnvironment } from '../utils/domEnvironment';

class ResizeObserverMock implements ResizeObserver {
  constructor(_: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions): void {}

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

  (globalThis as any).navigator = { language };
  (globalThis as any).ResizeObserver = ResizeObserverMock;
  (globalThis as any).HTMLElement = (document.createElement('div') as any).constructor;

  resetSidebarPlacementForTests();

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
    setWidth(width: number) {
      (wrapper as any).setBoundingRectWidth(width);
    },
    cleanup() {
      resetSidebarPlacementForTests();
      env.cleanup();
      delete (globalThis as any).ResizeObserver;
      delete (globalThis as any).navigator;
      delete (globalThis as any).HTMLElement;
    }
  };
}

const tests: AsyncTest[] = [
  [
    'keeps the companion host anchored while toggling collapse state',
    async () => {
      const env = createSidebarEnvironment('en-US');

      try {
        const host = await ensureShadowHost();
        assert.equal(host.parentElement, env.list);
        assert.equal(host.getAttribute('data-ai-companion-collapsed'), null);

        env.setWidth(48);
        ensureHostPlacement();
        assert.equal(host.parentElement, env.list);
        assert.equal(host.getAttribute('data-ai-companion-collapsed'), 'true');

        env.setWidth(240);
        ensureHostPlacement();
        assert.equal(host.parentElement, env.list);
        assert.equal(host.hasAttribute('data-ai-companion-collapsed'), false);
      } finally {
        env.cleanup();
      }
    }
  ]
];

const localeExpectations: [locale: string, expected: string][] = [
  ['en-US', 'Boost your ChatGPT productivity.'],
  ['nl-NL', 'Verbeter je ChatGPT-productiviteit.']
];

for (const [locale, expected] of localeExpectations) {
  tests.push([
    `renders localized placeholder text for ${locale}`,
    async () => {
      const env = createSidebarEnvironment(locale);
      try {
        const host = await ensureShadowHost();
        assert.equal(host.textContent, expected);
      } finally {
        env.cleanup();
      }
    }
  ]);
}

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
