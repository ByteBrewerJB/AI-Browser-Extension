import { sendRuntimeMessage } from '@/shared/messaging/router';
import type { SyncEncryptionEnvelope, SyncEncryptionStatus } from '@/shared/types/syncEncryption';

const defaultStatus: SyncEncryptionStatus = { configured: false, unlocked: false, iterations: null };

export class SyncEncryptionBridgeLockedError extends Error {
  constructor(message = 'Sync encryption is locked.') {
    super(message);
    this.name = 'SyncEncryptionBridgeLockedError';
  }
}

export class SyncEncryptionBridgeUnavailableError extends Error {
  constructor(message = 'Sync encryption is unavailable.') {
    super(message);
    this.name = 'SyncEncryptionBridgeUnavailableError';
  }
}

function isSyncEncryptionStatus(value: unknown): value is SyncEncryptionStatus {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<SyncEncryptionStatus>;
  return typeof record.configured === 'boolean' && typeof record.unlocked === 'boolean';
}

interface EncryptResponseOk {
  status: 'ok';
  envelope: SyncEncryptionEnvelope;
}

interface EncryptResponseLocked {
  status: 'locked';
}

interface EncryptResponseUnavailable {
  status: 'not_configured';
}

type EncryptResponse = EncryptResponseOk | EncryptResponseLocked | EncryptResponseUnavailable;

interface DecryptResponseOk {
  status: 'ok';
  plaintext: string;
}

interface DecryptResponseLocked {
  status: 'locked';
}

interface DecryptResponseInvalid {
  status: 'invalid';
}

interface DecryptResponseUnavailable {
  status: 'not_configured';
}

type DecryptResponse = DecryptResponseOk | DecryptResponseLocked | DecryptResponseInvalid | DecryptResponseUnavailable;

export class SyncEncryptionBridge {
  private statusPromise: Promise<SyncEncryptionStatus> | null = null;

  reset() {
    this.statusPromise = null;
  }

  async getStatus(): Promise<SyncEncryptionStatus> {
    if (!this.statusPromise) {
      this.statusPromise = this.fetchStatus();
    }
    return this.statusPromise;
  }

  async refreshStatus(): Promise<SyncEncryptionStatus> {
    const status = await this.fetchStatus();
    this.setStatus(status);
    return status;
  }

  async encrypt(plaintext: string): Promise<SyncEncryptionEnvelope> {
    const status = await this.getStatus();
    if (!status.configured) {
      throw new SyncEncryptionBridgeUnavailableError('Sync encryption is not configured.');
    }
    if (!status.unlocked) {
      throw new SyncEncryptionBridgeLockedError();
    }

    try {
      const response = await sendRuntimeMessage('sync/encryption-encrypt', { plaintext });
      if (isEncryptResponse(response)) {
        if (response.status === 'ok') {
          return response.envelope;
        }
        if (response.status === 'locked') {
          this.setStatus({ ...status, unlocked: false });
          throw new SyncEncryptionBridgeLockedError();
        }
        this.setStatus(defaultStatus);
        throw new SyncEncryptionBridgeUnavailableError('Sync encryption is not configured.');
      }
      this.reset();
      throw new SyncEncryptionBridgeUnavailableError('Unexpected encrypt response.');
    } catch (error) {
      if (error instanceof SyncEncryptionBridgeLockedError || error instanceof SyncEncryptionBridgeUnavailableError) {
        throw error;
      }
      this.reset();
      throw new SyncEncryptionBridgeUnavailableError('Failed to reach sync encryption service.');
    }
  }

  async decrypt(envelope: SyncEncryptionEnvelope): Promise<string> {
    const status = await this.getStatus();
    if (!status.configured) {
      throw new SyncEncryptionBridgeUnavailableError('Sync encryption is not configured.');
    }
    if (!status.unlocked) {
      throw new SyncEncryptionBridgeLockedError();
    }

    try {
      const response = await sendRuntimeMessage('sync/encryption-decrypt', { envelope });
      if (isDecryptResponse(response)) {
        if (response.status === 'ok') {
          return response.plaintext;
        }
        if (response.status === 'locked') {
          this.setStatus({ ...status, unlocked: false });
          throw new SyncEncryptionBridgeLockedError();
        }
        if (response.status === 'invalid') {
          this.reset();
          throw new SyncEncryptionBridgeUnavailableError('Sync encryption envelope is invalid.');
        }
        this.setStatus(defaultStatus);
        throw new SyncEncryptionBridgeUnavailableError('Sync encryption is not configured.');
      }
      this.reset();
      throw new SyncEncryptionBridgeUnavailableError('Unexpected decrypt response.');
    } catch (error) {
      if (error instanceof SyncEncryptionBridgeLockedError || error instanceof SyncEncryptionBridgeUnavailableError) {
        throw error;
      }
      this.reset();
      throw new SyncEncryptionBridgeUnavailableError('Failed to reach sync encryption service.');
    }
  }

  private async fetchStatus(): Promise<SyncEncryptionStatus> {
    try {
      const response = await sendRuntimeMessage('sync/encryption-status', {});
      if (isSyncEncryptionStatus(response)) {
        return response;
      }
    } catch (error) {
      console.warn('[syncEncryptionBridge] Failed to fetch status', error);
    }
    return defaultStatus;
  }

  private setStatus(status: SyncEncryptionStatus) {
    this.statusPromise = Promise.resolve(status);
  }
}

function isEncryptResponse(value: unknown): value is EncryptResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<EncryptResponse>;
  return record?.status === 'ok' || record?.status === 'locked' || record?.status === 'not_configured';
}

function isDecryptResponse(value: unknown): value is DecryptResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<DecryptResponse>;
  return (
    record?.status === 'ok' ||
    record?.status === 'locked' ||
    record?.status === 'invalid' ||
    record?.status === 'not_configured'
  );
}

export const syncEncryptionBridge = new SyncEncryptionBridge();
