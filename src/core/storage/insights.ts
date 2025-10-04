import { db } from './db';
import {
  extendConversationsWithCounts,
  getConversationOverviewById
} from './conversations';
import type { BookmarkRecord, JobStatus } from '@/core/models';
import type { ConversationOverview } from './conversations';

function sanitizePreview(content: string, maxLength = 140) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export interface BookmarkSummary {
  id: string;
  conversationId: string;
  conversationTitle: string;
  conversationPinned: boolean;
  createdAt: string;
  messageId?: string | null;
  messagePreview?: string;
  note?: string;
}

export interface JobActivitySnapshot {
  id: string;
  jobId: string;
  type: string;
  status: JobStatus;
  runAt: string;
  updatedAt: string;
  completedAt?: string;
  lastRunAt?: string;
  lastError?: string;
  attempts: number;
  maxAttempts: number;
}

export type ActivityItem =
  | { kind: 'conversation'; id: string; timestamp: string; conversation: ConversationOverview }
  | { kind: 'bookmark'; id: string; timestamp: string; bookmark: BookmarkSummary }
  | { kind: 'job'; id: string; timestamp: string; job: JobActivitySnapshot };

async function toBookmarkSummary(bookmark: BookmarkRecord): Promise<BookmarkSummary | null> {
  const conversation = await getConversationOverviewById(bookmark.conversationId);
  if (!conversation) {
    return null;
  }

  let messagePreview: string | undefined;
  if (bookmark.messageId) {
    const message = await db.messages.get(bookmark.messageId);
    if (message) {
      messagePreview = sanitizePreview(message.content);
    }
  }

  return {
    id: bookmark.id,
    conversationId: bookmark.conversationId,
    conversationTitle: conversation.title,
    conversationPinned: conversation.pinned,
    createdAt: bookmark.createdAt,
    messageId: bookmark.messageId,
    messagePreview,
    note: bookmark.note
  } satisfies BookmarkSummary;
}

export async function getRecentBookmarks(limit = 10): Promise<BookmarkSummary[]> {
  const bookmarks = await db.bookmarks.orderBy('createdAt').reverse().limit(limit).toArray();
  const summaries = await Promise.all(bookmarks.map((bookmark) => toBookmarkSummary(bookmark)));
  return summaries.filter((bookmark): bookmark is BookmarkSummary => Boolean(bookmark));
}

export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const [conversations, bookmarks, jobs] = await Promise.all([
    db.conversations.orderBy('updatedAt').reverse().limit(limit).toArray(),
    db.bookmarks.orderBy('createdAt').reverse().limit(limit).toArray(),
    db.jobs.orderBy('updatedAt').reverse().limit(limit).toArray()
  ]);

  const [conversationItems, bookmarkItems] = await Promise.all([
    extendConversationsWithCounts(conversations),
    Promise.all(bookmarks.map((bookmark) => toBookmarkSummary(bookmark)))
  ]);

  const activity: ActivityItem[] = [];

  for (const conversation of conversationItems) {
    activity.push({
      kind: 'conversation',
      id: `conversation:${conversation.id}`,
      timestamp: conversation.updatedAt,
      conversation
    });
  }

  for (const bookmark of bookmarkItems) {
    if (!bookmark) {
      continue;
    }
    activity.push({
      kind: 'bookmark',
      id: `bookmark:${bookmark.id}`,
      timestamp: bookmark.createdAt,
      bookmark
    });
  }

  for (const job of jobs) {
    activity.push({
      kind: 'job',
      id: `job:${job.id}`,
      timestamp: job.updatedAt ?? job.createdAt,
      job: {
        id: `job:${job.id}`,
        jobId: job.id,
        type: job.type,
        status: job.status,
        runAt: job.runAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        lastRunAt: job.lastRunAt,
        lastError: job.lastError,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      }
    });
  }

  return activity
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, limit);
}
