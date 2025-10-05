import assert from 'node:assert/strict';

import { collectMessageElements } from '@/content/chatDom';
import type { ConversationRecord, MessageRecord } from '@/core/models';
import { db, getBookmarks, getRecentBookmarks, resetDatabase, toggleBookmark } from '@/core/storage';
import { setupDomEnvironment } from '../utils/domEnvironment';

type AsyncTest = [name: string, execute: () => Promise<void>];

function createConversationRecord(overrides: Partial<ConversationRecord>): ConversationRecord {
  const timestamp = new Date('2025-10-08T12:00:00.000Z').toISOString();
  return {
    id: 'conversation-1',
    title: 'Test conversation title for bookmarks',
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId: undefined,
    pinned: false,
    wordCount: 120,
    charCount: 640,
    archived: false,
    ...overrides
  } satisfies ConversationRecord;
}

function createMessageRecord(overrides: Partial<MessageRecord>): MessageRecord {
  const timestamp = new Date('2025-10-08T12:05:00.000Z').toISOString();
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    role: 'assistant',
    content: 'Assistant reply content',
    createdAt: timestamp,
    updatedAt: timestamp,
    wordCount: 42,
    charCount: 240,
    metadata: {},
    ...overrides
  } satisfies MessageRecord;
}

const tests: AsyncTest[] = [
  [
    'stores bookmarks with message previews and notes',
    async () => {
      const env = setupDomEnvironment();
      try {
        await resetDatabase();

        const conversation = createConversationRecord({ id: 'conversation-a' });
        const messageContent = `${'Prompt '.repeat(20)}${'A'.repeat(220)}`;
        const message = createMessageRecord({
          id: 'message-a',
          conversationId: conversation.id,
          content: messageContent,
          metadata: undefined
        });

        await db.conversations.put(conversation);
        await db.messages.put(message);

        const messageElement = env.document.createElement('div');
        messageElement.setAttribute('data-message-author-role', 'assistant');
        messageElement.setAttribute('data-message-id', message.id);
        messageElement.textContent = messageContent;
        env.document.body.appendChild(messageElement);

        const nodes = collectMessageElements();
        assert.equal(nodes.length, 1);
        assert.equal(nodes[0].getAttribute('data-message-id'), message.id);

        const result = await toggleBookmark(conversation.id, message.id, 'Important context');
        assert.equal(result.removed, false);
        assert.ok(result.bookmarkId);

        const bookmarks = await getBookmarks(conversation.id);
        assert.equal(bookmarks.length, 1);
        const stored = bookmarks[0];
        assert.equal(stored.messageId, message.id);
        assert.equal(stored.note, 'Important context');
        assert.match(stored.createdAt ?? '', /T/);
        assert.ok(stored.messagePreview);
        assert.ok(stored.messagePreview!.endsWith('…'));
        assert.ok(stored.messagePreview!.length <= 200);

        const summaries = await getRecentBookmarks(1);
        assert.equal(summaries.length, 1);
        const summary = summaries[0];
        assert.equal(summary.id, stored.id);
        assert.equal(summary.messageId, stored.messageId);
        assert.equal(summary.messagePreview, stored.messagePreview);
        assert.equal(summary.note, stored.note);
        assert.equal(summary.createdAt, stored.createdAt);
      } finally {
        await resetDatabase();
        env.cleanup();
      }
    }
  ],
  [
    'falls back to conversation title preview when message content is unavailable',
    async () => {
      const env = setupDomEnvironment();
      try {
        await resetDatabase();

        const conversation = createConversationRecord({ id: 'conversation-b', title: 'Deep dive into companion retrofits' });
        await db.conversations.put(conversation);

        const result = await toggleBookmark(conversation.id, undefined, undefined);
        assert.equal(result.removed, false);

        const bookmarks = await getBookmarks(conversation.id);
        assert.equal(bookmarks.length, 1);
        const stored = bookmarks[0];
        assert.equal(stored.messageId, null);
        assert.equal(stored.note, undefined);
        assert.equal(stored.messagePreview, 'Deep dive into companion retrofits');

        const summaries = await getRecentBookmarks(1);
        assert.equal(summaries[0].messagePreview, stored.messagePreview);
      } finally {
        await resetDatabase();
        env.cleanup();
      }
    }
  ]
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
