import { db, ENCRYPTION_DATA_VERSION, ENCRYPTION_METADATA_KEY, type CompanionDatabase, type EncryptionMetadataValue, type MetadataRecord } from './db';
import { syncEncryptionBridge, SyncEncryptionBridgeLockedError, SyncEncryptionBridgeUnavailableError, type SyncEncryptionBridge } from './syncEncryptionBridge';
import type { SyncEncryptionEnvelope, SyncEncryptionStatus } from '@/shared/types/syncEncryption';

const DEFAULT_SYNC_QUOTA_BYTES = 100 * 1024; // 100KB, Chrome documented limit per item.
const ENCRYPTION_KEY_STORAGE_KEY = 'ai-companion:encryption:key';
const DEFAULT_ENCRYPTION_CONTEXT = 'ai-companion';

export interface LocalEncryptedEnvelope<TVersion extends number = number> {
  encryptionVersion: number;
  payloadVersion: TVersion;
  iv: string;
  salt: string;
  data: string;
  mode?: 'local';
}

export interface DelegatedEncryptedEnvelope<TVersion extends number = number> {
  encryptionVersion: number;
  payloadVersion: TVersion;
  mode: 'delegated';
  envelope: SyncEncryptionEnvelope;
}

export type EncryptedEnvelope<TVersion extends number = number> =
  | LocalEncryptedEnvelope<TVersion>
  | DelegatedEncryptedEnvelope<TVersion>;

export interface ReadEncryptedOptions<T> {
  fallback: T;
  expectedVersion: number;
  upgrade?: (payload: unknown, version: number) => T;
}

export interface WriteEncryptedOptions<TVersion extends number = number> {
  payloadVersion: TVersion;
  quotaBytes?: number;
}

function getChromeStorageArea(area: 'sync' | 'local'): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined') {
    return undefined;
  }

  return chrome.storage?.[area];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64')).buffer;
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return globalThis.crypto;
}

async function storageGet(area: 'sync' | 'local', key: string, fallbackStore: Map<string, unknown>) {
  const storage = getChromeStorageArea(area);
  if (!storage) {
    if (!fallbackStore.has(key)) {
      return undefined;
    }
    return { [key]: fallbackStore.get(key) } as Record<string, unknown>;
  }

  if ('get' in storage && storage.get.length === 1) {
    return (storage.get as (keys: string) => Promise<Record<string, unknown>>)(key);
  }

  return new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
    try {
      storage.get(key, (result) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function storageSet(area: 'sync' | 'local', items: Record<string, unknown>, fallbackStore: Map<string, unknown>) {
  const storage = getChromeStorageArea(area);
  if (!storage) {
    Object.entries(items).forEach(([key, value]) => {
      fallbackStore.set(key, value);
    });
    return;
  }

  if ('set' in storage && storage.set.length === 1) {
    await (storage.set as (items: Record<string, unknown>) => Promise<void>)(items);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      storage.set(items, () => {
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

async function storageRemove(area: 'sync' | 'local', keys: string, fallbackStore: Map<string, unknown>) {
  const storage = getChromeStorageArea(area);
  if (!storage) {
    fallbackStore.delete(keys);
    return;
  }

  if ('remove' in storage && storage.remove.length === 1) {
    await (storage.remove as (keys: string) => Promise<void>)(keys);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      storage.remove(keys, () => {
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

type StorageEncryptionBridge = Pick<SyncEncryptionBridge, 'getStatus' | 'encrypt' | 'decrypt' | 'reset'>;

export class StorageService {
  private encryptionKeyPromise: Promise<CryptoKey> | null = null;

  private readonly syncFallback: Map<string, unknown>;

  private readonly localFallback: Map<string, unknown>;

  private readonly encryptionBridge: StorageEncryptionBridge;

  constructor(
    private readonly database: CompanionDatabase,
    options?: {
      syncFallback?: Map<string, unknown>;
      localFallback?: Map<string, unknown>;
      encryptionBridge?: StorageEncryptionBridge;
    }
  ) {
    this.syncFallback = options?.syncFallback ?? new Map();
    this.localFallback = options?.localFallback ?? new Map();
    this.encryptionBridge = options?.encryptionBridge ?? syncEncryptionBridge;
  }

  resetForTests() {
    this.encryptionKeyPromise = null;
    this.syncFallback.clear();
    this.localFallback.clear();
    this.encryptionBridge.reset();
  }

  async readEncryptionMetadata(): Promise<EncryptionMetadataValue> {
    const existing = await this.database.metadata.get(ENCRYPTION_METADATA_KEY);
    if (!existing) {
      const now = new Date().toISOString();
      const record: MetadataRecord<EncryptionMetadataValue> = {
        key: ENCRYPTION_METADATA_KEY,
        value: {
          schemaVersion: 3,
          dataVersion: 0,
          pending: true
        },
        updatedAt: now
      };
      await this.database.metadata.put(record);
      return record.value;
    }
    return existing.value as EncryptionMetadataValue;
  }

  async updateEncryptionMetadata(partial: Partial<EncryptionMetadataValue>) {
    const current = await this.readEncryptionMetadata();
    const now = new Date().toISOString();
    const next: EncryptionMetadataValue = {
      schemaVersion: Math.max(partial.schemaVersion ?? current.schemaVersion, current.schemaVersion),
      dataVersion: partial.dataVersion ?? current.dataVersion,
      lastMigrationAt: partial.lastMigrationAt ?? current.lastMigrationAt,
      pending: partial.pending ?? current.pending
    };

    const record: MetadataRecord<EncryptionMetadataValue> = {
      key: ENCRYPTION_METADATA_KEY,
      value: next,
      updatedAt: now
    };
    await this.database.metadata.put(record);
  }

  async readEncrypted<T>(key: string, options: ReadEncryptedOptions<T>): Promise<T> {
    const raw = await storageGet('sync', key, this.syncFallback);
    const envelope = raw?.[key] as EncryptedEnvelope | undefined;
    if (!envelope) {
      return options.fallback;
    }

    const decrypted = await this.decryptStoredEnvelope(envelope, `${DEFAULT_ENCRYPTION_CONTEXT}:${key}`);
    if (envelope.payloadVersion === options.expectedVersion) {
      return decrypted as T;
    }

    if (options.upgrade) {
      return options.upgrade(decrypted, envelope.payloadVersion);
    }

    return options.fallback;
  }

  async writeEncrypted<T>(key: string, value: T, options: WriteEncryptedOptions): Promise<void> {
    const context = `${DEFAULT_ENCRYPTION_CONTEXT}:${key}`;
    const delegatedEnvelope = await this.tryEncryptWithSyncService(value, {
      payloadVersion: options.payloadVersion,
      context
    });

    const envelope = delegatedEnvelope ?? (await this.encryptWithLocalKey(value, {
      payloadVersion: options.payloadVersion,
      context
    }));

    const serialized = JSON.stringify({ [key]: envelope });
    const quota = options.quotaBytes ?? DEFAULT_SYNC_QUOTA_BYTES;
    if (new TextEncoder().encode(serialized).byteLength > quota) {
      throw new Error(`Sync payload for ${key} exceeds quota (${quota} bytes).`);
    }

    await storageSet('sync', { [key]: envelope }, this.syncFallback);
  }

  async removeEncrypted(key: string): Promise<void> {
    await storageRemove('sync', key, this.syncFallback);
  }

  async decodeEnvelope<T>(input: unknown, key: string, options: ReadEncryptedOptions<T>): Promise<T> {
    const envelope = input as EncryptedEnvelope | undefined;
    if (!envelope) {
      return options.fallback;
    }

    const decrypted = await this.decryptStoredEnvelope(envelope, `${DEFAULT_ENCRYPTION_CONTEXT}:${key}`);
    if (envelope.payloadVersion === options.expectedVersion) {
      return decrypted as T;
    }

    if (options.upgrade) {
      return options.upgrade(decrypted, envelope.payloadVersion);
    }

    return options.fallback;
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    if (!this.encryptionKeyPromise) {
      this.encryptionKeyPromise = this.loadOrCreateKey();
    }
    return this.encryptionKeyPromise;
  }

  private async loadOrCreateKey(): Promise<CryptoKey> {
    const stored = await this.readLocal<string>(ENCRYPTION_KEY_STORAGE_KEY);
    if (stored) {
      try {
        return this.importKey(base64ToArrayBuffer(stored));
      } catch (error) {
        console.warn('[storageService] failed to decode stored encryption key. Regenerating.', error);
        await storageRemove('local', ENCRYPTION_KEY_STORAGE_KEY, this.localFallback);
      }
    }

    const crypto = getCrypto();
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', key);
    await this.writeLocal(ENCRYPTION_KEY_STORAGE_KEY, arrayBufferToBase64(exported));
    return key;
  }

  private async readLocal<T>(key: string): Promise<T | undefined> {
    const raw = await storageGet('local', key, this.localFallback);
    if (!raw) {
      return undefined;
    }
    return (raw[key] as T | undefined) ?? (raw as unknown as T);
  }

  private async writeLocal(key: string, value: unknown) {
    await storageSet('local', { [key]: value }, this.localFallback);
  }

  private async tryEncryptWithSyncService(
    value: unknown,
    options: { context: string; payloadVersion: number }
  ): Promise<DelegatedEncryptedEnvelope | null> {
    let status: SyncEncryptionStatus;
    try {
      status = await this.encryptionBridge.getStatus();
    } catch (error) {
      console.warn('[storageService] Failed to obtain sync encryption status; falling back to local key.', error);
      return null;
    }

    if (!status.configured) {
      return null;
    }

    if (!status.unlocked) {
      throw new SyncEncryptionBridgeLockedError();
    }

    try {
      const plaintext = JSON.stringify({ value, context: options.context });
      const envelope = await this.encryptionBridge.encrypt(plaintext);
      return {
        encryptionVersion: ENCRYPTION_DATA_VERSION,
        payloadVersion: options.payloadVersion,
        mode: 'delegated',
        envelope
      };
    } catch (error) {
      if (error instanceof SyncEncryptionBridgeLockedError) {
        throw error;
      }
      if (error instanceof SyncEncryptionBridgeUnavailableError) {
        console.warn('[storageService] Sync encryption unavailable; falling back to local key.', error);
        return null;
      }
      throw error;
    }
  }

  private async encryptWithLocalKey(
    value: unknown,
    options: { context: string; payloadVersion: number }
  ): Promise<LocalEncryptedEnvelope> {
    const crypto = getCrypto();
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify({ value, context: options.context, salt: Array.from(salt) }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    return {
      encryptionVersion: ENCRYPTION_DATA_VERSION,
      payloadVersion: options.payloadVersion,
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer),
      data: arrayBufferToBase64(ciphertext),
      mode: 'local'
    };
  }

  private async decryptStoredEnvelope(envelope: EncryptedEnvelope, context: string): Promise<unknown> {
    if (envelope.mode === 'delegated') {
      return this.decryptDelegatedEnvelope(envelope, context);
    }
    return this.decryptLocalEnvelope(envelope, context);
  }

  private async decryptLocalEnvelope(envelope: LocalEncryptedEnvelope, context: string): Promise<unknown> {
    if (envelope.encryptionVersion !== ENCRYPTION_DATA_VERSION) {
      throw new Error(`Unsupported encryption version: ${envelope.encryptionVersion}`);
    }

    const crypto = getCrypto();
    const key = await this.getEncryptionKey();
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    const ciphertext = base64ToArrayBuffer(envelope.data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const decoded = JSON.parse(new TextDecoder().decode(decrypted)) as { value: unknown; context: string; salt: number[] };

    if (!decoded || decoded.context !== context) {
      throw new Error('Decryption context mismatch.');
    }

    return decoded.value;
  }

  private async decryptDelegatedEnvelope(envelope: DelegatedEncryptedEnvelope, context: string): Promise<unknown> {
    try {
      const plaintext = await this.encryptionBridge.decrypt(envelope.envelope);
      const decoded = JSON.parse(plaintext) as { value: unknown; context: string };
      if (!decoded || decoded.context !== context) {
        throw new Error('Decryption context mismatch.');
      }
      return decoded.value;
    } catch (error) {
      if (error instanceof SyncEncryptionBridgeLockedError || error instanceof SyncEncryptionBridgeUnavailableError) {
        throw error;
      }
      throw new Error('Failed to decrypt delegated sync envelope.');
    }
  }

  private async importKey(raw: ArrayBuffer): Promise<CryptoKey> {
    const crypto = getCrypto();
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
}

export const storageService = new StorageService(db);
