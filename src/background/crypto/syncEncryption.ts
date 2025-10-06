import {
  SyncEncryptionEnvelope,
  type SyncEncryptionStatus,
  type SyncEncryptionStatusChange,
  type SyncEncryptionStatusChangeReason
} from '@/shared/types/syncEncryption';

const METADATA_STORAGE_KEY = 'ai-companion:sync-encryption:metadata';
const ENVELOPE_VERSION = 1;
const DEFAULT_ITERATIONS = 310_000;
const VERIFICATION_PLAINTEXT = 'ai-companion:sync-verification:v1';

export class SyncEncryptionLockedError extends Error {
  constructor() {
    super('Sync encryption key is locked.');
    this.name = 'SyncEncryptionLockedError';
  }
}

export class SyncEncryptionNotConfiguredError extends Error {
  constructor() {
    super('Sync encryption is not configured.');
    this.name = 'SyncEncryptionNotConfiguredError';
  }
}

export class SyncEncryptionInvalidPassphraseError extends Error {
  constructor() {
    super('The provided passphrase is invalid.');
    this.name = 'SyncEncryptionInvalidPassphraseError';
  }
}

interface SyncEncryptionMetadata {
  version: number;
  salt: string;
  iterations: number;
  verification: SyncEncryptionEnvelope;
}

interface StorageOptions {
  fallbackStore?: Map<string, unknown>;
}

function getLocalStorageArea(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return undefined;
  }
  return chrome.storage.local;
}

async function storageGet(key: string, fallback: Map<string, unknown>): Promise<Record<string, unknown> | undefined> {
  const storage = getLocalStorageArea();
  if (!storage) {
    if (!fallback.has(key)) {
      return undefined;
    }
    return { [key]: fallback.get(key) };
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

async function storageSet(key: string, value: unknown, fallback: Map<string, unknown>): Promise<void> {
  const storage = getLocalStorageArea();
  if (!storage) {
    fallback.set(key, value);
    return;
  }

  if ('set' in storage && storage.set.length === 1) {
    await (storage.set as (items: Record<string, unknown>) => Promise<void>)({ [key]: value });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      storage.set({ [key]: value }, () => {
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

async function storageRemove(key: string, fallback: Map<string, unknown>): Promise<void> {
  const storage = getLocalStorageArea();
  if (!storage) {
    fallback.delete(key);
    return;
  }

  if ('remove' in storage && storage.remove.length === 1) {
    await (storage.remove as (keys: string) => Promise<void>)(key);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      storage.remove(key, () => {
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64')).buffer;
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return globalThis.crypto;
}

export interface SyncEncryptionServiceOptions extends StorageOptions {
  iterations?: number;
}

export interface SyncEncryptionConfigureOptions {
  passphrase: string;
}

export interface SyncEncryptionUnlockOptions {
  passphrase: string;
}

export interface SyncEncryptionEncryptOptions {
  plaintext: string;
}

export class SyncEncryptionService {
  private readonly fallback: Map<string, unknown>;
  private readonly iterations: number;
  private key: CryptoKey | null = null;
  private metadataPromise: Promise<SyncEncryptionMetadata | null> | null = null;
  private readonly listeners = new Set<(change: SyncEncryptionStatusChange) => void>();

  constructor(options: SyncEncryptionServiceOptions = {}) {
    this.fallback = options.fallbackStore ?? new Map();
    this.iterations = options.iterations ?? DEFAULT_ITERATIONS;
  }

  async getStatus(): Promise<SyncEncryptionStatus> {
    const metadata = await this.loadMetadata();
    return {
      configured: Boolean(metadata),
      unlocked: this.key !== null,
      iterations: metadata?.iterations ?? null
    };
  }

  onStatusChange(listener: (change: SyncEncryptionStatusChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async configure(options: SyncEncryptionConfigureOptions): Promise<void> {
    const crypto = getCrypto();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(options.passphrase, salt, this.iterations);
    const verification = await this.createVerification(key);

    const metadata: SyncEncryptionMetadata = {
      version: ENVELOPE_VERSION,
      salt: arrayBufferToBase64(salt.buffer),
      iterations: this.iterations,
      verification
    };

    await storageSet(METADATA_STORAGE_KEY, metadata, this.fallback);
    this.metadataPromise = Promise.resolve(metadata);
    this.key = key;
    await this.emitStatusChange('configured');
  }

  async unlock(options: SyncEncryptionUnlockOptions): Promise<void> {
    const metadata = await this.loadMetadata();
    if (!metadata) {
      throw new SyncEncryptionNotConfiguredError();
    }

    const salt = new Uint8Array(base64ToArrayBuffer(metadata.salt));
    const key = await this.deriveKey(options.passphrase, salt, metadata.iterations);
    await this.verifyKey(key, metadata.verification);
    this.key = key;
    await this.emitStatusChange('unlocked');
  }

  async lock(): Promise<void> {
    this.key = null;
    await this.emitStatusChange('locked');
  }

  async clear(): Promise<void> {
    this.key = null;
    this.metadataPromise = null;
    await storageRemove(METADATA_STORAGE_KEY, this.fallback);
    await this.emitStatusChange('cleared');
  }

  async encryptString(options: SyncEncryptionEncryptOptions): Promise<SyncEncryptionEnvelope> {
    const key = await this.ensureKey();
    const crypto = getCrypto();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(options.plaintext));

    return {
      version: ENVELOPE_VERSION,
      iv: arrayBufferToBase64(iv.buffer),
      data: arrayBufferToBase64(ciphertext)
    };
  }

  async decryptToString(envelope: SyncEncryptionEnvelope): Promise<string> {
    if (envelope.version !== ENVELOPE_VERSION) {
      throw new Error(`Unsupported envelope version: ${envelope.version}`);
    }

    const key = await this.ensureKey();
    const crypto = getCrypto();
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    const ciphertext = base64ToArrayBuffer(envelope.data);

    try {
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new SyncEncryptionInvalidPassphraseError();
    }
  }

  private async ensureKey(): Promise<CryptoKey> {
    if (this.key) {
      return this.key;
    }

    const metadata = await this.loadMetadata();
    if (!metadata) {
      throw new SyncEncryptionNotConfiguredError();
    }

    throw new SyncEncryptionLockedError();
  }

  private async loadMetadata(): Promise<SyncEncryptionMetadata | null> {
    if (!this.metadataPromise) {
      this.metadataPromise = (async () => {
        const result = await storageGet(METADATA_STORAGE_KEY, this.fallback);
        const value = result?.[METADATA_STORAGE_KEY] as SyncEncryptionMetadata | undefined;
        return value ?? null;
      })();
    }
    return this.metadataPromise;
  }

  private async deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const crypto = getCrypto();
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const saltBuffer = Uint8Array.from(salt).buffer;
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async createVerification(key: CryptoKey): Promise<SyncEncryptionEnvelope> {
    const crypto = getCrypto();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(VERIFICATION_PLAINTEXT));

    return {
      version: ENVELOPE_VERSION,
      iv: arrayBufferToBase64(iv.buffer),
      data: arrayBufferToBase64(ciphertext)
    };
  }

  private async verifyKey(key: CryptoKey, envelope: SyncEncryptionEnvelope): Promise<void> {
    const crypto = getCrypto();
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    const ciphertext = base64ToArrayBuffer(envelope.data);

    try {
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      const decoded = new TextDecoder().decode(decrypted);
      if (decoded !== VERIFICATION_PLAINTEXT) {
        throw new SyncEncryptionInvalidPassphraseError();
      }
    } catch (error) {
      throw new SyncEncryptionInvalidPassphraseError();
    }
  }

  private async emitStatusChange(reason: SyncEncryptionStatusChangeReason): Promise<void> {
    const status = await this.getStatus();
    const change: SyncEncryptionStatusChange = {
      status,
      reason,
      occurredAt: new Date().toISOString()
    };
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.warn('[ai-companion] sync encryption listener failed', error);
      }
    }
  }
}

export function createSyncEncryptionService(options?: SyncEncryptionServiceOptions) {
  return new SyncEncryptionService(options);
}

export type { SyncEncryptionEnvelope };
