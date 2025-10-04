import Dexie, { Table } from 'dexie';
import type {
  BookmarkRecord,
  ConversationRecord,
  FolderRecord,
  GPTRecord,
  JobRecord,
  MessageRecord,
  PromptChainRecord,
  PromptRecord,
  SettingsRecord
} from '@/core/models';

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
  bookmarks!: Table<BookmarkRecord, string>;
  settings!: Table<SettingsRecord, string>;
  jobs!: Table<JobRecord, string>;

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
  }
}

export const db = new CompanionDatabase();

export async function resetDatabase() {
  await db.delete();
  await db.open();
}
