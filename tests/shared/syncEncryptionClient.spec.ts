import assert from 'node:assert/strict';

import {
  configureSyncEncryption,
  getSyncEncryptionStatus,
  lockSyncEncryption,
  unlockSyncEncryption
} from '../../src/shared/messaging/syncEncryptionClient';

const previousChrome = (globalThis as any).chrome;

interface QueuedResponse {
  value: unknown;
}

const queuedResponses: QueuedResponse[] = [];
const sentMessages: unknown[] = [];

function queueResponse(value: unknown) {
  queuedResponses.push({ value });
}

const runtimeStub = {
  lastError: undefined as chrome.runtime.LastError | undefined,
  sendMessage(message: unknown, callback: (response: unknown) => void) {
    sentMessages.push(message);
    const next = queuedResponses.shift();
    callback(next ? next.value : undefined);
  }
};

(globalThis as any).chrome = {
  runtime: runtimeStub
} as unknown as typeof chrome;

async function run() {
  try {
    queueResponse({ configured: false, unlocked: false, iterations: null });
    const status = await getSyncEncryptionStatus();
    assert.deepEqual(status, { configured: false, unlocked: false, iterations: null });
    assert.deepEqual(sentMessages[0], { type: 'sync/encryption-status', payload: {} });

    queueResponse({ status: 'configured' });
    const configureResult = await configureSyncEncryption('top secret');
    assert.equal(configureResult, 'configured');
    assert.deepEqual(sentMessages[1], {
      type: 'sync/encryption-configure',
      payload: { passphrase: 'top secret' }
    });

    queueResponse({ status: 'invalid' });
    const invalidUnlock = await unlockSyncEncryption('wrong');
    assert.equal(invalidUnlock, 'invalid');
    assert.deepEqual(sentMessages[2], {
      type: 'sync/encryption-unlock',
      payload: { passphrase: 'wrong' }
    });

    queueResponse({ status: 'unlocked' });
    const unlockResult = await unlockSyncEncryption('top secret');
    assert.equal(unlockResult, 'unlocked');

    queueResponse({ status: 'locked' });
    const lockResult = await lockSyncEncryption();
    assert.equal(lockResult, 'locked');
    assert.deepEqual(sentMessages[4], { type: 'sync/encryption-lock', payload: {} });
  } finally {
    (globalThis as any).chrome = previousChrome;
  }
}

await run();
