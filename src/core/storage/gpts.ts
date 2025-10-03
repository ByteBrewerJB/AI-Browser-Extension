import { db } from './db';
import type { GPTRecord } from '@/core/models';

export interface GPTInput {
  name: string;
  description?: string;
  folderId?: string;
}

function nowIso() {
  return new Date().toISOString();
}

export async function createGPT(input: GPTInput): Promise<GPTRecord> {
  const timestamp = nowIso();
  const name = input.name.trim();
  if (!name) {
    throw new Error('GPT name cannot be empty');
  }

  const record: GPTRecord = {
    id: crypto.randomUUID(),
    name,
    description: input.description?.trim() || undefined,
    folderId: input.folderId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.gpts.put(record);
  return record;
}

export async function listGPTs(): Promise<GPTRecord[]> {
  return db.gpts.orderBy('updatedAt').reverse().toArray();
}

export async function updateGPT(
  id: string,
  updates: Partial<Pick<GPTRecord, 'name' | 'description' | 'folderId'>>
): Promise<GPTRecord> {
  const existing = await db.gpts.get(id);
  if (!existing) {
    throw new Error(`GPT ${id} not found`);
  }

  const name = updates.name !== undefined ? updates.name.trim() : undefined;
  if (name !== undefined && !name) {
    throw new Error('GPT name cannot be empty');
  }

  const next: GPTRecord = {
    ...existing,
    ...updates,
    name: name ?? existing.name,
    description:
      updates.description !== undefined
        ? updates.description.trim() || undefined
        : existing.description,
    folderId: updates.folderId ?? existing.folderId,
    updatedAt: nowIso()
  };

  await db.gpts.put(next);
  return next;
}

export async function deleteGPT(id: string): Promise<void> {
  await db.gpts.delete(id);
}
