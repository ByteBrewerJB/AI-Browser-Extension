import type { ConversationRecord } from '@/core/models';

const STORAGE_KEY = 'ai-companion:snapshot:v1';

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
  version: 1,
  updatedAt: '1970-01-01T00:00:00.000Z'
};

function getSyncArea(): chrome.storage.SyncStorageArea | undefined {
  if (typeof chrome === 'undefined') {
    return undefined;
  }

  return chrome.storage?.sync;
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
        const error = chrome.runtime?.lastError;
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
        const error = chrome.runtime?.lastError;
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
  const result = await storageGet<Record<string, SyncSnapshot>>(STORAGE_KEY);
  if (!result) {
    return { ...emptySnapshot };
  }
  return coerceSnapshot(result[STORAGE_KEY]);
}

export async function writeSyncSnapshot(snapshot: SyncSnapshot): Promise<void> {
  await storageSet({ [STORAGE_KEY]: snapshot });
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
  const sync = getSyncArea();
  if (!sync) {
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
    const snapshot = coerceSnapshot(newValue);
    listeners.forEach((listener) => listener(snapshot));
  });

  initializedListener = true;
}
