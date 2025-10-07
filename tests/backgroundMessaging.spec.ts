import assert from 'node:assert/strict';

import type { AuthStatus } from '../src/background/auth';
import { initializeMessaging } from '../src/background/messaging';
import { enqueueJob, resetJobQueueForTests } from '../src/background/jobs/queue';
import type { JobRecord } from '../src/core/models';
import type { SyncEncryptionService } from '../src/background/crypto/syncEncryption';
import type { NetworkMonitor } from '../src/background/monitoring/networkMonitor';
import type { NetworkMonitorIncident } from '../src/shared/types/monitoring';

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

function createEncryptionStub(overrides: Partial<SyncEncryptionService> = {}): SyncEncryptionService {
  const base = {
    async getStatus() {
      return { configured: false, unlocked: false, iterations: null };
    },
    async configure() {
      // noop
    },
    async unlock() {
      // noop
    },
    async lock() {
      // noop
    },
    async clear() {
      // noop
    },
    async encryptString() {
      return { version: 1, iv: '', data: '' };
    },
    async decryptToString() {
      return '';
    },
    onStatusChange() {
      return () => undefined;
    }
  } satisfies Partial<SyncEncryptionService>;

  return { ...base, ...overrides } as SyncEncryptionService;
}

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

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub() });

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

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub() });

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

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub() });

      const scheduled = await router.handle({
        type: 'jobs/schedule-export',
        payload: { exportId: 'exp-1', runAt: '2024-06-06T00:00:00.000Z', payload: { scope: 'all' } }
      });

      assert.equal(scheduled.jobId, 'job-3');
      assert.equal(scheduledPayloads.length, 1);
      assert.equal((scheduledPayloads[0] as { type: string }).type, 'export');
    }
  ],
  [
    'lists recent jobs via messaging router without exposing payloads',
    async () => {
      await resetJobQueueForTests();

      const auth = {
        getStatus: () => ({ authenticated: false, premium: false })
      } as unknown as import('../src/background/auth').AuthManager;

      const scheduler = {
        async schedule(input: { type: string; runAt: Date | string; payload?: Record<string, unknown>; maxAttempts?: number }) {
          return {
            id: 'job-list',
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

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub() });

      const seeded = await enqueueJob({
        type: 'export',
        runAt: new Date().toISOString(),
        payload: { scope: 'all' },
        maxAttempts: 3
      });

      const response = await router.handle({ type: 'jobs/list', payload: { limit: 5 } });

      assert.equal(response.jobs.length > 0, true);
      assert.equal(response.jobs[0].id, seeded.id);
      assert.equal('payload' in (response.jobs[0] as Record<string, unknown>), false);
    }
  ],
  [
    'schedules telemetry events through the scheduler dependency',
    async () => {
      const auth = {
        getStatus: () => ({ authenticated: true, premium: false })
      } as unknown as import('../src/background/auth').AuthManager;

      const scheduledPayloads: unknown[] = [];

      const scheduler = {
        async schedule(input: { type: string; runAt: Date | string; payload?: Record<string, unknown>; maxAttempts?: number }) {
          scheduledPayloads.push(input);
          return {
            id: 'job-telemetry',
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

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub() });

      const response = await router.handle({
        type: 'jobs/log-event',
        payload: { event: 'guide-opened', guideId: 'bookmark-overlay', surface: 'options' }
      });

      assert.equal(response.jobId, 'job-telemetry');
      assert.equal(scheduledPayloads.length, 1);
      const [input] = scheduledPayloads as [{ payload?: Record<string, unknown>; type: string; runAt: string }];
      assert.equal(input.type, 'event');
      assert.equal(input.payload?.event, 'guide-opened');
      assert.equal(input.payload?.guideId, 'bookmark-overlay');
    }
  ],
  [
    'returns network incidents via monitoring route',
    async () => {
      const auth = {
        getStatus: () => ({ authenticated: true, premium: false })
      } as unknown as import('../src/background/auth').AuthManager;

      const scheduler = {
        async schedule() {
          return {
            id: 'job-monitor',
            type: 'export',
            payload: {},
            status: 'pending',
            runAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: 0,
            maxAttempts: 1
          } satisfies JobRecord;
        }
      } as unknown as import('../src/background/jobs/scheduler').JobScheduler;

      const incidents: NetworkMonitorIncident[] = [
        {
          id: 'incident-1',
          url: 'https://malicious.example.com',
          method: 'POST',
          reason: 'disallowed_host',
          timestamp: new Date().toISOString()
        }
      ];

      const monitor: NetworkMonitor = {
        install() {
          // noop for tests
        },
        teardown() {
          // noop for tests
        },
        getIncidents() {
          return incidents;
        },
        clearIncidents() {
          incidents.length = 0;
        }
      };

      const { router } = initializeMessaging({ auth, scheduler, encryption: createEncryptionStub(), monitor });

      const response = await router.handle({ type: 'monitoring/network-incidents', payload: {} });
      assert.equal(response.incidents.length, 1);
      assert.equal(response.incidents[0]?.id, 'incident-1');
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
