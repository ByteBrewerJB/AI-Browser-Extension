import type { AuthManager } from './auth';
import type { JobScheduler } from './jobs/scheduler';
import { createRuntimeMessageRouter } from '@/shared/messaging/router';
import type { RuntimeMessageMap } from '@/shared/messaging/contracts';

export interface MessagingDependencies {
  auth: AuthManager;
  scheduler: JobScheduler;
}

export function initializeMessaging(deps: MessagingDependencies) {
  const router = createRuntimeMessageRouter<RuntimeMessageMap>();

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

  router.attach();

  return { router };
}
