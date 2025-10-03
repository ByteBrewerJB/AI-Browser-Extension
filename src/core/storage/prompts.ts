import { db } from './db';
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

  await db.prompts.put(record);
  return record;
}

export async function updatePrompt(input: UpdatePromptInput) {
  const changes: Partial<PromptRecord> = {
    updatedAt: nowIso()
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Prompt name is required');
    }
    changes.name = trimmed;
  }

  if (input.content !== undefined) {
    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new Error('Prompt content is required');
    }
    changes.content = trimmed;
  }

  if (input.description !== undefined) {
    const trimmed = input.description?.trim();
    changes.description = trimmed ? trimmed : undefined;
  }

  if (input.folderId !== undefined) {
    const trimmed = input.folderId?.trim();
    changes.folderId = trimmed ? trimmed : undefined;
  }

  if (input.gptId !== undefined) {
    const trimmed = input.gptId?.trim();
    changes.gptId = trimmed ? trimmed : undefined;
  }

  await db.prompts.update(input.id, changes);
}

export async function deletePrompt(id: string) {
  await db.prompts.delete(id);
}

export async function listPrompts() {
  return db.prompts.orderBy('updatedAt').reverse().toArray();
}

export async function getPromptById(id: string) {
  return db.prompts.get(id);
}
