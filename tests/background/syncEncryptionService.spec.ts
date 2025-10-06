import assert from 'node:assert/strict';

import {
  createSyncEncryptionService,
  SyncEncryptionInvalidPassphraseError,
  SyncEncryptionLockedError,
  SyncEncryptionNotConfiguredError
} from '@/background/crypto/syncEncryption';
import type { SyncEncryptionStatusChange } from '@/shared/types/syncEncryption';

async function run() {
  const fallback = new Map<string, unknown>();
  const service = createSyncEncryptionService({ fallbackStore: fallback });
  const events: SyncEncryptionStatusChange[] = [];
  const unsubscribe = service.onStatusChange((change) => {
    events.push(change);
  });

  try {
    const initialStatus = await service.getStatus();
    assert.deepEqual(initialStatus, { configured: false, unlocked: false, iterations: null });

    await service.configure({ passphrase: 'correct horse battery staple' });

    assert.equal(events[0]?.reason, 'configured');
    assert.equal(events[0]?.status.configured, true);
    assert.equal(events[0]?.status.unlocked, true);

    const postConfigureStatus = await service.getStatus();
    assert.equal(postConfigureStatus.configured, true);
    assert.equal(postConfigureStatus.unlocked, true);
    assert.equal(typeof postConfigureStatus.iterations, 'number');

    const envelope = await service.encryptString({ plaintext: 'secret payload' });
    assert.equal(envelope.version, 1);
    assert.notEqual(envelope.data.length, 0);

    const decrypted = await service.decryptToString(envelope);
    assert.equal(decrypted, 'secret payload');

    await service.lock();
    const lockedStatus = await service.getStatus();
    assert.equal(lockedStatus.unlocked, false);
    assert.equal(events[1]?.reason, 'locked');
    assert.equal(events[1]?.status.unlocked, false);

    await assert.rejects(() => service.decryptToString(envelope), SyncEncryptionLockedError);

    await service.unlock({ passphrase: 'correct horse battery staple' });
    const unlockedStatus = await service.getStatus();
    assert.equal(unlockedStatus.unlocked, true);
    assert.equal(events[2]?.reason, 'unlocked');
    assert.equal(events[2]?.status.unlocked, true);

    const decryptedAfterUnlock = await service.decryptToString(envelope);
    assert.equal(decryptedAfterUnlock, 'secret payload');

    await service.lock();
    await assert.rejects(() => service.unlock({ passphrase: 'wrong passphrase' }), SyncEncryptionInvalidPassphraseError);

    await service.clear();
    await assert.rejects(() => service.unlock({ passphrase: 'correct horse battery staple' }), SyncEncryptionNotConfiguredError);

    const clearedStatus = await service.getStatus();
    assert.equal(clearedStatus.configured, false);
    assert.equal(clearedStatus.unlocked, false);
    assert.equal(events[3]?.reason, 'locked');
    assert.equal(events[4]?.reason, 'cleared');
    assert.equal(events[4]?.status.configured, false);
    assert.equal(events[4]?.status.unlocked, false);

    const storedMetadata = fallback.get('ai-companion:sync-encryption:metadata');
    assert.equal(storedMetadata, undefined);

    console.log('✓ sync encryption service proof-of-concept passed');
  } finally {
    unsubscribe();
  }
}

await run();
