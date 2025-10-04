import type { AuthManager } from './auth';
import type { JobScheduler } from './jobs/scheduler';
import { listJobs } from './jobs/queue';
import type { JobRecord, JobSnapshot, JobStatus } from '@/core/models';
import { createRuntimeMessageRouter } from '@/shared/messaging/router';
import type { RuntimeMessageMap } from '@/shared/messaging/contracts';

export interface MessagingDependencies {
  auth: AuthManager;
  scheduler: JobScheduler;
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

  router.attach();

  return { router };
}
