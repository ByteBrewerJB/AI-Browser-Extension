import type { SyncEncryptionService } from '../crypto/syncEncryption';
import { broadcastEncryptionStatusChange } from '@/shared/messaging/encryptionEvents';
import type { SyncEncryptionStatusChange } from '@/shared/types/syncEncryption';

export interface EncryptionStatusNotifierOptions {
  onChange?: (change: SyncEncryptionStatusChange) => void;
}

export interface EncryptionStatusNotifier {
  dispose(): void;
}

export function createEncryptionStatusNotifier(
  service: SyncEncryptionService,
  options: EncryptionStatusNotifierOptions = {}
): EncryptionStatusNotifier {
  const { onChange } = options;

  const unsubscribe = service.onStatusChange((change) => {
    broadcastEncryptionStatusChange(change);
    if (onChange) {
      try {
        onChange(change);
      } catch (error) {
        console.warn('[ai-companion] encryption notifier listener failed', error);
      }
    }
  });

  return {
    dispose() {
      unsubscribe();
    }
  };
}
