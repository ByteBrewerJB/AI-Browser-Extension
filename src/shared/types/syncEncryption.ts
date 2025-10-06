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
