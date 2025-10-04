import assert from 'node:assert/strict';

import { createJobScheduler } from '../src/background/jobs/scheduler';
import { getJobById, markJobRunning, resetJobQueueForTests } from '../src/background/jobs/queue';

type AsyncTest = [name: string, execute: () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'processes due jobs and marks them as completed',
    async () => {
      await resetJobQueueForTests();

      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      let currentTime = baseTime;
      const scheduler = createJobScheduler({ now: () => currentTime, intervalMs: 60_000, alarms: null });

      const processed: string[] = [];
      scheduler.registerHandler('export', async (job) => {
        processed.push(job.id);
      });

      const job = await scheduler.schedule({
        type: 'export',
        runAt: new Date(baseTime.getTime() + 60_000),
        payload: { scope: 'test' }
      });

      currentTime = new Date(baseTime.getTime() + 120_000);
      await scheduler.runDueJobs();

      const stored = await getJobById(job.id);
      assert.equal(processed.length, 1);
      assert.equal(stored?.status, 'completed');
      assert.equal(stored?.attempts, 1);
      assert.ok(stored?.completedAt);
    }
  ],
  [
    'retries failing jobs until they succeed',
    async () => {
      await resetJobQueueForTests();

      const baseTime = new Date('2024-02-02T08:00:00.000Z');
      let currentTime = baseTime;
      const scheduler = createJobScheduler({ now: () => currentTime, intervalMs: 30_000, alarms: null });

      let attempts = 0;
      scheduler.registerHandler('export', async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('temporary failure');
        }
      });

      const job = await scheduler.schedule({
        type: 'export',
        runAt: new Date(baseTime.getTime() + 5_000),
        payload: { scope: 'retry' },
        maxAttempts: 3
      });

      currentTime = new Date(baseTime.getTime() + 10_000);
      await scheduler.runDueJobs();

      let stored = await getJobById(job.id);
      assert.equal(stored?.status, 'pending');
      assert.equal(stored?.attempts, 1);
      assert.equal(attempts, 1);

      currentTime = new Date(baseTime.getTime() + 40_000);
      await scheduler.runDueJobs();

      stored = await getJobById(job.id);
      assert.equal(stored?.status, 'completed');
      assert.equal(stored?.attempts, 2);
      assert.equal(attempts, 2);
      assert.ok(stored?.completedAt);
    }
  ],
  [
    'requeues running jobs when the scheduler restarts',
    async () => {
      await resetJobQueueForTests();

      const baseTime = new Date('2024-03-03T00:00:00.000Z');
      let currentTime = baseTime;

      const scheduler = createJobScheduler({ now: () => currentTime, intervalMs: 60_000, alarms: null });

      const processed: string[] = [];
      scheduler.registerHandler('export', (job) => {
        processed.push(job.id);
      });

      const job = await scheduler.schedule({
        type: 'export',
        runAt: new Date(baseTime.getTime() + 60_000),
        payload: { scope: 'recovery' }
      });

      currentTime = new Date(baseTime.getTime() + 90_000);
      await markJobRunning(job.id);

      scheduler.start();

      currentTime = new Date(baseTime.getTime() + 120_000);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stored = await getJobById(job.id);
      assert.equal(processed.length, 1);
      assert.equal(stored?.status, 'completed');
      assert.equal(stored?.attempts, 2);
      assert.ok(stored?.completedAt);

      scheduler.stop();
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
