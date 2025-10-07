import { syncEncryptionBridge } from '@/core/storage/syncEncryptionBridge';
import { sendRuntimeMessage } from './router';
import type { SyncEncryptionStatus } from '@/shared/types/syncEncryption';

type ConfigureResult = { status: 'configured' };
type UnlockResult = { status: 'unlocked' } | { status: 'invalid' } | { status: 'not_configured' };
type LockResult = { status: 'locked' };

export async function getSyncEncryptionStatus(): Promise<SyncEncryptionStatus> {
  const response = await sendRuntimeMessage('sync/encryption-status', {});
  return response;
}

export async function configureSyncEncryption(passphrase: string): Promise<ConfigureResult['status']> {
  const response = await sendRuntimeMessage('sync/encryption-configure', { passphrase });
  if (response.status === 'configured') {
    await syncEncryptionBridge.refreshStatus();
  }
  return response.status;
}

export async function unlockSyncEncryption(passphrase: string): Promise<UnlockResult['status']> {
  const response = await sendRuntimeMessage('sync/encryption-unlock', { passphrase });
  if (response.status === 'unlocked') {
    await syncEncryptionBridge.refreshStatus();
  }
  return response.status;
}

export async function lockSyncEncryption(): Promise<LockResult['status']> {
  const response = await sendRuntimeMessage('sync/encryption-lock', {});
  if (response.status === 'locked') {
    await syncEncryptionBridge.refreshStatus();
  }
  return response.status;
}
