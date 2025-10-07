import type { Table } from 'dexie';

import { db } from './db';
import type { FolderItemRecord, FolderItemType } from '@/core/models';

export type { FolderItemType } from '@/core/models';

function nowIso() {
  return new Date().toISOString();
}

function resolveTable(table?: Table<FolderItemRecord, string>) {
  return table ?? db.folderItems;
}

function normalizeFolderId(folderId?: string | null) {
  const trimmed = folderId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export interface SetItemFolderOptions {
  itemId: string;
  itemType: FolderItemType;
  folderId?: string | null;
  timestamp?: string;
  table?: Table<FolderItemRecord, string>;
}

export async function setItemFolder({
  itemId,
  itemType,
  folderId,
  timestamp,
  table
}: SetItemFolderOptions) {
  const folderItems = resolveTable(table);
  const normalizedFolderId = normalizeFolderId(folderId);
  const existing = await folderItems
    .where('[itemType+itemId]')
    .equals([itemType, itemId])
    .first();

  if (!normalizedFolderId) {
    if (existing) {
      await folderItems.delete(existing.id);
    }
    return;
  }

  const nextTimestamp = timestamp ?? nowIso();
  if (existing) {
    const updates: Partial<FolderItemRecord> = {
      updatedAt: nextTimestamp
    };
    if (existing.folderId !== normalizedFolderId) {
      updates.folderId = normalizedFolderId;
    }
    await folderItems.update(existing.id, updates);
    return;
  }

  await folderItems.add({
    id: crypto.randomUUID(),
    folderId: normalizedFolderId,
    itemId,
    itemType,
    createdAt: nextTimestamp,
    updatedAt: nextTimestamp
  });
}

export interface RemoveItemsFromFoldersOptions {
  itemType: FolderItemType;
  itemIds: string[];
  table?: Table<FolderItemRecord, string>;
}

export async function removeItemsFromFolders({
  itemType,
  itemIds,
  table
}: RemoveItemsFromFoldersOptions) {
  if (!itemIds.length) {
    return;
  }

  const folderItems = resolveTable(table);
  const compoundKeys = itemIds.map((itemId) => [itemType, itemId] as [FolderItemType, string]);
  await folderItems.where('[itemType+itemId]').anyOf(compoundKeys).delete();
}

export interface RemoveFoldersOptions {
  folderIds: string[];
  table?: Table<FolderItemRecord, string>;
}

export async function removeFoldersFromItems({ folderIds, table }: RemoveFoldersOptions) {
  if (!folderIds.length) {
    return;
  }

  const folderItems = resolveTable(table);
  await folderItems.where('folderId').anyOf(folderIds).delete();
}
