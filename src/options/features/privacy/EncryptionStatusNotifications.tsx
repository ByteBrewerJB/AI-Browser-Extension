import { useMemo } from 'react';

import { useTranslation } from '@/shared/i18n/useTranslation';
import {
  useEncryptionNotificationsStore,
  type EncryptionStatusNotification
} from '@/shared/state/encryptionNotificationsStore';

type Tone = 'info' | 'success' | 'warning';

function resolveTone(reason: EncryptionStatusNotification['reason']): Tone {
  if (reason === 'locked') {
    return 'warning';
  }
  if (reason === 'configured' || reason === 'unlocked') {
    return 'success';
  }
  return 'info';
}

function toneClasses(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100';
    case 'warning':
      return 'border-amber-400/40 bg-amber-400/10 text-amber-100';
    case 'info':
    default:
      return 'border-sky-500/40 bg-sky-500/10 text-sky-100';
  }
}

export function EncryptionStatusNotifications() {
  const { t } = useTranslation();
  const notifications = useEncryptionNotificationsStore((state) => state.notifications);
  const dismiss = useEncryptionNotificationsStore((state) => state.dismissNotification);

  const items = useMemo(() => {
    return notifications.map((notification) => {
      const tone = resolveTone(notification.reason);
      const title = t(`options.encryption.notifications.${notification.reason}.title`, {
        defaultValue: notification.reason
      });
      const description = t(`options.encryption.notifications.${notification.reason}.description`, {
        defaultValue: ''
      });
      const timestampLabel = t('options.encryption.notifications.timestamp', {
        defaultValue: 'Recorded at {{time}}',
        time: new Date(notification.occurredAt).toLocaleString()
      });
      return { notification, tone, title, description, timestampLabel };
    });
  }, [notifications, t]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3" data-testid="encryption-status-notifications">
      {items.map(({ notification, tone, title, description, timestampLabel }) => (
        <div
          key={notification.id}
          className={`rounded-lg border px-4 py-3 shadow-sm backdrop-blur ${toneClasses(tone)}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{title}</p>
              {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
              <p className="mt-2 text-xs opacity-60">{timestampLabel}</p>
            </div>
            <button
              type="button"
              className="rounded border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide transition hover:bg-white/10"
              onClick={() => dismiss(notification.id)}
            >
              {t('options.encryption.notifications.dismiss', { defaultValue: 'Dismiss' })}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
