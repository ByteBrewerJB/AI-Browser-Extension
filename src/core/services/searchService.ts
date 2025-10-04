import MiniSearch from 'minisearch';
import type { MetadataRecord } from '@/core/storage/db';
import { db } from '@/core/storage/db';
import type { ConversationRecord, MessageRecord } from '@/core/models';

interface SearchDocument {
  id: string;
  text: string;
  conversationId: string;
  title?: string;
}

const searchOptions = {
  fields: ['title', 'text'],
  storeFields: ['conversationId'],
  idField: 'id' as const,
};

const SEARCH_INDEX_METADATA_KEY = 'search:index';
const SEARCH_INDEX_VERSION = 1;

let searchIndex = createMiniSearch();
let indexReady = false;
let buildPromise: Promise<void> | null = null;

interface SearchIndexMetadataValue {
  version: number;
  index: string;
}

function isSearchIndexMetadata(
  record: MetadataRecord | undefined
): record is MetadataRecord<SearchIndexMetadataValue> {
  if (!record || typeof record.value !== 'object' || record.value === null) {
    return false;
  }

  const value = record.value as Partial<SearchIndexMetadataValue>;
  return typeof value.version === 'number' && typeof value.index === 'string';
}

function createMiniSearch() {
  return new MiniSearch<SearchDocument>(searchOptions);
}

async function persistIndex() {
  const record: MetadataRecord<SearchIndexMetadataValue> = {
    key: SEARCH_INDEX_METADATA_KEY,
    value: {
      version: SEARCH_INDEX_VERSION,
      index: JSON.stringify(searchIndex),
    },
    updatedAt: new Date().toISOString(),
  };

  await db.metadata.put(record);
}

async function restorePersistedIndex(): Promise<boolean> {
  const stored = await db.metadata.get(SEARCH_INDEX_METADATA_KEY);
  if (!isSearchIndexMetadata(stored)) {
    return false;
  }

  if (stored.value.version !== SEARCH_INDEX_VERSION) {
    return false;
  }

  try {
    searchIndex = await MiniSearch.loadJSONAsync<SearchDocument>(stored.value.index, searchOptions);
    return true;
  } catch (error) {
    console.warn('searchService: unable to restore persisted index, rebuilding', error);
    searchIndex = createMiniSearch();
    return false;
  }
}

async function rebuildIndexFromDatabase() {
  const conversations = await db.conversations.toArray();
  const messages = await db.messages.toArray();

  const documents: SearchDocument[] = [
    ...conversations.map(c => ({
      id: `conv:${c.id}`,
      text: c.title,
      title: c.title,
      conversationId: c.id,
    })),
    ...messages.map(m => ({
      id: `msg:${m.id}`,
      text: m.content,
      conversationId: m.conversationId,
    })),
  ];

  searchIndex = createMiniSearch();
  await searchIndex.addAllAsync(documents);
  await persistIndex();
}

export async function buildSearchIndex() {
  if (indexReady) return;

  if (!buildPromise) {
    buildPromise = (async () => {
      const restored = await restorePersistedIndex();
      if (!restored) {
        await rebuildIndexFromDatabase();
      }
      indexReady = true;
    })().catch(error => {
      indexReady = false;
      searchIndex = createMiniSearch();
      throw error;
    }).finally(() => {
      buildPromise = null;
    });
  }

  await buildPromise;
}

export async function search(query: string): Promise<string[]> {
  if (!indexReady) {
    await buildSearchIndex();
  }

  const results = searchIndex.search(query, { prefix: true, fuzzy: 0.2 });
  const conversationIds = new Set(results.map(r => r.conversationId));
  return Array.from(conversationIds);
}

export async function upsertIntoIndex(items: Array<ConversationRecord | MessageRecord>) {
  if (!indexReady) return;

  const documents: SearchDocument[] = items.map(item => {
    if ('title' in item) { // ConversationRecord
      return {
        id: `conv:${item.id}`,
        text: item.title,
        title: item.title,
        conversationId: item.id,
      };
    } else { // MessageRecord
      return {
        id: `msg:${item.id}`,
        text: item.content,
        conversationId: item.conversationId,
      };
    }
  });

  for (const doc of documents) {
    if (searchIndex.has(doc.id)) {
      searchIndex.replace(doc);
    } else {
      searchIndex.add(doc);
    }
  }

  await persistIndex();
}

export async function removeFromIndex(ids: string[]) {
  if (!indexReady || ids.length === 0) return;

  const messageIds = await db.messages
    .where('conversationId')
    .anyOf(ids)
    .primaryKeys();

  for (const id of ids) {
    searchIndex.discard(`conv:${id}`);
  }

  for (const messageId of messageIds) {
    searchIndex.discard(`msg:${messageId}`);
  }

  await persistIndex();
}

export function resetSearchServiceForTests() {
  searchIndex = createMiniSearch();
  indexReady = false;
  buildPromise = null;
}
