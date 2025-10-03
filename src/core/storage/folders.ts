import { db } from './db';
import type { FolderRecord } from '@/core/models';

export interface FolderInput {
  name: string;
  parentId?: string;
  kind: FolderRecord['kind'];
}

function nowIso() {
  return new Date().toISOString();
}

export async function createFolder(input: FolderInput): Promise<FolderRecord> {
  const timestamp = nowIso();
  const name = input.name.trim();
  if (!name) {
    throw new Error('Folder name cannot be empty');
  }
  const record: FolderRecord = {
    id: crypto.randomUUID(),
    name,
    parentId: input.parentId,
    kind: input.kind,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.folders.put(record);
  return record;
}

export async function listFolders(kind?: FolderRecord['kind']): Promise<FolderRecord[]> {
  if (kind) {
    return db.folders.where('kind').equals(kind).sortBy('name');
  }
  return db.folders.orderBy('name').toArray();
}

export async function updateFolder(id: string, updates: Partial<Pick<FolderRecord, 'name' | 'parentId'>>) {
  const existing = await db.folders.get(id);
  if (!existing) {
    throw new Error(`Folder ${id} not found`);
  }

  const name = updates.name?.trim();
  if (updates.name && !name) {
    throw new Error('Folder name cannot be empty');
  }

  const next: FolderRecord = {
    ...existing,
    ...updates,
    name: name ?? existing.name,
    parentId: updates.parentId ?? existing.parentId,
    updatedAt: nowIso()
  };

  await db.folders.put(next);
  return next;
}

export async function deleteFolder(id: string) {
  await db.folders.delete(id);
}
