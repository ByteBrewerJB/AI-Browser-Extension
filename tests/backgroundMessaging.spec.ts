import assert from 'node:assert/strict';

import type { AuthStatus } from '../src/background/auth';
import { initializeMessaging } from '../src/background/messaging';
import type { JobRecord } from '../src/core/models';

type AsyncTest = [name: string, execute: () => Promise<void>];

const previousChrome = (globalThis as any).chrome;

(globalThis as any).chrome = {
  runtime: {
    onMessage: {
      addListener(_listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) {
        // listener registered for completeness in tests
      },
      removeListener() {
        // noop for tests
      }
    }
  }
} as unknown as typeof chrome;

const tests: AsyncTest[] = [
  [
    'responds with pong for runtime ping',
    async () => {
      const auth = {
        getStatus: () => ({ authenticated: true, premium: false } satisfies AuthStatus)
      } as unknown as import('../src/background/auth').AuthManager;

      const jobRecord: JobRecord = {
        id: 'job-1',
        type: 'export',
        payload: {},
        status: 'pending',
        runAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
      };

      const scheduler = {
        async schedule() {
          return jobRecord;
        }
      } as unknown as import('../src/background/jobs/scheduler').JobScheduler;

      const { router } = initializeMessaging({ auth, scheduler });

      const response = await router.handle({ type: 'runtime/ping', payload: { surface: 'content' } });
      assert.equal(response.type, 'pong');
    }
  ],
  [
    'exposes auth status via messaging router',
    async () => {
      const auth = {
        getStatus: ({ includeToken }: { includeToken?: boolean }) => ({
          authenticated: true,
          premium: true,
          token: includeToken ? 'token-value' : undefined,
          expiresAt: '2024-12-01T00:00:00.000Z'
        })
      } as unknown as import('../src/background/auth').AuthManager;

      const scheduler = {
        async schedule() {
          return {
            id: 'job-2',
            type: 'export',
            payload: {},
            status: 'pending',
            runAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: 0,
            maxAttempts: 3
          } satisfies JobRecord;
        }
      } as unknown as import('../src/background/jobs/scheduler').JobScheduler;

      const { router } = initializeMessaging({ auth, scheduler });

      const status = await router.handle({ type: 'auth/status', payload: { includeToken: true } });
      assert.equal(status.authenticated, true);
      assert.equal(status.premium, true);
      assert.equal(status.token, 'token-value');
    }
  ],
  [
    'schedules export jobs through the scheduler dependency',
    async () => {
      const auth = {
        getStatus: () => ({ authenticated: false, premium: false })
      } as unknown as import('../src/background/auth').AuthManager;

      const scheduledPayloads: unknown[] = [];

      const scheduler = {
        async schedule(input: { type: string; runAt: Date | string; payload?: Record<string, unknown>; maxAttempts?: number }) {
          scheduledPayloads.push(input);
          return {
            id: 'job-3',
            type: input.type,
            payload: input.payload ?? {},
            status: 'pending',
            runAt: typeof input.runAt === 'string' ? input.runAt : input.runAt.toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: 0,
            maxAttempts: input.maxAttempts ?? 3
          } satisfies JobRecord;
        }
      } as unknown as import('../src/background/jobs/scheduler').JobScheduler;

      const { router } = initializeMessaging({ auth, scheduler });

      const scheduled = await router.handle({
        type: 'jobs/schedule-export',
        payload: { exportId: 'exp-1', runAt: '2024-06-06T00:00:00.000Z', payload: { scope: 'all' } }
      });

      assert.equal(scheduled.jobId, 'job-3');
      assert.equal(scheduledPayloads.length, 1);
      assert.equal((scheduledPayloads[0] as { type: string }).type, 'export');
    }
  ]
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    try {
      await execute();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`✖ ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();

if (previousChrome === undefined) {
  delete (globalThis as any).chrome;
} else {
  (globalThis as any).chrome = previousChrome;
}
