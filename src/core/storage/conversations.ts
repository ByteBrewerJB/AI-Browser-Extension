import { db } from './db';
import { removeConversationMetadata, syncConversationMetadata } from './syncBridge';
import type { BookmarkRecord, ConversationRecord, MessageRecord } from '@/core/models';
import { computeTextMetrics, sumTextMetrics } from '@/core/utils/textMetrics';
import { createBookmarkPreview } from '@/core/utils/bookmarkPreview';

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

async function getConversationCounters(conversationId: string) {
  const [messageCount, bookmarkCount] = await Promise.all([
    db.messages.where('conversationId').equals(conversationId).count(),
    db.bookmarks.where('conversationId').equals(conversationId).count()
  ]);

  return { messageCount, bookmarkCount };
}

async function toConversationOverview(conversation: ConversationRecord): Promise<ConversationOverview> {
  const { messageCount, bookmarkCount } = await getConversationCounters(conversation.id);

  return {
    ...conversation,
    messageCount,
    bookmarkCount
  } satisfies ConversationOverview;
}

export async function extendConversationsWithCounts(
  conversations: ConversationRecord[]
): Promise<ConversationOverview[]> {
  return Promise.all(conversations.map((conversation) => toConversationOverview(conversation)));
}

export async function getConversationOverviewById(
  conversationId: string
): Promise<ConversationOverview | undefined> {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation) {
    return undefined;
  }

  return toConversationOverview(conversation);
}

export async function upsertConversation(input: ConversationUpsertInput) {
  const timestamp = input.updatedAt ?? nowIso();
  const result = await db.conversations.put({
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

  const stored = await db.conversations.get(input.id);
  if (stored) {
    await syncConversationMetadata(stored);
  }

  return result;
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

  const metricsToApply = sumTextMetrics(
    records.map((record) => ({
      wordCount: record.wordCount,
      charCount: record.charCount
    }))
  );

  const conversationId = records[0].conversationId;

  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.bulkPut(records);

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

  const updatedConversation = await db.conversations.get(conversationId);
  if (updatedConversation) {
    await syncConversationMetadata(updatedConversation);
  }
}

export async function getRecentConversations(limit = 10): Promise<ConversationOverview[]> {
  const conversations = await db.conversations.orderBy('updatedAt').reverse().limit(limit).toArray();
  return extendConversationsWithCounts(conversations);
}

export async function getPinnedConversations(limit = 10): Promise<ConversationOverview[]> {
  const conversations = await db.conversations.filter((conversation) => conversation.pinned).toArray();
  conversations.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  const trimmed = typeof limit === 'number' && limit >= 0 ? conversations.slice(0, limit) : conversations;
  return extendConversationsWithCounts(trimmed);
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

  let messagePreview: string | undefined;
  if (messageId) {
    const message = await db.messages.get(messageId);
    if (message?.content) {
      messagePreview = createBookmarkPreview(message.content);
    }
  }

  const bookmark: BookmarkRecord = {
    id: crypto.randomUUID(),
    conversationId,
    messageId: messageId ?? null,
    createdAt: nowIso(),
    note,
    messagePreview
  };

  await db.bookmarks.put(bookmark);
  return { removed: false, bookmarkId: bookmark.id };
}

export async function getBookmarks(conversationId: string) {
  return db.bookmarks.where('conversationId').equals(conversationId).toArray();
}

export async function togglePinned(conversationId: string) {
  const existing = await db.conversations.get(conversationId);
  if (!existing) {
    return { pinned: false };
  }

  const nextPinned = !existing.pinned;
  await db.conversations.update(conversationId, {
    pinned: nextPinned,
    updatedAt: nowIso()
  });

  const updatedConversation = await db.conversations.get(conversationId);
  if (updatedConversation) {
    await syncConversationMetadata(updatedConversation);
  }

  return { pinned: nextPinned };
}

export async function clearConversation(conversationId:string) {
  return deleteConversations([conversationId]);
}

export async function deleteConversations(ids: string[]) {
  if (!ids.length) {
    return;
  }
  await db.transaction('rw', db.messages, db.bookmarks, db.conversations, async () => {
    await db.messages.where('conversationId').anyOf(ids).delete();
    await db.bookmarks.where('conversationId').anyOf(ids).delete();
    await db.conversations.bulkDelete(ids);
  });

  await Promise.all(ids.map((id) => removeConversationMetadata(id)));
}

export async function archiveConversations(ids: string[], archived: boolean) {
  if (!ids.length) {
    return;
  }
  await db.transaction('rw', db.conversations, async () => {
    await Promise.all(
      ids.map((id) =>
        db.conversations.update(id, {
          archived,
          updatedAt: nowIso()
        })
      )
    );
  });

  const conversations = await db.conversations.where('id').anyOf(ids).toArray();
  await Promise.all(conversations.map((conversation) => syncConversationMetadata(conversation)));
}

