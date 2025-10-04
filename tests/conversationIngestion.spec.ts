import assert from 'node:assert/strict';

import { setupDomEnvironment } from './utils/domEnvironment';
import { computeTextMetrics, sumTextMetrics } from '@/core/utils/textMetrics';
import type { MessageRecord } from '@/core/models';
import { db, resetDatabase } from '@/core/storage/db';
import type { SyncSnapshot } from '@/core/storage/syncBridge';

interface ChromeStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface ChromeStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeRuntime {
  onMessage: {
    addListener(listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void): void;
  };
  sendMessage(message: unknown, callback?: (response: unknown) => void): Promise<void>;
  lastError?: Error;
}

interface ChromeStorage {
  sync: ChromeStorageArea;
}

interface ChromeLike {
  runtime: ChromeRuntime;
  storage: ChromeStorage;
  storageListeners: Set<(changes: Record<string, ChromeStorageChange>, areaName: string) => void>;
}

type AsyncTest = [name: string, execute: () => Promise<void>];

function createChromeMock(): ChromeLike {
  const storageState: Record<string, unknown> = {};
  const listeners = new Set<(changes: Record<string, ChromeStorageChange>, areaName: string) => void>();

  const sync: ChromeStorageArea = {
    async get(key) {
      return { [key]: storageState[key] };
    },
    async set(items) {
      const changes: Record<string, ChromeStorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: storageState[key], newValue: value };
        storageState[key] = value;
      }
      listeners.forEach((listener) => listener(changes, 'sync'));
    }
  };

  const runtime: ChromeRuntime = {
    onMessage: {
      addListener() {
        // No-op for tests.
      }
    },
    async sendMessage(_message, callback) {
      callback?.({ type: 'pong', receivedAt: new Date().toISOString() });
    },
    lastError: undefined
  };

  return {
    runtime,
    storage: { sync },
    storageListeners: listeners
  };
}

const dom = setupDomEnvironment();
dom.document.readyState = 'complete';
const previousChrome = (globalThis as any).chrome;
const chromeMock = createChromeMock();
Object.defineProperty(globalThis, 'chrome', { value: chromeMock, configurable: true, writable: true });
(globalThis as any).chrome = chromeMock;
const originalSyncSet = chromeMock.storage.sync.set.bind(chromeMock.storage.sync);
chromeMock.storage.sync.set = async (items) => {
  const storage = ((globalThis as any).__chromeStorageState ??= {});
  Object.assign(storage, items);
  await originalSyncSet(items);
};

process.on('uncaughtException', (error) => {
  console.error('[conversation-tests] uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[conversation-tests] unhandledRejection', reason);
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMessageElement({
  document,
  id,
  role,
  content,
  timestamp
}: {
  document: Document;
  id: string;
  role: MessageRecord['role'];
  content: string;
  timestamp: string;
}) {
  const element = document.createElement('div');
  element.setAttribute('data-message-author-role', role);
  element.setAttribute('data-message-id', id);
  element.setAttribute('data-message-timestamp', timestamp);
  element.textContent = content;
  document.body.appendChild(element as unknown as Node);
  return element;
}

let contentScriptImported = false;
async function importContentScript() {
  if (contentScriptImported) {
    return;
  }
  Object.defineProperty(globalThis, 'chrome', { value: chromeMock, configurable: true, writable: true });
  (globalThis as any).chrome = chromeMock;
  await import('@/content/index');
  contentScriptImported = true;
}

async function prepareConversation(id: string, title: string) {
  const document = window.document;

  // Remove previous children to avoid cross-test contamination while keeping the counter alive if present.
  for (const child of [...(document.body.children as unknown as Element[])]) {
    if (child.getAttribute && child.getAttribute('id') === 'ai-companion-word-counter') {
      continue;
    }
    child.remove?.();
  }

  window.history.replaceState({}, '', `https://chat.openai.com/c/${id}`);
  // Allow the location observer to detect the change (polls every 500ms) and schedule a scan.
  await wait(600);

  const header = document.createElement('h1');
  header.textContent = title;
  document.body.appendChild(header as unknown as Node);

  return document;
}

function getSnapshot(): SyncSnapshot | undefined {
  const key = 'ai-companion:snapshot:v1';
  const storage = (globalThis as any).__chromeStorageState as Record<string, unknown> | undefined;
  if (!storage) {
    return undefined;
  }
  return storage[key] as SyncSnapshot | undefined;
}

const tests: AsyncTest[] = [
  [
    'captures system, user, and assistant messages with accurate metrics',
    async () => {
      await resetDatabase();
      (globalThis as any).__chromeStorageState = {};
      await importContentScript();

      const document = await prepareConversation('system-test', 'System run');

      const timestamp = new Date().toISOString();
      const system = 'System notice: do not share secrets.';
      const user = 'User question about test coverage?';
      const assistant = 'Assistant answer summarizing the scenario.';

      createMessageElement({ document, id: 'system-1', role: 'system', content: system, timestamp });
      createMessageElement({ document, id: 'user-1', role: 'user', content: user, timestamp });
      createMessageElement({ document, id: 'assistant-1', role: 'assistant', content: assistant, timestamp });

      await wait(300);

      const metrics = [system, user, assistant].map((text) => computeTextMetrics(text));
      const totals = sumTextMetrics(metrics);

      const conversation = await db.conversations.get('system-test');
      assert.ok(conversation, 'conversation should be stored');
      assert.equal(conversation.wordCount, totals.wordCount);
      assert.equal(conversation.charCount, totals.charCount);

      const messageCount = await db.messages.where('conversationId').equals('system-test').count();
      assert.equal(messageCount, 3);

      const snapshot = getSnapshot();
      assert.ok(snapshot, 'sync snapshot should exist');
      const storedConversation = snapshot!.conversations['system-test'];
      assert.equal(storedConversation.wordCount, totals.wordCount);
      assert.equal(storedConversation.charCount, totals.charCount);
    }
  ],
  [
    'ignores duplicate streaming updates for the same message id',
    async () => {
      await resetDatabase();
      (globalThis as any).__chromeStorageState = {};
      const document = await prepareConversation('stream-test', 'Streaming run');

      const timestamp = new Date().toISOString();
      const user = 'How is the streaming handled?';
      const assistantPartial = 'Streaming chunk one';

      createMessageElement({ document, id: 'user-stream', role: 'user', content: user, timestamp });
      await wait(300);

      const assistantElement = createMessageElement({
        document,
        id: 'assistant-stream',
        role: 'assistant',
        content: assistantPartial,
        timestamp
      });
      await wait(300);

      assistantElement.textContent = `${assistantPartial} with final text`;
      await wait(300);

      const conversation = await db.conversations.get('stream-test');
      assert.ok(conversation, 'conversation should be stored');

      const messages = await db.messages.where('conversationId').equals('stream-test').toArray();
      const expected = sumTextMetrics([computeTextMetrics(user), computeTextMetrics(assistantPartial)]);
      assert.equal(conversation.wordCount, expected.wordCount);
      assert.equal(conversation.charCount, expected.charCount);
      assert.equal(messages.length, 2);
      const assistantMessage = messages.find((message) => message.id === 'assistant-stream');
      assert.ok(assistantMessage);
      assert.equal(assistantMessage!.content, assistantPartial);
    }
  ],
  [
    'deduplicates identical message ids rendered twice',
    async () => {
      await resetDatabase();
      (globalThis as any).__chromeStorageState = {};
      const document = await prepareConversation('duplicate-test', 'Duplicate run');

      const timestamp = new Date().toISOString();
      const duplicateContent = 'Assistant response repeated twice.';

      createMessageElement({
        document,
        id: 'dup-message',
        role: 'assistant',
        content: duplicateContent,
        timestamp
      });
      await wait(300);
      createMessageElement({
        document,
        id: 'dup-message',
        role: 'assistant',
        content: duplicateContent,
        timestamp
      });
      await wait(300);

      const conversation = await db.conversations.get('duplicate-test');
      assert.ok(conversation);

      const messages = await db.messages.where('conversationId').equals('duplicate-test').toArray();
      const expected = computeTextMetrics(duplicateContent);
      assert.equal(conversation.wordCount, expected.wordCount);
      assert.equal(conversation.charCount, expected.charCount);
      assert.equal(messages.length, 1);
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

if (previousChrome === undefined) {
  delete (globalThis as any).chrome;
} else {
  (globalThis as any).chrome = previousChrome;
}
