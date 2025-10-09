import Dexie, { Table } from 'dexie';
import type {
  BookmarkRecord,
  ConversationRecord,
  FolderItemRecord,
  FolderRecord,
  GPTRecord,
  JobRecord,
  MessageRecord,
  MediaItemRecord,
  PromptChainRecord,
  PromptRecord,
  SettingsRecord
} from '@/core/models';
import { createBookmarkPreview } from '@/core/utils/bookmarkPreview';

export interface MetadataRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

export interface EncryptionMetadataValue {
  /**
   * Highest Dexie schema version that has been migrated with encryption aware logic.
   */
  schemaVersion: number;
  /**
   * Version of the encryption format currently applied to IndexedDB rows.
   */
  dataVersion: number;
  /**
   * Timestamp of the last completed encryption sweep across tables.
   */
  lastMigrationAt?: string;
  /**
   * Flag indicating whether plaintext rows still need to be upgraded.
   */
  pending: boolean;
}

export type EncryptionMetadataRecord = MetadataRecord<EncryptionMetadataValue>;

export const ENCRYPTION_DATA_VERSION = 1;
export const ENCRYPTION_METADATA_KEY = 'encryption';

export class CompanionDatabase extends Dexie {
  conversations!: Table<ConversationRecord, string>;
  messages!: Table<MessageRecord, string>;
  gpts!: Table<GPTRecord, string>;
  prompts!: Table<PromptRecord, string>;
  promptChains!: Table<PromptChainRecord, string>;
  folders!: Table<FolderRecord, string>;
  folderItems!: Table<FolderItemRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  settings!: Table<SettingsRecord, string>;
  jobs!: Table<JobRecord, string>;
  metadata!: Table<MetadataRecord, string>;
  mediaItems!: Table<MediaItemRecord, string>;

  constructor() {
    super('AICompanionDB');

    this.version(1).stores({
      conversations: 'id, updatedAt, folderId, pinned, archived',
      messages: 'id, [conversationId+createdAt], conversationId, createdAt',
      gpts: 'id, folderId, updatedAt',
      prompts: 'id, folderId, updatedAt',
      promptChains: 'id, updatedAt',
      folders: 'id, parentId, kind',
      bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
      settings: 'id'
    });

    this.version(2)
      .stores({
        conversations: 'id, updatedAt, folderId, pinned, archived',
        messages: 'id, [conversationId+createdAt], conversationId, createdAt',
        gpts: 'id, folderId, updatedAt',
        prompts: 'id, folderId, gptId, updatedAt',
        promptChains: 'id, updatedAt',
        folders: 'id, parentId, kind',
        bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
        settings: 'id'
      })
      .upgrade(async (transaction) => {
        await transaction.table('prompts').toCollection().modify((prompt) => {
          if (prompt.description === '') {
            prompt.description = undefined;
          }
          if (prompt.gptId === '') {
            prompt.gptId = undefined;
          }
        });
      });

    this.version(3).stores({
      conversations: 'id, updatedAt, folderId, pinned, archived',
      messages: 'id, [conversationId+createdAt], conversationId, createdAt',
      gpts: 'id, folderId, updatedAt',
      prompts: 'id, folderId, gptId, updatedAt',
      promptChains: 'id, updatedAt',
      folders: 'id, parentId, kind',
      bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
      settings: 'id',
      jobs: 'id, status, runAt'
    });

    this.version(4).stores({
      conversations: 'id, updatedAt, folderId, pinned, archived',
      messages: 'id, [conversationId+createdAt], conversationId, createdAt',
      gpts: 'id, folderId, updatedAt',
      prompts: 'id, folderId, gptId, updatedAt',
      promptChains: 'id, updatedAt',
      folders: 'id, parentId, kind',
      bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
      settings: 'id',
      jobs: 'id, status, runAt',
      metadata: 'key'
    });

    this.version(5).stores({
      conversations: 'id, updatedAt, folderId, pinned, archived',
      messages: 'id, [conversationId+createdAt], conversationId, createdAt',
      gpts: 'id, folderId, updatedAt',
      prompts: 'id, folderId, gptId, updatedAt',
      promptChains: 'id, updatedAt',
      folders: 'id, parentId, kind',
      bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
      settings: 'id',
      jobs: 'id, status, runAt, updatedAt',
      metadata: 'key'
    });
    this.version(6)
      .stores({
        conversations: 'id, updatedAt, folderId, pinned, archived',
        messages: 'id, [conversationId+createdAt], conversationId, createdAt',
        gpts: 'id, folderId, updatedAt',
        prompts: 'id, folderId, gptId, updatedAt',
        promptChains: 'id, updatedAt',
        folders: 'id, parentId, kind, favorite',
        bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
        settings: 'id',
        jobs: 'id, status, runAt, updatedAt',
        metadata: 'key'
      })
      .upgrade(async (transaction) => {
        await transaction.table('folders').toCollection().modify((folder) => {
          if (typeof folder.favorite !== 'boolean') {
            folder.favorite = false;
          }
        });
      });

    this.version(7)
      .stores({
        conversations: 'id, updatedAt, folderId, pinned, archived',
        messages: 'id, [conversationId+createdAt], conversationId, createdAt',
        gpts: 'id, folderId, updatedAt',
        prompts: 'id, folderId, gptId, updatedAt',
        promptChains: 'id, updatedAt',
        folders: 'id, parentId, kind, favorite',
        bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
        settings: 'id',
        jobs: 'id, status, runAt, updatedAt',
        metadata: 'key'
      })
      .upgrade(async (transaction) => {
        const bookmarksTable = transaction.table<BookmarkRecord>('bookmarks');
        const messagesTable = transaction.table<MessageRecord>('messages');
        const conversationsTable = transaction.table<ConversationRecord>('conversations');

        const bookmarks = await bookmarksTable.toArray();

        for (const bookmark of bookmarks) {
          let preview = createBookmarkPreview(bookmark.messagePreview);

          if (!preview && bookmark.messageId) {
            const message = await messagesTable.get(bookmark.messageId);
            if (message?.content) {
              preview = createBookmarkPreview(message.content);
            } else {
              const conversation = await conversationsTable.get(bookmark.conversationId);
              preview = createBookmarkPreview(conversation?.title);
            }
          }

          if (preview || typeof bookmark.messagePreview === 'string') {
            await bookmarksTable.update(bookmark.id, { messagePreview: preview });
          }
        }
      });

    this.version(8)
      .stores({
        conversations: 'id, updatedAt, folderId, pinned, archived',
        messages: 'id, [conversationId+createdAt], conversationId, createdAt',
        gpts: 'id, folderId, updatedAt',
        prompts: 'id, folderId, gptId, updatedAt',
        promptChains: 'id, updatedAt',
        folders: 'id, parentId, kind, favorite',
        folderItems: 'id, folderId, itemType, itemId, &[itemType+itemId], [folderId+itemType], sortIndex',
        bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
        settings: 'id',
        jobs: 'id, status, runAt, updatedAt',
        metadata: 'key'
      })
      .upgrade(async (transaction) => {
        const now = new Date().toISOString();
        const folderItemsTable = transaction.table<FolderItemRecord>('folderItems');

        const [conversations, prompts, gpts] = await Promise.all([
          transaction.table<ConversationRecord>('conversations').toArray(),
          transaction.table<PromptRecord>('prompts').toArray(),
          transaction.table<GPTRecord>('gpts').toArray()
        ]);

        const records: FolderItemRecord[] = [];

        for (const conversation of conversations) {
          const folderId = conversation.folderId?.trim();
          if (!folderId) {
            continue;
          }
          records.push({
            id: crypto.randomUUID(),
            folderId,
            itemId: conversation.id,
            itemType: 'conversation',
            createdAt: conversation.createdAt ?? now,
            updatedAt: now
          });
        }

        for (const prompt of prompts) {
          const folderId = prompt.folderId?.trim();
          if (!folderId) {
            continue;
          }
          records.push({
            id: crypto.randomUUID(),
            folderId,
            itemId: prompt.id,
            itemType: 'prompt',
            createdAt: prompt.createdAt ?? now,
            updatedAt: now
          });
        }

        for (const gpt of gpts) {
          const folderId = gpt.folderId?.trim();
          if (!folderId) {
            continue;
          }
          records.push({
            id: crypto.randomUUID(),
            folderId,
            itemId: gpt.id,
            itemType: 'gpt',
            createdAt: gpt.createdAt ?? now,
            updatedAt: now
          });
        }

        if (records.length) {
          await folderItemsTable.bulkAdd(records);
        }
      });

    this.version(9).stores({
      conversations: 'id, updatedAt, folderId, pinned, archived',
      messages: 'id, [conversationId+createdAt], conversationId, createdAt',
      gpts: 'id, folderId, updatedAt',
      prompts: 'id, folderId, gptId, updatedAt',
      promptChains: 'id, updatedAt',
      folders: 'id, parentId, kind, favorite',
      folderItems: 'id, folderId, itemType, itemId, &[itemType+itemId], [folderId+itemType], sortIndex',
      bookmarks: 'id, [conversationId+messageId], conversationId, createdAt',
      settings: 'id',
      jobs: 'id, status, runAt, updatedAt',
      metadata: 'key',
      mediaItems: 'id, sortKey, type, [type+sortKey]'
    });
  }
}

export const db = new CompanionDatabase();

export async function resetDatabase() {
  await db.delete();
  await db.open();
}


