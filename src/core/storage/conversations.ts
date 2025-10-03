import { db } from './db';
import type { BookmarkRecord, ConversationRecord, MessageRecord } from '@/core/models';
import { computeTextMetrics, sumTextMetrics } from '@/core/utils/textMetrics';

export interface ConversationUpsertInput {
  id: string;
  title: string;
  folderId?: string;
  pinned?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  wordCount?: number;
  charCount?: number;
}

export interface MessageInput {
  id?: string;
  conversationId: string;
  role: MessageRecord['role'];
  content: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: MessageRecord['metadata'];
}

export interface ConversationOverview extends ConversationRecord {
  messageCount: number;
  bookmarkCount: number;
}

function nowIso() {
  return new Date().toISOString();
}

export async function upsertConversation(input: ConversationUpsertInput) {
  const timestamp = input.updatedAt ?? nowIso();
  return db.conversations.put({
    id: input.id,
    title: input.title,
    folderId: input.folderId,
    pinned: input.pinned ?? false,
    archived: input.archived ?? false,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    wordCount: input.wordCount ?? 0,
    charCount: input.charCount ?? 0
  });
}

export async function addMessages(messages: MessageInput[]) {
  if (!messages.length) {
    return;
  }

  const records: MessageRecord[] = messages.map((message) => {
    const id = message.id ?? crypto.randomUUID();
    const createdAt = message.createdAt ?? nowIso();
    const updatedAt = message.updatedAt ?? createdAt;
    const metrics = computeTextMetrics(message.content);

    return {
      id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt,
      updatedAt,
      wordCount: metrics.wordCount,
      charCount: metrics.charCount,
      metadata: message.metadata
    };
  });

  const metricsToApply = sumTextMetrics(records.map((record) => ({
    wordCount: record.wordCount,
    charCount: record.charCount
  })));

  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.bulkPut(records);

    const conversationId = records[0].conversationId;
    const existing = await db.conversations.get(conversationId);
    if (!existing) {
      throw new Error(`Conversation ${conversationId} missing. Call upsertConversation first.`);
    }

    await db.conversations.update(conversationId, {
      updatedAt: nowIso(),
      wordCount: (existing.wordCount ?? 0) + metricsToApply.wordCount,
      charCount: (existing.charCount ?? 0) + metricsToApply.charCount
    });
  });
}

export async function getRecentConversations(limit = 10): Promise<ConversationOverview[]> {
  const conversations = await db.conversations.orderBy('updatedAt').reverse().limit(limit).toArray();
  const overview = await Promise.all(
    conversations.map(async (conversation) => {
      const [messageCount, bookmarkCount] = await Promise.all([
        db.messages.where('conversationId').equals(conversation.id).count(),
        db.bookmarks.where('conversationId').equals(conversation.id).count()
      ]);

      return {
        ...conversation,
        messageCount,
        bookmarkCount
      } satisfies ConversationOverview;
    })
  );

  return overview;
}

export async function toggleBookmark(conversationId: string, messageId?: string, note?: string) {
    const existing = await db.bookmarks
    .where('conversationId')
    .equals(conversationId)
    .and((bookmark) => (bookmark.messageId ?? null) === (messageId ?? null))
    .first();

  if (existing) {
    await db.bookmarks.delete(existing.id);
    return { removed: true, bookmarkId: existing.id };
  }

  const bookmark: BookmarkRecord = {
    id: crypto.randomUUID(),
    conversationId,
    messageId: messageId ?? null,
    createdAt: nowIso(),
    note
  };

  await db.bookmarks.put(bookmark);
  return { removed: false, bookmarkId: bookmark.id };
}

export async function getBookmarks(conversationId: string) {
  return db.bookmarks.where('conversationId').equals(conversationId).toArray();
}

export async function clearConversation(conversationId: string) {
  await db.transaction('rw', db.messages, db.bookmarks, db.conversations, async () => {
    await db.messages.where('conversationId').equals(conversationId).delete();
    await db.bookmarks.where('conversationId').equals(conversationId).delete();
    await db.conversations.delete(conversationId);
  });
}





