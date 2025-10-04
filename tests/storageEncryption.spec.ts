import assert from 'node:assert/strict';

import { db, ENCRYPTION_METADATA_KEY, ENCRYPTION_DATA_VERSION, resetDatabase } from '@/core/storage/db';
import type { SyncSnapshot } from '@/core/storage/syncBridge';
import { StorageService } from '@/core/storage/service';

type AsyncTest = [name: string, execute: () => Promise<void>];

const baseSnapshot: SyncSnapshot = {
  conversations: {},
  version: 2,
  updatedAt: '1970-01-01T00:00:00.000Z'
};

const tests: AsyncTest[] = [
  [
    'encrypts and decrypts payloads symmetrically',
    async () => {
      await resetDatabase();
      const previousChrome = (globalThis as any).chrome;
      // Ensure the storage service uses the in-memory fallbacks rather than a shared Chrome mock.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as any).chrome;
      try {
        const syncFallback = new Map<string, unknown>();
        const localFallback = new Map<string, unknown>();
        const service = new StorageService(db, { syncFallback, localFallback });

        const snapshot: SyncSnapshot = {
          conversations: {
            example: {
              id: 'example',
              updatedAt: '2024-01-01T00:00:00.000Z',
              wordCount: 10,
              charCount: 42,
              pinned: true
            }
          },
          version: 2,
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        await service.writeEncrypted('test:key', snapshot, { payloadVersion: 2, quotaBytes: 2048 });

        const storedEnvelope = syncFallback.get('test:key') as Record<string, unknown> | undefined;
        assert.ok(storedEnvelope, 'ciphertext stored in sync fallback');
        assert.notDeepEqual(storedEnvelope, snapshot);
        assert.equal(storedEnvelope?.encryptionVersion, ENCRYPTION_DATA_VERSION);

        const result = await service.readEncrypted('test:key', {
          fallback: baseSnapshot,
          expectedVersion: 2,
          upgrade: (payload) => payload as SyncSnapshot
        });

        assert.deepEqual(result, snapshot);
      } finally {
        if (previousChrome !== undefined) {
          (globalThis as any).chrome = previousChrome;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete (globalThis as any).chrome;
        }
      }
    }
  ],
  [
    'initializes encryption metadata on first open',
    async () => {
      await resetDatabase();
      const previousChrome = (globalThis as any).chrome;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as any).chrome;
      try {
        const service = new StorageService(db, { syncFallback: new Map(), localFallback: new Map() });

        const before = await db.metadata.get(ENCRYPTION_METADATA_KEY);
        assert.equal(before, undefined);

        const metadata = await service.readEncryptionMetadata();
        assert.equal(metadata.pending, true);

        const stored = await db.metadata.get(ENCRYPTION_METADATA_KEY);
        assert.ok(stored);
        assert.deepEqual(stored?.value, metadata);
      } finally {
        if (previousChrome !== undefined) {
          (globalThis as any).chrome = previousChrome;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete (globalThis as any).chrome;
        }
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
