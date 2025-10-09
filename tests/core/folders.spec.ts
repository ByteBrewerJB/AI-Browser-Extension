import assert from 'node:assert/strict';
import { db, resetDatabase } from '@/core/storage/db';
import {
  createFolder,
  deleteFolder,
  getFolderTree,
  renameFolder,
  toggleFavoriteFolder,
  listFavoriteFolders,
  listFolders
} from '@/core/storage/folders';
import type { FolderRecord } from '@/core/models';

// HACK: The mock DB is incomplete. This patches it for the deleteFolder test.
const mockTable = {
  where: () => ({
    anyOf: () => ({
      toArray: async () => [],
      delete: async () => {},
    }),
  }),
  bulkPut: async () => {},
};

if (!(db as any).conversations) {
  (db as any).conversations = mockTable;
}
if (!(db as any).gpts) {
  (db as any).gpts = mockTable;
}
if (!(db as any).prompts) {
  (db as any).prompts = mockTable;
}
if (!(db as any).folderItems) {
  (db as any).folderItems = mockTable;
}

type AsyncTest = [string, () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'createFolder should add a new folder to the database',
    async () => {
      const folderData = { name: 'Test Folder', kind: 'conversation' as const };
      const createdFolder = await createFolder(folderData);

      assert.ok(createdFolder.id, 'Folder should have an ID');
      assert.equal(createdFolder.name, folderData.name);
      assert.equal(createdFolder.kind, folderData.kind);

      const dbFolder = await db.folders.get(createdFolder.id);
      // Dexie's put() strips undefined properties, so the returned object won't be identical.
      const expectedInDb = { ...createdFolder };
      if (expectedInDb.parentId === undefined) {
        delete expectedInDb.parentId;
      }
      assert.deepStrictEqual(dbFolder, expectedInDb, 'Folder should be in the database');
    },
  ],
  [
    'createFolder should throw an error for an empty name',
    async () => {
      const folderData = { name: ' ', kind: 'conversation' as const };
      await assert.rejects(
        createFolder(folderData),
        { message: 'Folder name is required' },
        'Should throw error for empty folder name'
      );
    },
  ],
  [
    'renameFolder should update the folder name',
    async () => {
      const folder = await createFolder({ name: 'Original Name', kind: 'conversation' });
      const newName = 'Updated Name';
      await renameFolder(folder.id, newName);
      const updatedFolder = await db.folders.get(folder.id);
      assert.equal(updatedFolder?.name, newName, 'Folder name should be updated');
    },
  ],
  [
    'deleteFolder should remove a folder and its descendants',
    async () => {
      const parent = await createFolder({ name: 'Parent', kind: 'conversation' });
      const child = await createFolder({ name: 'Child', kind: 'conversation', parentId: parent.id });
      await deleteFolder(parent.id);
      const parentExists = await db.folders.get(parent.id);
      const childExists = await db.folders.get(child.id);
      assert.equal(parentExists, undefined, 'Parent folder should be deleted');
      assert.equal(childExists, undefined, 'Child folder should be deleted');
    },
  ],
  [
    'getFolderTree should return a nested structure',
    async () => {
      const parent = await createFolder({ name: 'A', kind: 'conversation' });
      const child = await createFolder({ name: 'B', kind: 'conversation', parentId: parent.id });
      const tree = await getFolderTree('conversation');
      assert.equal(tree.length, 1, 'Should be one root folder');
      assert.equal(tree[0].name, 'A');
      assert.equal(tree[0].children.length, 1, 'Parent should have one child');
      assert.equal(tree[0].children[0].name, 'B');
    },
  ],
  [
    'toggleFavoriteFolder should update the favorite status',
    async () => {
      const folder = await createFolder({ name: 'My Folder', kind: 'conversation' });
      assert.equal(folder.favorite, false);
      await toggleFavoriteFolder(folder.id, true);
      let updatedFolder = await db.folders.get(folder.id);
      assert.equal(updatedFolder?.favorite, true, 'Folder should be favorited');
      await toggleFavoriteFolder(folder.id, false);
      updatedFolder = await db.folders.get(folder.id);
      assert.equal(updatedFolder?.favorite, false, 'Folder should be unfavorited');
    },
  ],
  [
    'listFavoriteFolders should return only favorite folders',
    async () => {
      await createFolder({ name: 'Not Favorite', kind: 'conversation' });
      const favorite = await createFolder({ name: 'Favorite', kind: 'conversation', favorite: true });
      const favorites = await listFavoriteFolders('conversation');
      assert.equal(favorites.length, 1, 'Should return one favorite folder');
      assert.equal(favorites[0].id, favorite.id);
    },
  ],
  [
    'listFolders should return all folders of a kind',
    async () => {
      await createFolder({ name: 'Conv Folder 1', kind: 'conversation' });
      await createFolder({ name: 'Conv Folder 2', kind: 'conversation' });
      await createFolder({ name: 'Prompt Folder', kind: 'prompt' });
      const folders = await listFolders('conversation');
      assert.equal(folders.length, 2, 'Should return two conversation folders');
    },
  ],
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    await resetDatabase();
    try {
      await execute();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`✖ ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();