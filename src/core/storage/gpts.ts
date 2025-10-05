import { db } from './db';
import { removeItemsFromFolders, setItemFolder } from './folderItems';
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

  await db.transaction('rw', db.gpts, db.folderItems, async () => {
    await db.gpts.put(record);
    await setItemFolder({
      itemId: record.id,
      itemType: 'gpt',
      folderId: record.folderId,
      timestamp,
      table: db.folderItems
    });
  });

  return record;
}

export async function updateGpt(input: UpdateGptInput) {
  await db.transaction('rw', db.gpts, db.folderItems, async () => {
    const existing = await db.gpts.get(input.id);
    if (!existing) {
      throw new Error(`GPT ${input.id} not found`);
    }

    const next: GPTRecord = {
      ...existing,
      updatedAt: nowIso()
    };

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new Error('GPT name is required');
      }
      next.name = trimmed;
    }

    if (input.description !== undefined) {
      const trimmed = input.description?.trim();
      next.description = trimmed ? trimmed : undefined;
    }

    if (input.folderId !== undefined) {
      const trimmed = input.folderId?.trim();
      next.folderId = trimmed ? trimmed : undefined;
    }

    await db.gpts.put(next);
    await setItemFolder({
      itemId: next.id,
      itemType: 'gpt',
      folderId: next.folderId,
      timestamp: next.updatedAt,
      table: db.folderItems
    });
  });
}

export async function deleteGpt(id: string) {
  await db.transaction('rw', db.gpts, db.prompts, db.folderItems, async () => {
    await db.gpts.delete(id);
    await db.prompts.where('gptId').equals(id).modify({ gptId: undefined, updatedAt: nowIso() });
    await removeItemsFromFolders({ itemType: 'gpt', itemIds: [id], table: db.folderItems });
  });
}

export async function listGpts() {
  return db.gpts.orderBy('updatedAt').reverse().toArray();
}

export async function getGptById(id: string) {
  return db.gpts.get(id);
}
