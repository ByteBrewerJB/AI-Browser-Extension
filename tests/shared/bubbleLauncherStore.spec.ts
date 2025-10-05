import assert from 'node:assert/strict';

import {
  __resetBubbleLauncherStoreForTests,
  initializeBubbleLauncherStore,
  useBubbleLauncherStore
} from '@/shared/state/bubbleLauncherStore';

const STORAGE_KEY = 'ai-companion:bubble-launcher:v1';

interface ChromeStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

type ChromeStorageListener = (changes: Record<string, ChromeStorageChange>, areaName: string) => void;

function createChromeMock() {
  const storageState: Record<string, unknown> = {};
  const listeners = new Set<ChromeStorageListener>();

  const local = {
    async get(key: string) {
      return { [key]: storageState[key] };
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, ChromeStorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: storageState[key], newValue: value };
        storageState[key] = value;
      }
      listeners.forEach((listener) => listener(changes, 'local'));
    }
  } as unknown as chrome.storage.StorageArea;

  const storage = {
    local,
    onChanged: {
      addListener(listener: ChromeStorageListener) {
        listeners.add(listener);
      },
      removeListener(listener: ChromeStorageListener) {
        listeners.delete(listener);
      }
    }
  } as unknown as typeof chrome.storage;

  const chromeMock: any = {
    storage,
    runtime: { lastError: undefined },
    __storageState: storageState
  };

  return chromeMock;
}

const previousChrome = (globalThis as any).chrome;
const chromeMock: any = createChromeMock();
Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  writable: true,
  value: chromeMock
});

type AsyncTest = [name: string, execute: () => Promise<void>];

async function runAfterPersist() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const tests: AsyncTest[] = [
  [
    'hydrates folder shortcuts from chrome.storage.local',
    async () => {
      chromeMock.__storageState[STORAGE_KEY] = {
        conversationFolderShortcuts: [
          { id: 'folder-1', name: 'First', depth: 0, favorite: true },
          { id: 'folder-2', name: 'Nested', depth: 1, favorite: false }
        ]
      };

      await initializeBubbleLauncherStore();

      const state = useBubbleLauncherStore.getState();
      assert.equal(state.hydrated, true);
      assert.deepEqual(state.conversationFolderShortcuts, [
        { id: 'folder-1', name: 'First', depth: 0, favorite: true },
        { id: 'folder-2', name: 'Nested', depth: 1, favorite: false }
      ]);
    }
  ],
  [
    'persists folder shortcuts when updated',
    async () => {
      delete chromeMock.__storageState[STORAGE_KEY];

      await initializeBubbleLauncherStore();

      useBubbleLauncherStore
        .getState()
        .setConversationFolderShortcuts([
          { id: 'folder-1', name: 'First', depth: 0, favorite: true }
        ]);

      await runAfterPersist();

      assert.deepEqual(chromeMock.__storageState[STORAGE_KEY], {
        conversationFolderShortcuts: [{ id: 'folder-1', name: 'First', depth: 0, favorite: true }]
      });
    }
  ],
  [
    'applies external chrome.storage updates to the cache',
    async () => {
      chromeMock.__storageState[STORAGE_KEY] = {
        conversationFolderShortcuts: [{ id: 'folder-1', name: 'Initial', depth: 0, favorite: false }]
      };

      await initializeBubbleLauncherStore();

      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          conversationFolderShortcuts: [
            { id: 'folder-1', name: 'Initial', depth: 0, favorite: true },
            { id: 'folder-2', name: 'Second', depth: 1, favorite: false }
          ]
        }
      });

      await runAfterPersist();

      const state = useBubbleLauncherStore.getState();
      assert.deepEqual(state.conversationFolderShortcuts, [
        { id: 'folder-1', name: 'Initial', depth: 0, favorite: true },
        { id: 'folder-2', name: 'Second', depth: 1, favorite: false }
      ]);
    }
  ]
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    __resetBubbleLauncherStoreForTests();
    try {
      await execute();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`✖ ${name}`);
      console.error(error);
    }
  }

  __resetBubbleLauncherStoreForTests();

  if (previousChrome === undefined) {
    delete (globalThis as any).chrome;
  } else {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: previousChrome
    });
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();
