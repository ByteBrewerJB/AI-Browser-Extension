import assert from 'node:assert/strict';
import { db, resetDatabase } from '@/core/storage/db';
import { upsertConversation } from '@/core/storage/conversations';
import { createFolder } from '@/core/storage/folders';
import type { ConversationRecord, FolderRecord, FolderItemRecord, FolderItemType } from '@/core/models';

// HACK: The mock DB is incomplete in the test runner. This patches it
// by unconditionally overwriting the folderItems table with a mock that
// supports the methods needed for the setItemFolder function.
const mockFolderItemsStore: FolderItemRecord[] = [];

(db as any).folderItems = {
  where: (clause: string | Record<string, unknown>) => {
    if (typeof clause === 'string' && clause === '[itemType+itemId]') {
      // Mock for: .where('[itemType+itemId]').equals(...)
      return {
        equals: (value: [FolderItemType, string]) => ({
          first: async () => mockFolderItemsStore.find(item => item.itemType === value[0] && item.itemId === value[1]),
        }),
      };
    }

    // Mock for: .where({ itemId: ..., itemType: ... })
    return {
      first: async () => {
        const query = clause as Record<string, unknown>;
        return mockFolderItemsStore.find(item =>
          Object.entries(query).every(([key, value]) => (item as any)[key] === value)
        );
      }
    };
  },
  add: async (item: FolderItemRecord) => {
    const newItem = { ...item };
    if (!newItem.id) {
      newItem.id = crypto.randomUUID();
    }
    mockFolderItemsStore.push(newItem);
    return newItem.id;
  },
  update: async (id: string, updates: Partial<FolderItemRecord>) => {
    const index = mockFolderItemsStore.findIndex((item) => item.id === id);
    if (index > -1) {
      mockFolderItemsStore[index] = { ...mockFolderItemsStore[index], ...updates };
      return 1;
    }
    return 0;
  },
  delete: async (id: string) => {
    const index = mockFolderItemsStore.findIndex((item) => item.id === id);
    if (index > -1) {
      mockFolderItemsStore.splice(index, 1);
      return 1;
    }
    return 0;
  },
  clear: async () => {
    mockFolderItemsStore.length = 0;
  },
};

// Reset mock state before each run.
const originalReset = resetDatabase;
(globalThis as any).resetDatabase = async () => {
  await originalReset();
  if ((db as any).folderItems.clear) {
    await (db as any).folderItems.clear();
  }
};

type AsyncTest = [string, () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'upsertConversation should create a new conversation',
    async () => {
      const conversationData = {
        id: 'con-1',
        title: 'Test Conversation',
      };
      await upsertConversation(conversationData);

      const dbConversation = await db.conversations.get(conversationData.id);
      assert.ok(dbConversation, 'Conversation should be in the database');
      assert.equal(dbConversation?.title, conversationData.title);
    },
  ],
  [
    'upsertConversation should move a conversation to a folder',
    async () => {
      // 1. Create a folder
      const folder = await createFolder({ name: 'Test Folder', kind: 'conversation' });

      // 2. Create a conversation
      const conversationData = {
        id: 'con-2',
        title: 'Conversation to Move',
      };
      await upsertConversation(conversationData);

      // 3. Move the conversation by upserting with a folderId
      await upsertConversation({ ...conversationData, folderId: folder.id });

      // 4. Assert conversation's folderId is updated
      const dbConversation = await db.conversations.get(conversationData.id);
      assert.ok(dbConversation, 'Conversation should exist');
      assert.equal(dbConversation?.folderId, folder.id, 'Conversation folderId should be updated');

      // 5. Assert folderItems table is updated
      const folderItem = await db.folderItems
        .where({
          itemId: conversationData.id,
          itemType: 'conversation',
        })
        .first();

      assert.ok(folderItem, 'Folder item should be created');
      assert.equal(folderItem?.folderId, folder.id, 'Folder item should have the correct folderId');
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