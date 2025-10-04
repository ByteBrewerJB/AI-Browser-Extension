import { storageService } from './service';
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
  const snapshot = await storageService.readEncrypted(STORAGE_KEY, {
    fallback: { ...emptySnapshot },
    expectedVersion: SNAPSHOT_PAYLOAD_VERSION,
    upgrade: (payload) => coerceSnapshot(payload)
  });

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
  await storageService.writeEncrypted(STORAGE_KEY, snapshot, {
    payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
    quotaBytes: SYNC_SNAPSHOT_QUOTA_BYTES
  });
}

export async function syncConversationMetadata(conversation: ConversationRecord): Promise<void> {
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
}

export async function removeConversationMetadata(conversationId: string): Promise<void> {
  const snapshot = await readSyncSnapshot();
  delete snapshot.conversations[conversationId];
  snapshot.updatedAt = new Date().toISOString();
  await writeSyncSnapshot(snapshot);
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
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
