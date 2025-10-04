import assert from 'node:assert/strict';

import {
  buildSearchIndex,
  removeFromIndex,
  resetSearchServiceForTests,
  search,
  upsertIntoIndex,
} from '@/core/services/searchService';
import { db, resetDatabase } from '@/core/storage/db';
import type { ConversationRecord, MessageRecord } from '@/core/models';
import type { MetadataRecord } from '@/core/storage/db';

type AsyncTest = [name: string, execute: () => Promise<void>];

const baseTimestamp = new Date('2024-01-01T00:00:00.000Z').getTime();

function getMetadataValue(record: MetadataRecord | undefined) {
  assert.ok(record, 'search index metadata should exist');
  assert.equal(typeof record.value, 'object');
  return record.value as { version: number; index: string };
}

function createConversation(id: string, title: string, offsetMinutes = 0): ConversationRecord {
  const timestamp = new Date(baseTimestamp + offsetMinutes * 60_000).toISOString();
  return {
    id,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    pinned: false,
    wordCount: 0,
    charCount: title.length,
  };
}

function createMessage(
  conversationId: string,
  id: string,
  content: string,
  offsetMinutes = 0,
  role: MessageRecord['role'] = 'assistant',
): MessageRecord {
  const timestamp = new Date(baseTimestamp + offsetMinutes * 60_000).toISOString();
  return {
    id,
    conversationId,
    role,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    charCount: content.length,
  };
}

const tests: AsyncTest[] = [
  [
    'builds the search index from conversations and messages',
    async () => {
      await resetDatabase();
      resetSearchServiceForTests();

      const conversation = createConversation('conv-1', 'Morning briefing');
      const message = createMessage('conv-1', 'msg-1', 'Budget updates for the quarter');

      await db.conversations.put(conversation);
      await db.messages.put(message);

      await buildSearchIndex();

      const byTitle = await search('Morning');
      assert.deepEqual(byTitle, ['conv-1']);

      const byMessage = await search('Budget');
      assert.deepEqual(byMessage, ['conv-1']);

      const metadata = await db.metadata.get('search:index');
      const value = getMetadataValue(metadata);
      assert.equal(value.version, 1);
    },
  ],
  [
    'restores a previously persisted index without rebuilding',
    async () => {
      await resetDatabase();
      resetSearchServiceForTests();

      const conversation = createConversation('conv-restore', 'Persisted insights');
      await db.conversations.put(conversation);

      await buildSearchIndex();

      const storedBefore = await db.metadata.get('search:index');
      assert.ok(storedBefore);

      await db.conversations.clear();
      await db.messages.clear();

      resetSearchServiceForTests();

      await buildSearchIndex();

      const storedAfter = await db.metadata.get('search:index');
      assert.equal(storedAfter?.updatedAt, storedBefore?.updatedAt);

      const results = await search('Persisted');
      assert.deepEqual(results, ['conv-restore']);
    },
  ],
  [
    'rebuilds the index when persisted metadata is outdated',
    async () => {
      await resetDatabase();
      resetSearchServiceForTests();

      const conversation = createConversation('conv-fresh', 'Fresh conversation');
      const message = createMessage('conv-fresh', 'msg-fresh', 'Highlights from the latest release');

      await db.conversations.put(conversation);
      await db.messages.put(message);

      await db.metadata.put({
        key: 'search:index',
        value: { version: 0, index: '{}' },
        updatedAt: new Date('2023-01-01T00:00:00.000Z').toISOString(),
      });

      await buildSearchIndex();

      const metadata = await db.metadata.get('search:index');
      const value = getMetadataValue(metadata);
      assert.equal(value.version, 1);
      assert.notEqual(metadata?.updatedAt, '2023-01-01T00:00:00.000Z');

      const results = await search('Fresh');
      assert.deepEqual(results, ['conv-fresh']);
    },
  ],
  [
    'updates and prunes documents when records change',
    async () => {
      await resetDatabase();
      resetSearchServiceForTests();

      const conversation = createConversation('conv-update', 'Morning digest');
      await db.conversations.put(conversation);

      await buildSearchIndex();

      const metadataBeforeUpdate = await db.metadata.get('search:index');
      assert.ok(metadataBeforeUpdate);

      const updatedConversation = {
        ...conversation,
        title: 'Evening digest',
        updatedAt: new Date(baseTimestamp + 120_000).toISOString(),
        charCount: 'Evening digest'.length,
      } satisfies ConversationRecord;

      const newMessage = createMessage(
        'conv-update',
        'msg-update',
        'Analysis summary ready for review',
        2,
        'assistant',
      );

      await db.conversations.put(updatedConversation);
      await db.messages.put(newMessage);

      await upsertIntoIndex([updatedConversation, newMessage]);

      const metadataAfterUpdate = await db.metadata.get('search:index');
      assert.notEqual(metadataAfterUpdate?.updatedAt, metadataBeforeUpdate?.updatedAt);

      const titleResults = await search('Evening');
      assert.deepEqual(titleResults, ['conv-update']);

      const messageResults = await search('Analysis');
      assert.deepEqual(messageResults, ['conv-update']);

      const oldTitleResults = await search('Morning');
      assert.deepEqual(oldTitleResults, []);

      await removeFromIndex(['conv-update']);

      const metadataAfterRemoval = await db.metadata.get('search:index');
      assert.notEqual(metadataAfterRemoval?.updatedAt, metadataAfterUpdate?.updatedAt);

      const afterRemovalTitle = await search('Evening');
      assert.deepEqual(afterRemovalTitle, []);

      const afterRemovalMessage = await search('Analysis');
      assert.deepEqual(afterRemovalMessage, []);
    },
  ],
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    try {
      await execute();
      console.log(`\u2713 ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`\u2717 ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();
