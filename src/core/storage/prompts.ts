import { db } from './db';
import type { PromptRecord } from '@/core/models';

export interface PromptInput {
  name: string;
  content: string;
  folderId?: string;
}

function nowIso() {
  return new Date().toISOString();
}

export async function createPrompt(input: PromptInput): Promise<PromptRecord> {
  const timestamp = nowIso();
  const name = input.name.trim();
  const content = input.content.trim();

  if (!name) {
    throw new Error('Prompt name cannot be empty');
  }

  if (!content) {
    throw new Error('Prompt content cannot be empty');
  }

  const record: PromptRecord = {
    id: crypto.randomUUID(),
    name,
    content,
    folderId: input.folderId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.prompts.put(record);
  return record;
}

export async function listPrompts(): Promise<PromptRecord[]> {
  return db.prompts.orderBy('updatedAt').reverse().toArray();
}

export async function updatePrompt(
  id: string,
  updates: Partial<Pick<PromptRecord, 'name' | 'content' | 'folderId'>>
): Promise<PromptRecord> {
  const existing = await db.prompts.get(id);
  if (!existing) {
    throw new Error(`Prompt ${id} not found`);
  }

  const name = updates.name !== undefined ? updates.name.trim() : undefined;
  if (name !== undefined && !name) {
    throw new Error('Prompt name cannot be empty');
  }

  const content = updates.content !== undefined ? updates.content.trim() : undefined;
  if (content !== undefined && !content) {
    throw new Error('Prompt content cannot be empty');
  }

  const next: PromptRecord = {
    ...existing,
    ...updates,
    name: name ?? existing.name,
    content: content ?? existing.content,
    folderId: updates.folderId ?? existing.folderId,
    updatedAt: nowIso()
  };

  await db.prompts.put(next);
  return next;
}

export async function deletePrompt(id: string): Promise<void> {
  await db.prompts.delete(id);
}
