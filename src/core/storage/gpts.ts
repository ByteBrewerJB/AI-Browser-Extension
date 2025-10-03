import { db } from './db';
import type { GPTRecord } from '@/core/models';

function nowIso() {
  return new Date().toISOString();
}

export interface CreateGptInput {
  name: string;
  description?: string;
  folderId?: string;
}

export interface UpdateGptInput {
  id: string;
  name?: string;
  description?: string | null;
  folderId?: string | null;
}

export async function createGpt(input: CreateGptInput) {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('GPT name is required');
  }

  const timestamp = nowIso();
  const record: GPTRecord = {
    id: crypto.randomUUID(),
    name: trimmedName,
    description: input.description?.trim() || undefined,
    folderId: input.folderId?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.gpts.put(record);
  return record;
}

export async function updateGpt(input: UpdateGptInput) {
  const changes: Partial<GPTRecord> = {
    updatedAt: nowIso()
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('GPT name is required');
    }
    changes.name = trimmed;
  }

  if (input.description !== undefined) {
    const trimmed = input.description?.trim();
    changes.description = trimmed ? trimmed : undefined;
  }

  if (input.folderId !== undefined) {
    const trimmed = input.folderId?.trim();
    changes.folderId = trimmed ? trimmed : undefined;
  }

  await db.gpts.update(input.id, changes);
}

export async function deleteGpt(id: string) {
  await db.transaction('rw', db.gpts, db.prompts, async () => {
    await db.gpts.delete(id);
    await db.prompts.where('gptId').equals(id).modify({ gptId: undefined, updatedAt: nowIso() });
  });
}

export async function listGpts() {
  return db.gpts.orderBy('updatedAt').reverse().toArray();
}

export async function getGptById(id: string) {
  return db.gpts.get(id);
}
