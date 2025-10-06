import { storageService } from './service';
import { SyncEncryptionBridgeLockedError, SyncEncryptionBridgeUnavailableError } from './syncEncryptionBridge';
import type { ConversationRecord } from '@/core/models';

const STORAGE_KEY = 'ai-companion:snapshot:v2';
const LEGACY_STORAGE_KEY = 'ai-companion:snapshot:v1';
const SNAPSHOT_PAYLOAD_VERSION = 2;
const SYNC_SNAPSHOT_QUOTA_BYTES = 80 * 1024; // Reserve buffer below Chrome's 100KB per-item cap.

export interface SyncConversationMetadata {
  id: string;
  updatedAt: string;
  wordCount: number;
  charCount: number;
  folderId?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface SyncSnapshot {
  conversations: Record<string, SyncConversationMetadata>;
  version: number;
  updatedAt: string;
}

const emptySnapshot: SyncSnapshot = {
  conversations: {},
  version: SNAPSHOT_PAYLOAD_VERSION,
  updatedAt: '1970-01-01T00:00:00.000Z'
};

export class SyncSnapshotLockedError extends Error {
  constructor() {
    super('Sync snapshot encryption is locked.');
    this.name = 'SyncSnapshotLockedError';
  }
}

export class SyncSnapshotUnavailableError extends Error {
  constructor() {
    super('Sync snapshot encryption is unavailable.');
    this.name = 'SyncSnapshotUnavailableError';
  }
}

function getChromeApi() {
  return (globalThis as unknown as { chrome?: typeof chrome }).chrome;
}

function getSyncArea(): chrome.storage.SyncStorageArea | undefined {
  const chromeApi = getChromeApi();
  const sync = chromeApi?.storage?.sync;
  return sync;
}

async function storageGet<T>(key: string): Promise<T | undefined> {
  const sync = getSyncArea();
  if (!sync) {
    return undefined;
  }

  if ('get' in sync && sync.get.length === 1) {
    // MV3 promise-based API
    return (sync.get as (keys: string) => Promise<T>)(key);
  }

  return new Promise<T | undefined>((resolve, reject) => {
    try {
      sync.get(key, (result) => {
        const error = getChromeApi()?.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(result as T);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function storageSet<T extends object>(items: T): Promise<void> {
  const sync = getSyncArea();
  if (!sync) {
    return;
  }

  if ('set' in sync && sync.set.length === 1) {
    await (sync.set as (items: T) => Promise<void>)(items);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      sync.set(items, () => {
        const error = getChromeApi()?.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function coerceSnapshot(raw: unknown): SyncSnapshot {
  if (!raw || typeof raw !== 'object') {
    return { ...emptySnapshot };
  }

  const snapshot = raw as Partial<SyncSnapshot>;
  return {
    conversations: snapshot.conversations ?? {},
    version: snapshot.version ?? emptySnapshot.version,
    updatedAt: snapshot.updatedAt ?? emptySnapshot.updatedAt
  };
}

export async function readSyncSnapshot(): Promise<SyncSnapshot> {
  let snapshot: SyncSnapshot;
  try {
    snapshot = await storageService.readEncrypted(STORAGE_KEY, {
      fallback: { ...emptySnapshot },
      expectedVersion: SNAPSHOT_PAYLOAD_VERSION,
      upgrade: (payload) => coerceSnapshot(payload)
    });
  } catch (error) {
    if (error instanceof SyncEncryptionBridgeLockedError) {
      throw new SyncSnapshotLockedError();
    }
    if (error instanceof SyncEncryptionBridgeUnavailableError) {
      throw new SyncSnapshotUnavailableError();
    }
    throw error;
  }

  if (Object.keys(snapshot.conversations).length === 0 && snapshot.updatedAt === emptySnapshot.updatedAt) {
    const legacy = await readLegacySnapshot();
    if (legacy) {
      const migrated = { ...coerceSnapshot(legacy), version: SNAPSHOT_PAYLOAD_VERSION };
      await writeSyncSnapshot(migrated);
      await removeLegacySnapshot();
      return migrated;
    }
  }

  return snapshot;
}

export async function writeSyncSnapshot(snapshot: SyncSnapshot): Promise<void> {
  try {
    await storageService.writeEncrypted(STORAGE_KEY, snapshot, {
      payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
      quotaBytes: SYNC_SNAPSHOT_QUOTA_BYTES
    });
  } catch (error) {
    if (error instanceof SyncEncryptionBridgeLockedError) {
      throw new SyncSnapshotLockedError();
    }
    if (error instanceof SyncEncryptionBridgeUnavailableError) {
      throw new SyncSnapshotUnavailableError();
    }
    throw error;
  }
}

export async function syncConversationMetadata(conversation: ConversationRecord): Promise<void> {
  try {
    const snapshot = await readSyncSnapshot();
    snapshot.conversations[conversation.id] = {
      id: conversation.id,
      updatedAt: conversation.updatedAt,
      wordCount: conversation.wordCount,
      charCount: conversation.charCount,
      folderId: conversation.folderId,
      pinned: conversation.pinned,
      archived: conversation.archived
    };
    snapshot.updatedAt = new Date().toISOString();
    await writeSyncSnapshot(snapshot);
  } catch (error) {
    if (error instanceof SyncSnapshotLockedError || error instanceof SyncSnapshotUnavailableError) {
      console.warn('[syncBridge] Skipping conversation metadata sync; encryption unavailable.', error);
      return;
    }
    throw error;
  }
}

export async function removeConversationMetadata(conversationId: string): Promise<void> {
  try {
    const snapshot = await readSyncSnapshot();
    delete snapshot.conversations[conversationId];
    snapshot.updatedAt = new Date().toISOString();
    await writeSyncSnapshot(snapshot);
  } catch (error) {
    if (error instanceof SyncSnapshotLockedError || error instanceof SyncSnapshotUnavailableError) {
      console.warn('[syncBridge] Skipping conversation metadata removal; encryption unavailable.', error);
      return;
    }
    throw error;
  }
}

export type SyncChangeListener = (snapshot: SyncSnapshot) => void;

const listeners = new Set<SyncChangeListener>();
let initializedListener = false;

export function subscribeToSyncChanges(listener: SyncChangeListener) {
  listeners.add(listener);
  ensureChangeListener();
  return () => listeners.delete(listener);
}

function ensureChangeListener() {
  if (initializedListener) {
    return;
  }
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return;
  }

  const chromeApi = getChromeApi();
  chromeApi?.storage?.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }
    if (!changes[STORAGE_KEY]) {
      return;
    }
    const newValue = changes[STORAGE_KEY].newValue;
    storageService
      .decodeEnvelope(newValue, STORAGE_KEY, {
        fallback: { ...emptySnapshot },
        expectedVersion: SNAPSHOT_PAYLOAD_VERSION,
        upgrade: (payload) => coerceSnapshot(payload)
      })
      .then((snapshot) => {
        listeners.forEach((listener) => listener(snapshot));
      })
      .catch((error) => {
        console.warn('[syncBridge] Failed to decode snapshot change', error);
      });
  });

  initializedListener = true;
}

async function readLegacySnapshot(): Promise<SyncSnapshot | undefined> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return undefined;
  }

  const sync = chrome.storage.sync;
  try {
    if ('get' in sync && sync.get.length === 1) {
      const result = await (sync.get as (key: string) => Promise<Record<string, SyncSnapshot>>)(LEGACY_STORAGE_KEY);
      return result?.[LEGACY_STORAGE_KEY];
    }

    return await new Promise<SyncSnapshot | undefined>((resolve, reject) => {
      sync.get(LEGACY_STORAGE_KEY, (result) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve((result as Record<string, SyncSnapshot>)?.[LEGACY_STORAGE_KEY]);
      });
    });
  } catch (error) {
    console.warn('[syncBridge] Failed to read legacy snapshot', error);
    return undefined;
  }
}

async function removeLegacySnapshot() {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return;
  }

  const sync = chrome.storage.sync;
  try {
    if ('remove' in sync && sync.remove.length === 1) {
      await (sync.remove as (key: string) => Promise<void>)(LEGACY_STORAGE_KEY);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      sync.remove(LEGACY_STORAGE_KEY, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  } catch (error) {
    console.warn('[syncBridge] Failed to remove legacy snapshot', error);
  }
}
