import assert from 'node:assert/strict';

import {
  createSyncEncryptionService,
  SyncEncryptionInvalidPassphraseError,
  SyncEncryptionLockedError,
  SyncEncryptionNotConfiguredError
} from '@/background/crypto/syncEncryption';

async function run() {
  const fallback = new Map<string, unknown>();
  const service = createSyncEncryptionService({ fallbackStore: fallback });

  const initialStatus = await service.getStatus();
  assert.deepEqual(initialStatus, { configured: false, unlocked: false, iterations: null });

  await service.configure({ passphrase: 'correct horse battery staple' });

  const postConfigureStatus = await service.getStatus();
  assert.equal(postConfigureStatus.configured, true);
  assert.equal(postConfigureStatus.unlocked, true);
  assert.equal(typeof postConfigureStatus.iterations, 'number');

  const envelope = await service.encryptString({ plaintext: 'secret payload' });
  assert.equal(envelope.version, 1);
  assert.notEqual(envelope.data.length, 0);

  const decrypted = await service.decryptToString(envelope);
  assert.equal(decrypted, 'secret payload');

  service.lock();
  const lockedStatus = await service.getStatus();
  assert.equal(lockedStatus.unlocked, false);

  await assert.rejects(() => service.decryptToString(envelope), SyncEncryptionLockedError);

  await service.unlock({ passphrase: 'correct horse battery staple' });
  const unlockedStatus = await service.getStatus();
  assert.equal(unlockedStatus.unlocked, true);

  const decryptedAfterUnlock = await service.decryptToString(envelope);
  assert.equal(decryptedAfterUnlock, 'secret payload');

  service.lock();
  await assert.rejects(() => service.unlock({ passphrase: 'wrong passphrase' }), SyncEncryptionInvalidPassphraseError);

  await service.clear();
  await assert.rejects(() => service.unlock({ passphrase: 'correct horse battery staple' }), SyncEncryptionNotConfiguredError);

  const clearedStatus = await service.getStatus();
  assert.equal(clearedStatus.configured, false);
  assert.equal(clearedStatus.unlocked, false);

  const storedMetadata = fallback.get('ai-companion:sync-encryption:metadata');
  assert.equal(storedMetadata, undefined);

  console.log('✓ sync encryption service proof-of-concept passed');
}

await run();
