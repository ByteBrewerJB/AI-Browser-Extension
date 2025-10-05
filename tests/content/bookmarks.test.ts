import assert from 'node:assert/strict';
import { db, resetDatabase } from '@/core/storage/db';
import { getBookmarks, toggleBookmark, upsertConversation } from '@/core/storage';
import { addMessages } from '@/core/storage/conversations';

type AsyncTest = [name: string, execute: () => Promise<void>];

const setupConversation = async () => {
  const conversationId = 'convo-1';
  await upsertConversation({
    id: conversationId,
    title: 'Test Conversation Title',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  await addMessages([
    {
      id: 'msg-1',
      conversationId,
      role: 'user',
      content: 'This is a test message from the user.',
      createdAt: '2024-01-01T00:00:01.000Z',
    },
    {
      id: 'msg-2',
      conversationId,
      role: 'assistant',
      content: 'This is a response from the assistant.',
      createdAt: '2024-01-01T00:00:02.000Z',
    },
  ]);
  return conversationId;
};

const tests: AsyncTest[] = [
  [
    'should create a bookmark for a specific message with a note',
    async () => {
      const conversationId = await setupConversation();
      const messageId = 'msg-1';
      const note = 'This is a test note.';

      const { removed, bookmarkId } = await toggleBookmark(conversationId, messageId, note);

      assert.equal(removed, false, 'Bookmark should be created, not removed');
      assert.ok(bookmarkId, 'Bookmark ID should be defined');

      const bookmarks = await getBookmarks(conversationId);
      assert.equal(bookmarks.length, 1, 'Should have one bookmark');

      const bookmark = bookmarks[0];
      assert.equal(bookmark.id, bookmarkId);
      assert.equal(bookmark.conversationId, conversationId);
      assert.equal(bookmark.messageId, messageId);
      assert.equal(bookmark.note, note);
      assert.equal(bookmark.messagePreview, 'This is a test message from the user.');
    },
  ],
  [
    'should create a bookmark for an entire conversation without a messageId',
    async () => {
      const conversationId = await setupConversation();
      const note = 'Bookmarking the whole conversation.';

      const { removed, bookmarkId } = await toggleBookmark(conversationId, undefined, note);

      assert.equal(removed, false, 'Bookmark should be created');
      assert.ok(bookmarkId, 'Bookmark ID should be defined');

      const bookmarks = await getBookmarks(conversationId);
      assert.equal(bookmarks.length, 1, 'Should have one bookmark');

      const bookmark = bookmarks[0];
      assert.equal(bookmark.id, bookmarkId);
      assert.equal(bookmark.conversationId, conversationId);
      assert.equal(bookmark.messageId, null, 'Message ID should be null');
      assert.equal(bookmark.note, note);
      assert.equal(bookmark.messagePreview, 'Test Conversation Title');
    },
  ],
  [
    'should remove a bookmark when toggled',
    async () => {
      const conversationId = await setupConversation();
      const messageId = 'msg-1';

      const { bookmarkId: initialId } = await toggleBookmark(conversationId, messageId, 'Initial note');
      let bookmarks = await getBookmarks(conversationId);
      assert.equal(bookmarks.length, 1, 'Bookmark should be created initially');

      const { removed, bookmarkId: removedId } = await toggleBookmark(conversationId, messageId);
      assert.equal(removed, true, 'Bookmark should be removed');
      assert.equal(removedId, initialId, 'Removed ID should match initial ID');

      bookmarks = await getBookmarks(conversationId);
      assert.equal(bookmarks.length, 0, 'Bookmarks should be empty after removal');
    },
  ],
  [
    'should update a bookmark by toggling it off and on again with a new note',
    async () => {
      const conversationId = await setupConversation();
      const messageId = 'msg-1';

      const { bookmarkId: initialId } = await toggleBookmark(conversationId, messageId, 'First note');
      assert.ok(initialId);

      await toggleBookmark(conversationId, messageId);

      const { removed, bookmarkId: newId } = await toggleBookmark(conversationId, messageId, 'Updated note');
      assert.equal(removed, false, 'Bookmark should be recreated');
      assert.ok(newId);
      assert.notEqual(newId, initialId, 'Should have a new ID after recreating');

      const bookmarks = await getBookmarks(conversationId);
      assert.equal(bookmarks.length, 1, 'Should have one bookmark after re-creation');
      assert.equal(bookmarks[0].id, newId);
      assert.equal(bookmarks[0].note, 'Updated note');
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