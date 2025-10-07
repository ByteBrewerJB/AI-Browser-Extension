import assert from 'node:assert/strict';

import {
  __resetSearchServiceForTests,
  buildSearchIndex,
  search,
  upsertIntoIndex,
} from '@/core/services/searchService';
import type { ConversationRecord, FolderItemRecord, FolderRecord, MessageRecord } from '@/core/models';
import { db, resetDatabase } from '@/core/storage/db';

function createFolder(
  overrides: Partial<FolderRecord> & Pick<FolderRecord, 'id' | 'name'>
): FolderRecord {
  const timestamp = overrides.updatedAt ?? new Date().toISOString();
  return {
    id: overrides.id,
    name: overrides.name,
    parentId: overrides.parentId,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
    kind: overrides.kind ?? 'conversation',
    favorite: overrides.favorite,
  };
}

function createConversation(
  overrides: Partial<ConversationRecord> & Pick<ConversationRecord, 'id' | 'title'>
): ConversationRecord {
  const timestamp = overrides.updatedAt ?? new Date().toISOString();
  return {
    id: overrides.id,
    title: overrides.title,
    folderId: overrides.folderId,
    pinned: overrides.pinned ?? false,
    archived: overrides.archived,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
    wordCount: overrides.wordCount ?? 0,
    charCount: overrides.charCount ?? 0,
    tags: overrides.tags,
  };
}

function createFolderItem(
  overrides: Partial<FolderItemRecord> & Pick<FolderItemRecord, 'id' | 'folderId' | 'itemId'>
): FolderItemRecord {
  const timestamp = overrides.updatedAt ?? new Date().toISOString();
  return {
    id: overrides.id,
    folderId: overrides.folderId,
    itemId: overrides.itemId,
    itemType: overrides.itemType ?? 'conversation',
    sortIndex: overrides.sortIndex,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function createMessage(
  overrides: Partial<MessageRecord> & Pick<MessageRecord, 'id' | 'conversationId' | 'content'>
): MessageRecord {
  const timestamp = overrides.updatedAt ?? new Date().toISOString();
  return {
    id: overrides.id,
    conversationId: overrides.conversationId,
    role: overrides.role ?? 'assistant',
    content: overrides.content,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
    wordCount: overrides.wordCount ?? 0,
    charCount: overrides.charCount ?? 0,
    metadata: overrides.metadata,
  };
}

type AsyncTest = [string, () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'indexes conversations by tags and folder hierarchy',
    async () => {
      const rootFolder = createFolder({ id: 'folder-root', name: 'Client Projects' });
      const childFolder = createFolder({
        id: 'folder-child',
        name: 'Q1 Launch',
        parentId: rootFolder.id,
      });
      const conversation = createConversation({
        id: 'conv-1',
        title: 'Roadmap Kickoff',
        folderId: childFolder.id,
        tags: ['Finance', 'Q1'],
      });
      const folderItem = createFolderItem({
        id: 'link-1',
        folderId: childFolder.id,
        itemId: conversation.id,
      });
      const message = createMessage({
        id: 'msg-1',
        conversationId: conversation.id,
        content: 'Retrospective planning session notes for Finance team',
      });

      await db.folders.put(rootFolder);
      await db.folders.put(childFolder);
      await db.conversations.put(conversation);
      await db.folderItems.put(folderItem);
      await db.messages.put(message);

      await buildSearchIndex();

      const tagResults = await search('finance');
      assert.deepEqual(tagResults, [conversation.id]);

      const explicitTag = await search('tag:finance');
      assert.deepEqual(explicitTag, [conversation.id]);

      const folderResults = await search('Q1 Launch');
      assert.deepEqual(folderResults, [conversation.id]);

      const messageResults = await search('Retrospective');
      assert.deepEqual(messageResults, [conversation.id]);
    },
  ],
  [
    'updates indexed tags and folders on upsert',
    async () => {
      const alpha = createFolder({ id: 'folder-alpha', name: 'Backlog' });
      const beta = createFolder({ id: 'folder-beta', name: 'Review Queue' });
      const conversation = createConversation({
        id: 'conv-2',
        title: 'Weekly update',
        folderId: alpha.id,
        tags: ['Draft'],
      });
      const initialLink = createFolderItem({
        id: 'link-2',
        folderId: alpha.id,
        itemId: conversation.id,
      });

      await db.folders.put(alpha);
      await db.folders.put(beta);
      await db.conversations.put(conversation);
      await db.folderItems.put(initialLink);

      await buildSearchIndex();

      const beforeResults = await search('draft');
      assert.deepEqual(beforeResults, [conversation.id]);

      const updatedConversation = createConversation({
        ...conversation,
        folderId: beta.id,
        tags: ['Legal'],
      });

      await db.conversations.put(updatedConversation);
      await db.folderItems.clear();
      const updatedLink = createFolderItem({
        id: 'link-3',
        folderId: beta.id,
        itemId: updatedConversation.id,
      });
      await db.folderItems.put(updatedLink);

      const stored = await db.conversations.get(updatedConversation.id);
      assert.ok(stored);
      await upsertIntoIndex([stored!]);

      const newTagResults = await search('legal');
      assert.deepEqual(newTagResults, [updatedConversation.id]);

      const oldTagResults = await search('draft');
      assert.deepEqual(oldTagResults, []);

      const folderResults = await search('Review Queue');
      assert.deepEqual(folderResults, [updatedConversation.id]);
    },
  ],
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    await resetDatabase();
    await __resetSearchServiceForTests();
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
