import type { JobRecord } from '@/core/models';
import {
  enqueueJob,
  getDueJobs,
  getNextPendingJob,
  markJobCompleted,
  markJobFailed,
  markJobRunning,
  type EnqueueJobInput,
  type MarkJobFailedOptions
} from './queue';

export type JobHandler = (job: JobRecord) => Promise<void> | void;

export interface ScheduleJobInput extends Omit<EnqueueJobInput, 'runAt'> {
  runAt: Date | string;
}

export interface AlarmApi {
  create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): void;
  clear(name: string, callback?: (wasCleared: boolean) => void): void;
  onAlarm: {
    addListener(callback: (alarm: chrome.alarms.Alarm) => void): void;
    removeListener(callback: (alarm: chrome.alarms.Alarm) => void): void;
  };
}

export interface JobSchedulerOptions {
  alarmName?: string;
  intervalMs?: number;
  alarms?: AlarmApi | null;
  now?: () => Date;
  onError?: (job: JobRecord, error: unknown) => void;
}

export interface JobScheduler {
  start(): void;
  stop(): void;
  registerHandler(type: string, handler: JobHandler): void;
  schedule(input: ScheduleJobInput): Promise<JobRecord>;
  runDueJobs(): Promise<void>;
}

interface ErrorResponseOptions extends MarkJobFailedOptions {
  forceFailure?: boolean;
}

function toIsoString(input: Date | string) {
  return input instanceof Date ? input.toISOString() : input;
}

export function createJobScheduler(options: JobSchedulerOptions = {}): JobScheduler {
  const alarmName = options.alarmName ?? 'ai-companion.jobs';
  const intervalMs = options.intervalMs ?? 60_000;
  const alarmApi = options.alarms ?? (typeof chrome !== 'undefined' ? chrome.alarms : null);
  const now = options.now ?? (() => new Date());
  const handlers = new Map<string, JobHandler>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const alarmListener = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== alarmName) {
      return;
    }
    await runDueJobs();
  };

  async function clearAlarm() {
    if (!alarmApi) {
      return;
    }
    await new Promise<void>((resolve) => {
      alarmApi.clear(alarmName, () => resolve());
    });
  }

  async function ensureNextAlarm() {
    const nextJob = await getNextPendingJob();
    if (!alarmApi) {
      if (nextJob && new Date(nextJob.runAt) <= now()) {
        await runDueJobs();
      }
      return;
    }

    if (!nextJob) {
      await clearAlarm();
      return;
    }

    const runTime = new Date(nextJob.runAt).getTime();
    const currentTime = now().getTime();
    if (runTime <= currentTime) {
      await runDueJobs();
      return;
    }

    alarmApi.create(alarmName, { when: runTime });
  }

  async function handleJobFailure(job: JobRecord, error: unknown) {
    const retryAvailable = job.attempts < job.maxAttempts;
    const nextRun = retryAvailable ? new Date(now().getTime() + intervalMs).toISOString() : undefined;
    const failureOptions: ErrorResponseOptions = {
      error: error instanceof Error ? error.message : String(error),
      retryAt: nextRun,
      forceFailure: !retryAvailable
    };

    const updated = await markJobFailed(job.id, failureOptions);
    options.onError?.(job, error);
    if (updated.status === 'pending') {
      await ensureNextAlarm();
    }
  }

  async function runDueJobs() {
    const jobs = await getDueJobs(now());
    if (jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      const handler = handlers.get(job.type);
      if (!handler) {
        await markJobFailed(job.id, {
          error: `No handler registered for job type "${job.type}"`
        });
        continue;
      }

      const runningJob = await markJobRunning(job.id);
      try {
        await handler(runningJob);
        await markJobCompleted(job.id);
      } catch (error) {
        await handleJobFailure(runningJob, error);
      }
    }

    await ensureNextAlarm();
  }

  function registerHandler(type: string, handler: JobHandler) {
    handlers.set(type, handler);
  }

  async function schedule(input: ScheduleJobInput) {
    const job = await enqueueJob({
      ...input,
      runAt: toIsoString(input.runAt)
    });
    await ensureNextAlarm();
    return job;
  }

  function start() {
    if (intervalId) {
      return;
    }

    intervalId = setInterval(() => {
      runDueJobs().catch((error) => {
        console.error('[ai-companion] job scheduler interval failed', error);
      });
    }, intervalMs);

    if (alarmApi) {
      alarmApi.onAlarm.addListener(alarmListener);
    }

    void ensureNextAlarm();
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (alarmApi) {
      alarmApi.onAlarm.removeListener(alarmListener);
      alarmApi.clear(alarmName, () => undefined);
    }
  }

  return {
    start,
    stop,
    registerHandler,
    schedule,
    runDueJobs
  };
}
