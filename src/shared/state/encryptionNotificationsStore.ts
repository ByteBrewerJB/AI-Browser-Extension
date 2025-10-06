import { create } from 'zustand';

import { addEncryptionStatusChangeListener } from '@/shared/messaging/encryptionEvents';
import type { SyncEncryptionStatusChange, SyncEncryptionStatusChangeReason } from '@/shared/types/syncEncryption';

export interface EncryptionStatusNotification {
  id: string;
  reason: SyncEncryptionStatusChangeReason;
  occurredAt: string;
  status: SyncEncryptionStatusChange['status'];
}

interface EncryptionNotificationsState {
  notifications: EncryptionStatusNotification[];
  addNotification(change: SyncEncryptionStatusChange): void;
  dismissNotification(id: string): void;
  clear(): void;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `notif-${Math.random().toString(36).slice(2, 10)}`;
}

export const useEncryptionNotificationsStore = create<EncryptionNotificationsState>((set) => ({
  notifications: [],
  addNotification(change) {
    const notification: EncryptionStatusNotification = {
      id: generateId(),
      reason: change.reason,
      occurredAt: change.occurredAt,
      status: change.status
    };
    set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 5) }));
  },
  dismissNotification(id) {
    set((state) => ({ notifications: state.notifications.filter((notification) => notification.id !== id) }));
  },
  clear() {
    set({ notifications: [] });
  }
}));

let initialized = false;
let teardown: (() => void) | null = null;

export function initializeEncryptionNotifications(): void {
  if (initialized) {
    return;
  }
  teardown = addEncryptionStatusChangeListener((change) => {
    useEncryptionNotificationsStore.getState().addNotification(change);
  });
  initialized = true;
}

export function disposeEncryptionNotifications(): void {
  if (teardown) {
    teardown();
    teardown = null;
  }
  initialized = false;
}
