import { db } from '@/core/storage/db';
import type { JobRecord, JobStatus } from '@/core/models';

const memoryStore = new Map<string, JobRecord>();
const usingMemoryStore = typeof indexedDB === 'undefined';

function cloneJob(job: JobRecord): JobRecord {
  return { ...job, payload: { ...job.payload } };
}

interface JobStore {
  add(job: JobRecord): Promise<void>;
  get(id: string): Promise<JobRecord | undefined>;
  update(id: string, updater: (current: JobRecord) => JobRecord): Promise<JobRecord>;
  list(): Promise<JobRecord[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

function createMemoryStore(): JobStore {
  return {
    async add(job) {
      memoryStore.set(job.id, cloneJob(job));
    },
    async get(id) {
      const job = memoryStore.get(id);
      return job ? cloneJob(job) : undefined;
    },
    async update(id, updater) {
      const current = memoryStore.get(id);
      if (!current) {
        throw new Error(`Job ${id} not found`);
      }
      const next = updater(cloneJob(current));
      memoryStore.set(id, cloneJob(next));
      return cloneJob(next);
    },
    async list() {
      return [...memoryStore.values()].map(cloneJob);
    },
    async delete(id) {
      memoryStore.delete(id);
    },
    async clear() {
      memoryStore.clear();
    }
  };
}

function createDexieStore(): JobStore {
  const table = db.jobs;

  return {
    async add(job) {
      await table.put(job);
    },
    async get(id) {
      const job = await table.get(id);
      return job ? cloneJob(job) : undefined;
    },
    async update(id, updater) {
      const existing = await table.get(id);
      if (!existing) {
        throw new Error(`Job ${id} not found`);
      }
      const next = updater(cloneJob(existing));
      await table.put(next);
      return cloneJob(next);
    },
    async list() {
      const items = await table.toArray();
      return items.map(cloneJob);
    },
    async delete(id) {
      await table.delete(id);
    },
    async clear() {
      await table.clear();
    }
  };
}

const jobStore: JobStore = usingMemoryStore ? createMemoryStore() : createDexieStore();

function nowIso() {
  return new Date().toISOString();
}

export interface EnqueueJobInput {
  type: string;
  payload?: Record<string, unknown>;
  runAt: string;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueJobInput) {
  const timestamp = nowIso();
  const job: JobRecord = {
    id: crypto.randomUUID(),
    type: input.type,
    payload: input.payload ? { ...input.payload } : {},
    status: 'pending',
    runAt: input.runAt,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3
  };

  await jobStore.add(job);
  return job;
}

export async function getJobById(id: string) {
  return jobStore.get(id);
}

export async function listJobs() {
  return jobStore.list();
}

export async function deleteJob(id: string) {
  await jobStore.delete(id);
}

export async function getDueJobs(reference: Date | string) {
  const now = typeof reference === 'string' ? reference : reference.toISOString();
  const jobs = await jobStore.list();
  return jobs
    .filter((job) => job.status === 'pending' && job.runAt <= now)
    .sort((a, b) => (a.runAt < b.runAt ? -1 : a.runAt > b.runAt ? 1 : 0));
}

export async function getNextPendingJob() {
  const jobs = await jobStore.list();
  return jobs
    .filter((job) => job.status === 'pending')
    .sort((a, b) => (a.runAt < b.runAt ? -1 : a.runAt > b.runAt ? 1 : 0))[0];
}

export async function markJobRunning(id: string) {
  const timestamp = nowIso();
  return jobStore.update(id, (current) => ({
    ...current,
    status: 'running',
    attempts: current.attempts + 1,
    updatedAt: timestamp,
    lastRunAt: timestamp,
    lastError: undefined
  }));
}

export interface MarkJobFailedOptions {
  error?: string;
  retryAt?: string;
}

function resolveFailureStatus(job: JobRecord, retryAt?: string): JobStatus {
  if (retryAt && job.attempts < job.maxAttempts) {
    return 'pending';
  }
  return 'failed';
}

export async function markJobFailed(id: string, options: MarkJobFailedOptions = {}) {
  const timestamp = nowIso();
  return jobStore.update(id, (current) => ({
    ...current,
    status: resolveFailureStatus(current, options.retryAt),
    runAt: options.retryAt ?? current.runAt,
    updatedAt: timestamp,
    lastError: options.error ?? current.lastError
  }));
}

export async function markJobCompleted(id: string) {
  const timestamp = nowIso();
  return jobStore.update(id, (current) => ({
    ...current,
    status: 'completed',
    updatedAt: timestamp
  }));
}

export async function resetJobQueueForTests() {
  await jobStore.clear();
}
