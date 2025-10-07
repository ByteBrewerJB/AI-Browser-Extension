import MiniSearch from 'minisearch';
import type { MetadataRecord } from '@/core/storage/db';
import { db } from '@/core/storage/db';
import type { ConversationRecord, FolderItemRecord, FolderRecord, MessageRecord } from '@/core/models';
import {
  type SearchDocument,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
  type SearchWorkerSuccessResponse,
} from '@/core/workers/searchIndexWorker.types';

const searchOptions = {
  fields: ['title', 'text', 'tags', 'folderPath'],
  storeFields: ['conversationId'],
  idField: 'id' as const,
};

const SEARCH_INDEX_METADATA_KEY = 'search:index';
const SEARCH_INDEX_VERSION = 2;

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

type ConversationFolderContext = {
  folderById: Map<string, FolderRecord>;
  membershipByConversationId: Map<string, Set<string>>;
  pathCache: Map<string, string | undefined>;
};

type ConversationDocumentOptions = {
  conversations: ConversationRecord[];
  folders?: FolderRecord[];
  folderItems?: FolderItemRecord[];
};

function formatTagsForIndex(tags?: string[]) {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const tokens = new Set<string>();

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }
    const lowered = trimmed.toLowerCase();
    tokens.add(trimmed);
    tokens.add(lowered);
    tokens.add(`tag:${lowered}`);
  }

  if (tokens.size === 0) {
    return undefined;
  }

  return Array.from(tokens).join(' ');
}

function buildConversationFolderContext(
  folders: FolderRecord[],
  folderItems: FolderItemRecord[]
): ConversationFolderContext {
  const folderById = new Map<string, FolderRecord>();
  for (const folder of folders) {
    if (folder.kind !== 'conversation') {
      continue;
    }
    folderById.set(folder.id, folder);
  }

  const membershipByConversationId = new Map<string, Set<string>>();
  for (const item of folderItems) {
    if (item.itemType !== 'conversation') {
      continue;
    }
    if (!folderById.has(item.folderId)) {
      continue;
    }

    let set = membershipByConversationId.get(item.itemId);
    if (!set) {
      set = new Set<string>();
      membershipByConversationId.set(item.itemId, set);
    }
    set.add(item.folderId);
  }

  return {
    folderById,
    membershipByConversationId,
    pathCache: new Map<string, string | undefined>(),
  } satisfies ConversationFolderContext;
}

function resolveFolderPath(folderId: string, context: ConversationFolderContext) {
  if (context.pathCache.has(folderId)) {
    return context.pathCache.get(folderId);
  }

  const folder = context.folderById.get(folderId);
  if (!folder) {
    context.pathCache.set(folderId, undefined);
    return undefined;
  }

  const segments: string[] = [];
  const visited = new Set<string>();
  let current: FolderRecord | undefined = folder;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    segments.unshift(current.name);
    if (!current.parentId) {
      break;
    }
    const parent = context.folderById.get(current.parentId);
    if (!parent) {
      break;
    }
    current = parent;
  }

  const path = segments.join(' / ');
  const normalized = path.length > 0 ? path : undefined;
  context.pathCache.set(folderId, normalized);
  return normalized;
}

function collectFolderPaths(conversation: ConversationRecord, context: ConversationFolderContext) {
  const folderIds = new Set<string>();
  const direct = conversation.folderId?.trim();
  if (direct && context.folderById.has(direct)) {
    folderIds.add(direct);
  }

  const pivotMembership = context.membershipByConversationId.get(conversation.id);
  if (pivotMembership) {
    for (const folderId of pivotMembership) {
      folderIds.add(folderId);
    }
  }

  const paths = new Set<string>();
  for (const folderId of folderIds) {
    const path = resolveFolderPath(folderId, context);
    if (path) {
      paths.add(path);
    }
  }

  return Array.from(paths);
}

function buildConversationDocument(
  conversation: ConversationRecord,
  context: ConversationFolderContext
): SearchDocument {
  const tags = formatTagsForIndex(conversation.tags);
  const folderPaths = collectFolderPaths(conversation, context);
  const folderPath = folderPaths.length > 0 ? folderPaths.join(' | ') : undefined;

  const textParts = [conversation.title, tags, folderPath].filter(Boolean);

  return {
    id: `conv:${conversation.id}`,
    text: textParts.join(' '),
    title: conversation.title,
    conversationId: conversation.id,
    tags,
    folderPath,
  } satisfies SearchDocument;
}

async function createConversationDocuments({
  conversations,
  folders,
  folderItems,
}: ConversationDocumentOptions): Promise<SearchDocument[]> {
  if (conversations.length === 0) {
    return [];
  }

  const foldersPromise = folders
    ? Promise.resolve(folders)
    : db.folders.where('kind').equals('conversation').toArray();

  const folderItemsPromise = folderItems
    ? Promise.resolve(folderItems)
    : conversations.length === 0
    ? Promise.resolve([] as FolderItemRecord[])
    : db.folderItems
        .where('[itemType+itemId]')
        .anyOf(conversations.map((conversation) => ['conversation', conversation.id] as const))
        .toArray();

  const [resolvedFolders, resolvedFolderItems] = await Promise.all([
    foldersPromise,
    folderItemsPromise,
  ]);

  const context = buildConversationFolderContext(resolvedFolders, resolvedFolderItems);
  return conversations.map((conversation) => buildConversationDocument(conversation, context));
}

function createMessageDocument(message: MessageRecord): SearchDocument {
  return {
    id: `msg:${message.id}`,
    text: message.content,
    conversationId: message.conversationId,
  } satisfies SearchDocument;
}

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
  const wasIndexReady = indexReady;
  indexReady = false;
  fallbackMiniSearch = null;
  buildPromise = null;

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

  if (wasIndexReady) {
    void buildSearchIndex().catch(rebuildError => {
      console.error('searchService: failed to rebuild search index after disabling worker', rebuildError);
    });
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
  const [conversations, messages, folders, folderItems] = await Promise.all([
    db.conversations.toArray(),
    db.messages.toArray(),
    db.folders.where('kind').equals('conversation').toArray(),
    db.folderItems.where('itemType').equals('conversation').toArray(),
  ]);

  const [conversationDocuments, messageDocuments] = await Promise.all([
    createConversationDocuments({
      conversations,
      folders,
      folderItems,
    }),
    Promise.resolve(messages.map(createMessageDocument)),
  ]);

  return [...conversationDocuments, ...messageDocuments];
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
      await buildSearchIndex();
    }
  }

  if (!indexReady) {
    return [];
  }

  if (!fallbackMiniSearch) {
    return [];
  }

  const results = fallbackMiniSearch.search(query, { prefix: true, fuzzy: 0.2 });
  const conversationIds = new Set(results.map(r => r.conversationId));
  return Array.from(conversationIds);
}

export async function upsertIntoIndex(items: Array<ConversationRecord | MessageRecord>) {
  if (items.length === 0) return;

  if (!indexReady) {
    await buildSearchIndex();
  }

  if (!indexReady) return;

  const conversationItems: ConversationRecord[] = [];
  const messageItems: MessageRecord[] = [];

  for (const item of items) {
    if ('title' in item) {
      conversationItems.push(item);
    } else {
      messageItems.push(item);
    }
  }

  const documents: SearchDocument[] = [];

  if (conversationItems.length > 0) {
    const conversationDocs = await createConversationDocuments({ conversations: conversationItems });
    documents.push(...conversationDocs);
  }

  if (messageItems.length > 0) {
    documents.push(...messageItems.map(createMessageDocument));
  }

  if (documents.length === 0) {
    return;
  }

  if (isWorkerActive()) {
    try {
      const response = await postToWorker('UPSERT', { documents });
      await persistIndex(response.result.serializedIndex);
      return;
    } catch (error) {
      disableWorker(error);
      await buildSearchIndex();
    }
  }

  if (!indexReady) {
    return;
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
  if (ids.length === 0) return;

  if (!indexReady) {
    await buildSearchIndex();
  }

  if (!indexReady) return;

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
      await buildSearchIndex();
    }
  }

  if (!indexReady) {
    return;
  }

  if (!fallbackMiniSearch) {
    return;
  }

  for (const docId of documentIds) {
    fallbackMiniSearch.discard(docId);
  }

  await persistIndex(JSON.stringify(fallbackMiniSearch));
}

export async function __resetSearchServiceForTests() {
  if (worker) {
    worker.terminate();
    worker = null;
  }

  pendingWorkerRequests.clear();
  requestId = 0;
  workerAvailable = supportsWorkerEnvironment;
  fallbackMiniSearch = workerAvailable ? null : createMiniSearch();
  indexReady = false;
  buildPromise = null;

  try {
    const metadataTable = db.metadata as unknown as {
      delete?: (key: string) => Promise<unknown>;
      clear?: () => Promise<unknown>;
    };

    if (typeof metadataTable.delete === 'function') {
      await metadataTable.delete(SEARCH_INDEX_METADATA_KEY);
    } else if (typeof metadataTable.clear === 'function') {
      await metadataTable.clear();
    }
  } catch {
    // Ignore metadata reset failures in tests.
  }
}
