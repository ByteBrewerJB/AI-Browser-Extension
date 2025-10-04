import MiniSearch from 'minisearch';
import type { MetadataRecord } from '@/core/storage/db';
import { db } from '@/core/storage/db';
import type { ConversationRecord, MessageRecord } from '@/core/models';
import {
  type SearchDocument,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
  type SearchWorkerSuccessResponse,
} from '@/core/workers/searchIndexWorker.types';

const searchOptions = {
  fields: ['title', 'text'],
  storeFields: ['conversationId'],
  idField: 'id' as const,
};

const SEARCH_INDEX_METADATA_KEY = 'search:index';
const SEARCH_INDEX_VERSION = 1;

const supportsWorkerEnvironment =
  typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

let workerAvailable = supportsWorkerEnvironment;

let fallbackMiniSearch: MiniSearch<SearchDocument> | null = workerAvailable
  ? null
  : createMiniSearch();
let indexReady = false;
let buildPromise: Promise<void> | null = null;

let worker: Worker | null = null;
let requestId = 0;
const pendingWorkerRequests = new Map<
  number,
  {
    resolve: (response: SearchWorkerSuccessResponse) => void;
    reject: (error: Error) => void;
  }
>();

type WorkerAction = SearchWorkerRequest['action'];

type RequestForAction<TAction extends WorkerAction> = Extract<
  SearchWorkerRequest,
  { action: TAction }
>;

type ResponseForAction<TAction extends WorkerAction> = Extract<
  SearchWorkerSuccessResponse,
  { action: TAction }
>;

function createMiniSearch() {
  return new MiniSearch<SearchDocument>(searchOptions);
}

function isWorkerActive() {
  return workerAvailable;
}

function disableWorker(error?: unknown) {
  if (!workerAvailable) {
    return;
  }

  workerAvailable = false;

  if (error) {
    console.warn('searchService: disabling worker, falling back to main-thread indexing', error);
  }

  if (worker) {
    worker.terminate();
    worker = null;
  }

  if (pendingWorkerRequests.size > 0) {
    const fallbackError =
      error instanceof Error ? error : new Error('Search index worker disabled');
    for (const pending of pendingWorkerRequests.values()) {
      pending.reject(fallbackError);
    }
    pendingWorkerRequests.clear();
  }

  if (!fallbackMiniSearch) {
    fallbackMiniSearch = createMiniSearch();
  }
}

function ensureWorker(): Worker {
  if (!isWorkerActive()) {
    throw new Error('Web Workers are not supported in this environment.');
  }

  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/searchIndex.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (error) {
      disableWorker(error);
      throw error instanceof Error
        ? error
        : new Error('Search index worker could not be initialised.');
    }
  }

  worker.onmessage = event => {
    const response = event.data as SearchWorkerResponse;
    const pending = pendingWorkerRequests.get(response.id);
    if (!pending) {
      return;
    }

    pendingWorkerRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.error));
    }
  };

  worker.onerror = event => {
    const error = new Error(`Search index worker failed: ${event.message}`);
    disableWorker(error);
  };

  worker.onmessageerror = () => {
    const error = new Error('Search index worker failed to deserialize a message.');
    disableWorker(error);
  };

  return worker;
}

async function postToWorker<TAction extends WorkerAction>(
  action: TAction,
  payload: RequestForAction<TAction>['payload']
): Promise<ResponseForAction<TAction>> {
  const workerInstance = ensureWorker();
  const id = ++requestId;

  const request = {
    id,
    action,
    // TypeScript cannot infer the discriminated union when assigning dynamically.
    payload: payload as RequestForAction<WorkerAction>['payload'],
  } as SearchWorkerRequest;

  const responsePromise = new Promise<ResponseForAction<TAction>>((resolve, reject) => {
    pendingWorkerRequests.set(id, {
      resolve: resolve as (response: SearchWorkerSuccessResponse) => void,
      reject,
    });
  });

  try {
    workerInstance.postMessage(request satisfies SearchWorkerRequest);
  } catch (error) {
    pendingWorkerRequests.delete(id);
    disableWorker(error);
    throw error instanceof Error
      ? error
      : new Error('Search index worker could not receive a request.');
  }

  return responsePromise;
}

async function persistIndex(serializedIndex: string) {
  const record: MetadataRecord<{ version: number; index: string }> = {
    key: SEARCH_INDEX_METADATA_KEY,
    value: {
      version: SEARCH_INDEX_VERSION,
      index: serializedIndex,
    },
    updatedAt: new Date().toISOString(),
  };

  await db.metadata.put(record);
}

function isSearchIndexMetadata(
  record: MetadataRecord | undefined
): record is MetadataRecord<{ version: number; index: string }> {
  if (!record || typeof record.value !== 'object' || record.value === null) {
    return false;
  }

  const value = record.value as Partial<{ version: number; index: string }>;
  return typeof value.version === 'number' && typeof value.index === 'string';
}

async function initializeIndex(serializedIndex?: string | null) {
  if (isWorkerActive()) {
    try {
      await postToWorker('INIT', { serializedIndex: serializedIndex ?? null });
      return;
    } catch (error) {
      disableWorker(error);
    }
  }

  if (!serializedIndex) {
    fallbackMiniSearch = createMiniSearch();
    return;
  }

  fallbackMiniSearch = await MiniSearch.loadJSONAsync<SearchDocument>(serializedIndex, searchOptions);
}

async function restorePersistedIndex(): Promise<boolean> {
  const stored = await db.metadata.get(SEARCH_INDEX_METADATA_KEY);
  if (!isSearchIndexMetadata(stored)) {
    await initializeIndex();
    return false;
  }

  if (stored.value.version !== SEARCH_INDEX_VERSION) {
    await initializeIndex();
    return false;
  }

  try {
    await initializeIndex(stored.value.index);
    return true;
  } catch (error) {
    console.warn('searchService: unable to restore persisted index, rebuilding', error);
    await initializeIndex();
    return false;
  }
}

async function loadDocumentsFromDatabase(): Promise<SearchDocument[]> {
  const conversations = await db.conversations.toArray();
  const messages = await db.messages.toArray();

  return [
    ...conversations.map<SearchDocument>(c => ({
      id: `conv:${c.id}`,
      text: c.title,
      title: c.title,
      conversationId: c.id,
    })),
    ...messages.map<SearchDocument>(m => ({
      id: `msg:${m.id}`,
      text: m.content,
      conversationId: m.conversationId,
    })),
  ];
}

async function rebuildIndexFromDatabase() {
  const documents = await loadDocumentsFromDatabase();

  if (isWorkerActive()) {
    try {
      const response = await postToWorker('BUILD_FULL_INDEX', { documents });
      await persistIndex(response.result.serializedIndex);
      return;
    } catch (error) {
      disableWorker(error);
    }
  }

  fallbackMiniSearch = createMiniSearch();
  await fallbackMiniSearch.addAllAsync(documents);
  await persistIndex(JSON.stringify(fallbackMiniSearch));
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
    })()
      .catch(error => {
        indexReady = false;
        if (!isWorkerActive()) {
          fallbackMiniSearch = createMiniSearch();
        }
        throw error;
      })
      .finally(() => {
        buildPromise = null;
      });
  }

  await buildPromise;
}

export async function search(query: string): Promise<string[]> {
  if (!indexReady) {
    await buildSearchIndex();
  }

  if (isWorkerActive()) {
    try {
      const response = await postToWorker('SEARCH', { query });
      return response.result.conversationIds;
    } catch (error) {
      disableWorker(error);
    }
  }

  if (!fallbackMiniSearch) {
    return [];
  }

  const results = fallbackMiniSearch.search(query, { prefix: true, fuzzy: 0.2 });
  const conversationIds = new Set(results.map(r => r.conversationId));
  return Array.from(conversationIds);
}

export async function upsertIntoIndex(items: Array<ConversationRecord | MessageRecord>) {
  if (!indexReady || items.length === 0) return;

  const documents: SearchDocument[] = items.map(item => {
    if ('title' in item) {
      return {
        id: `conv:${item.id}`,
        text: item.title,
        title: item.title,
        conversationId: item.id,
      } satisfies SearchDocument;
    }

    return {
      id: `msg:${item.id}`,
      text: item.content,
      conversationId: item.conversationId,
    } satisfies SearchDocument;
  });

  if (isWorkerActive()) {
    try {
      const response = await postToWorker('UPSERT', { documents });
      await persistIndex(response.result.serializedIndex);
      return;
    } catch (error) {
      disableWorker(error);
    }
  }

  if (!fallbackMiniSearch) {
    return;
  }

  for (const doc of documents) {
    if (fallbackMiniSearch.has(doc.id)) {
      fallbackMiniSearch.replace(doc);
    } else {
      fallbackMiniSearch.add(doc);
    }
  }

  await persistIndex(JSON.stringify(fallbackMiniSearch));
}

export async function removeFromIndex(ids: string[]) {
  if (!indexReady || ids.length === 0) return;

  const messageIds = await db.messages
    .where('conversationId')
    .anyOf(ids)
    .primaryKeys();

  const documentIds = [
    ...ids.map(id => `conv:${id}`),
    ...messageIds.map(id => `msg:${String(id)}`),
  ];

  if (isWorkerActive()) {
    try {
      const response = await postToWorker('REMOVE', { documentIds });
      await persistIndex(response.result.serializedIndex);
      return;
    } catch (error) {
      disableWorker(error);
    }
  }

  if (!fallbackMiniSearch) {
    return;
  }

  for (const docId of documentIds) {
    fallbackMiniSearch.discard(docId);
  }

  await persistIndex(JSON.stringify(fallbackMiniSearch));
}
