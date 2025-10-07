import assert from 'node:assert/strict';

import {
  configureSyncEncryption,
  getSyncEncryptionStatus,
  lockSyncEncryption,
  unlockSyncEncryption
} from '../../src/shared/messaging/syncEncryptionClient';
import { syncEncryptionBridge } from '../../src/core/storage/syncEncryptionBridge';

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
    queueResponse({ configured: true, unlocked: true, iterations: 300000 });
    const configureResult = await configureSyncEncryption('top secret');
    assert.equal(configureResult, 'configured');
    assert.deepEqual(sentMessages[1], {
      type: 'sync/encryption-configure',
      payload: { passphrase: 'top secret' }
    });
    assert.deepEqual(sentMessages[2], { type: 'sync/encryption-status', payload: {} });

    queueResponse({ status: 'invalid' });
    const invalidUnlock = await unlockSyncEncryption('wrong');
    assert.equal(invalidUnlock, 'invalid');
    assert.deepEqual(sentMessages[3], {
      type: 'sync/encryption-unlock',
      payload: { passphrase: 'wrong' }
    });

    queueResponse({ status: 'unlocked' });
    queueResponse({ configured: true, unlocked: true, iterations: 300000 });
    const unlockResult = await unlockSyncEncryption('top secret');
    assert.equal(unlockResult, 'unlocked');
    assert.deepEqual(sentMessages[4], {
      type: 'sync/encryption-unlock',
      payload: { passphrase: 'top secret' }
    });
    assert.deepEqual(sentMessages[5], { type: 'sync/encryption-status', payload: {} });

    queueResponse({ status: 'locked' });
    queueResponse({ configured: true, unlocked: false, iterations: 300000 });
    const lockResult = await lockSyncEncryption();
    assert.equal(lockResult, 'locked');
    assert.deepEqual(sentMessages[6], { type: 'sync/encryption-lock', payload: {} });
    assert.deepEqual(sentMessages[7], { type: 'sync/encryption-status', payload: {} });
  } finally {
    syncEncryptionBridge.reset();
    (globalThis as any).chrome = previousChrome;
  }
}

await run();
