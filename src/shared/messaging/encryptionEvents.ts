import type { SyncEncryptionStatusChange } from '@/shared/types/syncEncryption';

export const ENCRYPTION_STATUS_CHANGED_EVENT = 'ai-companion:sync/encryption-status-changed';

export interface EncryptionStatusChangeMessage {
  type: typeof ENCRYPTION_STATUS_CHANGED_EVENT;
  payload: SyncEncryptionStatusChange;
}

function resolveChrome(): typeof chrome | undefined {
  return (globalThis as unknown as { chrome?: typeof chrome }).chrome;
}

function isEncryptionStatusChangeMessage(value: unknown): value is EncryptionStatusChangeMessage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      (value as { type?: unknown }).type === ENCRYPTION_STATUS_CHANGED_EVENT &&
      'payload' in value
  );
}

export function broadcastEncryptionStatusChange(change: SyncEncryptionStatusChange): void {
  const chromeApi = resolveChrome();
  if (!chromeApi?.runtime?.sendMessage) {
    return;
  }
  try {
    chromeApi.runtime.sendMessage({ type: ENCRYPTION_STATUS_CHANGED_EVENT, payload: change });
  } catch (error) {
    console.warn('[ai-companion] failed to broadcast encryption status change', error);
  }
}

export function addEncryptionStatusChangeListener(
  listener: (change: SyncEncryptionStatusChange) => void
): () => void {
  const chromeApi = resolveChrome();
  if (!chromeApi?.runtime?.onMessage?.addListener) {
    return () => undefined;
  }

  const handler: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message) => {
    if (!isEncryptionStatusChangeMessage(message)) {
      return undefined;
    }
    try {
      listener(message.payload);
    } catch (error) {
      console.warn('[ai-companion] encryption status listener failed', error);
    }
    return undefined;
  };

  chromeApi.runtime.onMessage.addListener(handler);

  return () => {
    if (chromeApi?.runtime?.onMessage?.removeListener) {
      chromeApi.runtime.onMessage.removeListener(handler);
    }
  };
}
