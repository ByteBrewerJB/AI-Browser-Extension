import type { AuthManager } from './auth';
import type { SyncEncryptionService } from './crypto/syncEncryption';
import type { NetworkMonitor } from './monitoring/networkMonitor';
import {
  SyncEncryptionInvalidPassphraseError,
  SyncEncryptionLockedError,
  SyncEncryptionNotConfiguredError
} from './crypto/syncEncryption';
import type { JobScheduler } from './jobs/scheduler';
import { listJobs } from './jobs/queue';
import type { JobRecord, JobSnapshot, JobStatus } from '@/core/models';
import { createRuntimeMessageRouter } from '@/shared/messaging/router';
import type { RuntimeMessageMap } from '@/shared/messaging/contracts';

export interface MessagingDependencies {
  auth: AuthManager;
  scheduler: JobScheduler;
  encryption: SyncEncryptionService;
  monitor?: NetworkMonitor;
}

export function initializeMessaging(deps: MessagingDependencies) {
  const router = createRuntimeMessageRouter<RuntimeMessageMap>();

  function toSnapshot(job: JobRecord): JobSnapshot {
    const { payload: _payload, ...rest } = job;
    return rest;
  }

  router.register('runtime/ping', async () => ({
    type: 'pong',
    receivedAt: new Date().toISOString()
  } as const));

  router.register('auth/status', async ({ includeToken }) => deps.auth.getStatus({ includeToken }));

  router.register('jobs/schedule-export', async ({ exportId, runAt, payload, jobType, maxAttempts }) => {
    const job = await deps.scheduler.schedule({
      type: jobType ?? 'export',
      payload: {
        exportId,
        ...(payload ?? {})
      },
      runAt,
      maxAttempts
    });

    return {
      jobId: job.id,
      scheduledFor: job.runAt
    };
  });

  router.register('jobs/log-event', async ({ event, guideId, metadata, runAt, surface }) => {
    const job = await deps.scheduler.schedule({
      type: 'event',
      payload: {
        event,
        guideId,
        metadata: metadata ?? {},
        surface: surface ?? 'options',
        openedAt: new Date().toISOString()
      },
      runAt: runAt ?? new Date().toISOString(),
      maxAttempts: 1
    });

    return {
      jobId: job.id
    };
  });

  router.register('jobs/list', async ({ limit, statuses }) => {
    const jobs = await listJobs();
    const allowedStatuses: JobStatus[] | undefined =
      Array.isArray(statuses) && statuses.length > 0 ? statuses : undefined;
    const filtered = jobs
      .filter((job) => (allowedStatuses ? allowedStatuses.includes(job.status) : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

    const trimmed = typeof limit === 'number' && limit >= 0 ? filtered.slice(0, limit) : filtered;

    return {
      jobs: trimmed.map((job) => toSnapshot(job)),
      fetchedAt: new Date().toISOString()
    };
  });

  router.register('sync/encryption-status', async () => deps.encryption.getStatus());

  router.register('sync/encryption-configure', async ({ passphrase }) => {
    await deps.encryption.configure({ passphrase });
    return { status: 'configured' } as const;
  });

  router.register('sync/encryption-unlock', async ({ passphrase }) => {
    try {
      await deps.encryption.unlock({ passphrase });
      return { status: 'unlocked' } as const;
    } catch (error) {
      if (error instanceof SyncEncryptionNotConfiguredError) {
        return { status: 'not_configured' } as const;
      }
      if (error instanceof SyncEncryptionInvalidPassphraseError) {
        return { status: 'invalid' } as const;
      }
      throw error;
    }
  });

  router.register('sync/encryption-lock', async () => {
    await deps.encryption.lock();
    return { status: 'locked' } as const;
  });

  router.register('sync/encryption-encrypt', async ({ plaintext }) => {
    try {
      const envelope = await deps.encryption.encryptString({ plaintext });
      return { status: 'ok', envelope } as const;
    } catch (error) {
      if (error instanceof SyncEncryptionLockedError) {
        return { status: 'locked' } as const;
      }
      if (error instanceof SyncEncryptionNotConfiguredError) {
        return { status: 'not_configured' } as const;
      }
      throw error;
    }
  });

  router.register('sync/encryption-decrypt', async ({ envelope }) => {
    try {
      const plaintext = await deps.encryption.decryptToString(envelope);
      return { status: 'ok', plaintext } as const;
    } catch (error) {
      if (error instanceof SyncEncryptionLockedError) {
        return { status: 'locked' } as const;
      }
      if (error instanceof SyncEncryptionInvalidPassphraseError) {
        return { status: 'invalid' } as const;
      }
      if (error instanceof SyncEncryptionNotConfiguredError) {
        return { status: 'not_configured' } as const;
      }
      throw error;
    }
  });

  router.register('monitoring/network-incidents', async () => {
    const incidents = deps.monitor?.getIncidents() ?? [];
    return {
      incidents,
      fetchedAt: new Date().toISOString()
    };
  });

  router.attach();

  return { router };
}
