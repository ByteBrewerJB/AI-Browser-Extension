import { db } from './db';
import { removeItemsFromFolders, setItemFolder } from './folderItems';
import type { PromptRecord } from '@/core/models';

function nowIso() {
  return new Date().toISOString();
}

export interface CreatePromptInput {
  name: string;
  content: string;
  description?: string;
  folderId?: string;
  gptId?: string;
}

export interface UpdatePromptInput {
  id: string;
  name?: string;
  content?: string;
  description?: string | null;
  folderId?: string | null;
  gptId?: string | null;
}

export async function createPrompt(input: CreatePromptInput) {
  const trimmedName = input.name.trim();
  const trimmedContent = input.content.trim();

  if (!trimmedName) {
    throw new Error('Prompt name is required');
  }

  if (!trimmedContent) {
    throw new Error('Prompt content is required');
  }

  const timestamp = nowIso();
  const record: PromptRecord = {
    id: crypto.randomUUID(),
    name: trimmedName,
    content: trimmedContent,
    description: input.description?.trim() || undefined,
    folderId: input.folderId?.trim() || undefined,
    gptId: input.gptId?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.transaction('rw', db.prompts, db.folderItems, async () => {
    await db.prompts.put(record);
    await setItemFolder({
      itemId: record.id,
      itemType: 'prompt',
      folderId: record.folderId,
      timestamp,
      table: db.folderItems
    });
  });

  return record;
}

export async function updatePrompt(input: UpdatePromptInput) {
  await db.transaction('rw', db.prompts, db.folderItems, async () => {
    const existing = await db.prompts.get(input.id);
    if (!existing) {
      throw new Error(`Prompt ${input.id} not found`);
    }

    const next: PromptRecord = {
      ...existing,
      updatedAt: nowIso()
    };

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new Error('Prompt name is required');
      }
      next.name = trimmed;
    }

    if (input.content !== undefined) {
      const trimmed = input.content.trim();
      if (!trimmed) {
        throw new Error('Prompt content is required');
      }
      next.content = trimmed;
    }

    if (input.description !== undefined) {
      const trimmed = input.description?.trim();
      next.description = trimmed ? trimmed : undefined;
    }

    if (input.folderId !== undefined) {
      const trimmed = input.folderId?.trim();
      next.folderId = trimmed ? trimmed : undefined;
    }

    if (input.gptId !== undefined) {
      const trimmed = input.gptId?.trim();
      next.gptId = trimmed ? trimmed : undefined;
    }

    await db.prompts.put(next);
    await setItemFolder({
      itemId: next.id,
      itemType: 'prompt',
      folderId: next.folderId,
      timestamp: next.updatedAt,
      table: db.folderItems
    });
  });
}

export async function deletePrompt(id: string) {
  await db.transaction('rw', db.prompts, db.folderItems, async () => {
    await db.prompts.delete(id);
    await removeItemsFromFolders({ itemType: 'prompt', itemIds: [id], table: db.folderItems });
  });
}

export async function listPrompts() {
  return db.prompts.orderBy('updatedAt').reverse().toArray();
}

export async function getPromptById(id: string) {
  return db.prompts.get(id);
}
