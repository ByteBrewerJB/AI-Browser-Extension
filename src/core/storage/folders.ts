import { db } from './db';
import { removeFoldersFromItems } from './folderItems';
import type { ConversationRecord, FolderRecord, GPTRecord, PromptRecord } from '@/core/models';

export type FolderKind = FolderRecord['kind'];

export interface CreateFolderInput {
  name: string;
  kind: FolderKind;
  parentId?: string;
  favorite?: boolean;
}

export interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[];
}

function nowIso() {
  return new Date().toISOString();
}

export async function createFolder(input: CreateFolderInput) {
  const timestamp = nowIso();
  const record: FolderRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    kind: input.kind,
    parentId: input.parentId,
    favorite: input.favorite ?? false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!record.name) {
    throw new Error('Folder name is required');
  }

  await db.folders.put(record);
  return record;
}

export async function renameFolder(folderId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name is required');
  }

  await db.folders.update(folderId, {
    name: trimmed,
    updatedAt: nowIso()
  });
}

function buildTree(folders: FolderRecord[]): FolderTreeNode[] {
  const nodes = folders.map<FolderTreeNode>((folder) => ({
    ...folder,
    children: []
  }));

  const byId = new Map<string, FolderTreeNode>();
  nodes.forEach((node) => byId.set(node.id, node));

  const roots: FolderTreeNode[] = [];
  nodes.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
      return;
    }
    roots.push(node);
  });

  const sortNodes = (list: FolderTreeNode[]) => {
    list.sort((a, b) => {
      const favoriteDelta = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
      if (favoriteDelta !== 0) {
        return favoriteDelta;
      }
      return a.name.localeCompare(b.name);
    });
    list.forEach((child) => sortNodes(child.children));
  };

  sortNodes(roots);
  return roots;
}

export async function getFolderTree(kind: FolderKind): Promise<FolderTreeNode[]> {
  const folders = await db.folders.where('kind').equals(kind).toArray();
  return buildTree(folders);
}

export async function deleteFolder(folderId: string) {
  await db.transaction('rw', [db.folders, db.conversations, db.gpts, db.prompts, db.folderItems], async () => {
    const allFolders = await db.folders.toArray();
    const byParent = new Map<string | undefined, FolderRecord[]>();
    for (const folder of allFolders) {
      const key = folder.parentId;
      const group = byParent.get(key) ?? [];
      group.push(folder);
      byParent.set(key, group);
    }

    const toDelete = new Set<string>();
    const collect = (id: string) => {
      if (toDelete.has(id)) {
        return;
      }
      toDelete.add(id);
      const children = byParent.get(id) ?? [];
      children.forEach((child) => collect(child.id));
    };

    collect(folderId);

    if (toDelete.size === 0) {
      return;
    }

    const ids = Array.from(toDelete);
    const timestamp = nowIso();
    const [conversations, gpts, prompts] = await Promise.all([
      db.conversations.where('folderId').anyOf(ids).toArray(),
      db.gpts.where('folderId').anyOf(ids).toArray(),
      db.prompts.where('folderId').anyOf(ids).toArray()
    ]);

    await db.folders.bulkDelete(ids);

    if (conversations.length) {
      const updatedConversations = conversations.map<ConversationRecord>((conversation) => ({
        ...conversation,
        folderId: undefined,
        updatedAt: timestamp
      }));
      await db.conversations.bulkPut(updatedConversations);
    }

    if (gpts.length) {
      const updatedGpts = gpts.map<GPTRecord>((gpt) => ({
        ...gpt,
        folderId: undefined,
        updatedAt: timestamp
      }));
      await db.gpts.bulkPut(updatedGpts);
    }

    if (prompts.length) {
      const updatedPrompts = prompts.map<PromptRecord>((prompt) => ({
        ...prompt,
        folderId: undefined,
        updatedAt: timestamp
      }));
      await db.prompts.bulkPut(updatedPrompts);
    }

    await removeFoldersFromItems({ folderIds: ids, table: db.folderItems });
  });
}

export async function toggleFavoriteFolder(folderId: string, next?: boolean) {
  const folder = await db.folders.get(folderId);
  if (!folder) {
    throw new Error('Folder ' + folderId + ' not found');
  }

  const nextFavorite = typeof next === 'boolean' ? next : !Boolean(folder.favorite);
  await db.folders.update(folderId, {
    favorite: nextFavorite,
    updatedAt: nowIso()
  });

  return nextFavorite;
}

export async function listFavoriteFolders(kind: FolderKind) {
  const folders = await db.folders.where('kind').equals(kind).toArray();
  return folders.filter((folder) => Boolean(folder.favorite));
}

export async function listFolders(kind: FolderKind) {
  return db.folders.where('kind').equals(kind).toArray();
}

export function buildFolderTree(folders: FolderRecord[]): FolderTreeNode[] {
  return buildTree(folders);
}





