export interface SyncEncryptionEnvelope {
  version: number;
  iv: string;
  data: string;
}

export interface SyncEncryptionStatus {
  configured: boolean;
  unlocked: boolean;
  iterations: number | null;
}

export type SyncEncryptionStatusChangeReason = 'configured' | 'unlocked' | 'locked' | 'cleared';

export interface SyncEncryptionStatusChange {
  status: SyncEncryptionStatus;
  reason: SyncEncryptionStatusChangeReason;
  occurredAt: string;
}
