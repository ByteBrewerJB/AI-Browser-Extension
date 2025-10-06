import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/shared/i18n/useTranslation';
import {
  configureSyncEncryption,
  getSyncEncryptionStatus,
  lockSyncEncryption,
  unlockSyncEncryption
} from '@/shared/messaging/syncEncryptionClient';
import type { SyncEncryptionStatus } from '@/shared/types/syncEncryption';
import { EncryptionStatusNotifications } from './EncryptionStatusNotifications';

type StatusBadge = {
  label: string;
  description: string | null;
  tone: 'neutral' | 'warning' | 'success';
};

function resolveBadge(status: SyncEncryptionStatus | null, t: ReturnType<typeof useTranslation>['t']): StatusBadge {
  if (!status) {
    return {
      label: t('options.encryption.stateUnknown', { defaultValue: 'Status unavailable' }),
      description: null,
      tone: 'neutral'
    };
  }

  if (!status.configured) {
    return {
      label: t('options.encryption.stateNotConfigured', { defaultValue: 'Not configured' }),
      description: t('options.encryption.stateNotConfiguredDescription', {
        defaultValue: 'No passphrase has been set. Dexie snapshots fall back to the local key.'
      }),
      tone: 'warning'
    };
  }

  if (!status.unlocked) {
    return {
      label: t('options.encryption.stateLocked', { defaultValue: 'Configured · Locked' }),
      description: t('options.encryption.stateLockedDescription', {
        defaultValue: 'A passphrase is configured. Enter it below to unlock sync encryption.'
      }),
      tone: 'warning'
    };
  }

  return {
    label: t('options.encryption.stateUnlocked', { defaultValue: 'Configured · Unlocked' }),
    description: t('options.encryption.stateUnlockedDescription', {
      defaultValue: 'Dexie sync snapshots encrypt/decrypt automatically while unlocked.'
    }),
    tone: 'success'
  };
}

function toneClasses(tone: StatusBadge['tone']): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    case 'warning':
      return 'border-amber-400/40 bg-amber-400/10 text-amber-100';
    case 'neutral':
    default:
      return 'border-slate-700 bg-slate-800/60 text-slate-200';
  }
}

export function EncryptionSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SyncEncryptionStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);

  const [configurePassphrase, setConfigurePassphrase] = useState('');
  const [configureConfirm, setConfigureConfirm] = useState('');
  const [configurePending, setConfigurePending] = useState(false);
  const [configureNotice, setConfigureNotice] = useState<string | null>(null);
  const [configureError, setConfigureError] = useState<string | null>(null);

  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockPending, setUnlockPending] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [lockPending, setLockPending] = useState(false);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const currentStatus = await getSyncEncryptionStatus();
      setStatus(currentStatus);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const badge = useMemo(() => resolveBadge(status, t), [status, t]);

  const iterationsDescription = useMemo(() => {
    if (!status?.iterations) {
      return null;
    }
    const formatted = status.iterations.toLocaleString();
    return t('options.encryption.iterationsLabel', {
      defaultValue: 'PBKDF2 iterations: {{formatted}}',
      formatted
    });
  }, [status?.iterations, t]);

  const resetConfigureFeedback = useCallback(() => {
    setConfigureNotice(null);
    setConfigureError(null);
  }, []);

  const resetUnlockFeedback = useCallback(() => {
    setUnlockNotice(null);
    setUnlockError(null);
  }, []);

  const handleConfigure = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      resetConfigureFeedback();

      if (!configurePassphrase) {
        setConfigureError(
          t('options.encryption.errorMissingPassphrase', { defaultValue: 'Enter a passphrase first.' })
        );
        return;
      }

      if (configurePassphrase.length < 8) {
        setConfigureError(
          t('options.encryption.errorTooShort', {
            defaultValue: 'Use at least 8 characters to harden the derived key.'
          })
        );
        return;
      }

      if (configurePassphrase !== configureConfirm) {
        setConfigureError(
          t('options.encryption.errorMismatch', { defaultValue: 'Passphrases must match.' })
        );
        return;
      }

      setConfigurePending(true);
      try {
        const result = await configureSyncEncryption(configurePassphrase);
        if (result === 'configured') {
          setConfigureNotice(
            status?.configured
              ? t('options.encryption.noticeUpdated', {
                  defaultValue: 'Passphrase updated. Snapshots will use the new key immediately.'
                })
              : t('options.encryption.noticeConfigured', {
                  defaultValue: 'Encryption configured. Snapshots will now require this passphrase.'
                })
          );
          setConfigurePassphrase('');
          setConfigureConfirm('');
          setUnlockPassphrase('');
          await loadStatus();
        }
      } catch (error) {
        setConfigureError(
          t('options.encryption.errorConfigureFailed', {
            defaultValue: 'Saving the passphrase failed. Retry and check the service worker logs.',
            message: error instanceof Error ? error.message : String(error)
          })
        );
      } finally {
        setConfigurePending(false);
      }
    },
    [
      configureConfirm,
      configurePassphrase,
      loadStatus,
      resetConfigureFeedback,
      status?.configured,
      t
    ]
  );

  const handleUnlock = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      resetUnlockFeedback();

      if (!unlockPassphrase) {
        setUnlockError(t('options.encryption.errorMissingPassphrase', { defaultValue: 'Enter a passphrase first.' }));
        return;
      }

      setUnlockPending(true);
      try {
        const result = await unlockSyncEncryption(unlockPassphrase);
        if (result === 'unlocked') {
          setUnlockNotice(
            t('options.encryption.noticeUnlocked', {
              defaultValue: 'Encryption unlocked. Sync snapshots can now decrypt data.'
            })
          );
          setUnlockPassphrase('');
          await loadStatus();
        } else if (result === 'invalid') {
          setUnlockError(
            t('options.encryption.errorInvalidPassphrase', {
              defaultValue: 'The passphrase did not match. Retry with the correct value.'
            })
          );
        } else {
          setUnlockError(
            t('options.encryption.errorNotConfigured', {
              defaultValue: 'Encryption is not configured yet. Set a passphrase first.'
            })
          );
        }
      } catch (error) {
        setUnlockError(
          t('options.encryption.errorUnlockFailed', {
            defaultValue: 'Unlock failed. Check the background console for details.',
            message: error instanceof Error ? error.message : String(error)
          })
        );
      } finally {
        setUnlockPending(false);
      }
    },
    [loadStatus, resetUnlockFeedback, t, unlockPassphrase]
  );

  const handleLock = useCallback(async () => {
    setLockNotice(null);
    setLockError(null);
    setLockPending(true);
    try {
      const result = await lockSyncEncryption();
      if (result === 'locked') {
        setLockNotice(
          t('options.encryption.noticeLocked', {
            defaultValue: 'Encryption locked. Snapshots remain protected until you unlock again.'
          })
        );
        await loadStatus();
      }
    } catch (error) {
      setLockError(
        t('options.encryption.errorLockFailed', {
          defaultValue: 'Locking failed. Inspect the background console for more details.',
          message: error instanceof Error ? error.message : String(error)
        })
      );
    } finally {
      setLockPending(false);
    }
  }, [loadStatus, t]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('options.encryption.heading', { defaultValue: 'Passphrase & sync encryption' })}
          </h2>
          <p className="text-xs text-slate-400">
            {t('options.encryption.description', {
              defaultValue:
                'Protect Dexie sync snapshots with an optional passphrase. The key never leaves this device.'
            })}
          </p>
        </div>
        <div
          className={`inline-flex flex-col gap-1 rounded-md border px-3 py-2 text-xs font-semibold ${toneClasses(badge.tone)}`}
        >
          <span>{badge.label}</span>
          {statusLoading ? (
            <span className="text-[10px] text-slate-200/70">
              {t('options.encryption.stateLoading', { defaultValue: 'Checking status…' })}
            </span>
          ) : badge.description ? (
            <span className="text-[10px] text-slate-200/70">{badge.description}</span>
          ) : null}
          {iterationsDescription ? (
            <span className="text-[10px] text-slate-200/60">{iterationsDescription}</span>
          ) : null}
        </div>
      </header>

      <EncryptionStatusNotifications />

      {statusError ? <p className="mb-3 text-xs text-rose-400">{statusError}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="flex flex-col gap-3" onSubmit={handleConfigure}>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {status?.configured
                ? t('options.encryption.configureHeadingUpdate', { defaultValue: 'Update passphrase' })
                : t('options.encryption.configureHeading', { defaultValue: 'Set a passphrase' })}
            </h3>
            <p className="text-[11px] text-slate-500">
              {t('options.encryption.configureDescription', {
                defaultValue:
                  'Choose a strong passphrase. It will be required to restore synced data on other devices.'
              })}
            </p>
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-300">
            <span>{t('options.encryption.passphraseLabel', { defaultValue: 'Passphrase' })}</span>
            <input
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              type="password"
              value={configurePassphrase}
              onChange={(event) => {
                resetConfigureFeedback();
                setConfigurePassphrase(event.target.value);
              }}
              autoComplete="new-password"
              placeholder={t('options.encryption.passphrasePlaceholder', { defaultValue: 'Enter a new passphrase' }) ?? ''}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-300">
            <span>{t('options.encryption.confirmLabel', { defaultValue: 'Confirm passphrase' })}</span>
            <input
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              type="password"
              value={configureConfirm}
              onChange={(event) => {
                resetConfigureFeedback();
                setConfigureConfirm(event.target.value);
              }}
              autoComplete="new-password"
              placeholder={
                t('options.encryption.confirmPlaceholder', { defaultValue: 'Type the passphrase again' }) ?? ''
              }
            />
          </label>
          {configureError ? <p className="text-[11px] text-rose-400">{configureError}</p> : null}
          {configureNotice ? <p className="text-[11px] text-emerald-300">{configureNotice}</p> : null}
          <div className="flex items-center gap-3">
            <button
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-emerald-950 shadow-sm disabled:opacity-60"
              type="submit"
              disabled={configurePending}
            >
              {configurePending
                ? t('options.encryption.configureSaving', { defaultValue: 'Saving…' })
                : status?.configured
                  ? t('options.encryption.updateCta', { defaultValue: 'Update passphrase' })
                  : t('options.encryption.configureCta', { defaultValue: 'Save passphrase' })}
            </button>
            <p className="text-[10px] text-slate-500">
              {t('options.encryption.configureHint', {
                defaultValue: 'The passphrase is never synced. Store it in a secure manager.'
              })}
            </p>
          </div>
        </form>

        <div className="flex flex-col gap-4">
          <form className="flex flex-col gap-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {t('options.encryption.unlockHeading', { defaultValue: 'Unlock existing passphrase' })}
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('options.encryption.unlockDescription', {
                  defaultValue: 'Unlock to decrypt snapshots and allow other devices to sync.'
                })}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-300">
              <span>{t('options.encryption.unlockLabel', { defaultValue: 'Passphrase' })}</span>
              <input
                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                type="password"
                value={unlockPassphrase}
                onChange={(event) => {
                  resetUnlockFeedback();
                  setUnlockPassphrase(event.target.value);
                }}
                autoComplete="current-password"
                placeholder={t('options.encryption.unlockPlaceholder', { defaultValue: 'Enter your passphrase' }) ?? ''}
              />
            </label>
            {unlockError ? <p className="text-[11px] text-rose-400">{unlockError}</p> : null}
            {unlockNotice ? <p className="text-[11px] text-emerald-300">{unlockNotice}</p> : null}
            <button
              className="self-start rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-sm disabled:opacity-60"
              type="submit"
              disabled={unlockPending || !status?.configured}
            >
              {unlockPending
                ? t('options.encryption.unlocking', { defaultValue: 'Unlocking…' })
                : t('options.encryption.unlockCta', { defaultValue: 'Unlock' })}
            </button>
          </form>

          <div className="rounded-md border border-slate-800/80 bg-slate-950/40 p-3 text-[11px] text-slate-400">
            <p className="font-semibold uppercase tracking-wide text-slate-400">
              {t('options.encryption.lockHeading', { defaultValue: 'Lock snapshots' })}
            </p>
            <p className="mt-1 text-slate-500">
              {t('options.encryption.lockDescription', {
                defaultValue: 'Lock to remove the key from memory. Encrypted data stays unreadable until you unlock again.'
              })}
            </p>
            {lockError ? <p className="mt-2 text-rose-400">{lockError}</p> : null}
            {lockNotice ? <p className="mt-2 text-emerald-300">{lockNotice}</p> : null}
            <button
              className="mt-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-sm disabled:opacity-60"
              type="button"
              onClick={() => void handleLock()}
              disabled={lockPending || !status?.configured || statusLoading}
            >
              {lockPending
                ? t('options.encryption.locking', { defaultValue: 'Locking…' })
                : t('options.encryption.lockCta', { defaultValue: 'Lock now' })}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] text-slate-500">
        {t('options.encryption.footerNote', {
          defaultValue:
            'The extension never transmits your passphrase. If you lose it, synced data cannot be recovered.'
        })}
      </p>
    </section>
  );
}
