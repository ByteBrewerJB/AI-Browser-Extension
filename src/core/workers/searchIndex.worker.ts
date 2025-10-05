/// <reference lib="webworker" />

import MiniSearch from 'minisearch';
import {
  type SearchDocument,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
} from './searchIndexWorker.types';

const searchOptions = {
  fields: ['title', 'text', 'tags', 'folderPath'],
  storeFields: ['conversationId'],
  idField: 'id' as const,
};

let miniSearch = createMiniSearch();

function createMiniSearch() {
  return new MiniSearch<SearchDocument>(searchOptions);
}

async function handleInit(serializedIndex?: string | null) {
  if (!serializedIndex) {
    miniSearch = createMiniSearch();
    return;
  }

  miniSearch = await MiniSearch.loadJSONAsync<SearchDocument>(serializedIndex, searchOptions);
}

async function handleBuildFullIndex(documents: SearchDocument[]) {
  miniSearch = createMiniSearch();
  await miniSearch.addAllAsync(documents);
  return JSON.stringify(miniSearch);
}

async function handleUpsert(documents: SearchDocument[]) {
  for (const doc of documents) {
    if (miniSearch.has(doc.id)) {
      miniSearch.replace(doc);
    } else {
      miniSearch.add(doc);
    }
  }

  return JSON.stringify(miniSearch);
}

async function handleRemove(documentIds: string[]) {
  for (const id of documentIds) {
    miniSearch.discard(id);
  }

  return JSON.stringify(miniSearch);
}

function handleSearch(query: string) {
  const results = miniSearch.search(query, { prefix: true, fuzzy: 0.2 });
  const conversationIds = Array.from(new Set(results.map(result => result.conversationId)));
  return conversationIds;
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data as SearchWorkerRequest;
  const { id, action } = message;

  try {
    let response: SearchWorkerResponse;

    switch (action) {
      case 'INIT': {
        await handleInit(message.payload.serializedIndex);
        response = { id, action, success: true, result: { ready: true } };
        break;
      }
      case 'BUILD_FULL_INDEX': {
        const serializedIndex = await handleBuildFullIndex(message.payload.documents);
        response = { id, action, success: true, result: { serializedIndex } };
        break;
      }
      case 'UPSERT': {
        const serializedIndex = await handleUpsert(message.payload.documents);
        response = { id, action, success: true, result: { serializedIndex } };
        break;
      }
      case 'REMOVE': {
        const serializedIndex = await handleRemove(message.payload.documentIds);
        response = { id, action, success: true, result: { serializedIndex } };
        break;
      }
      case 'SEARCH': {
        const conversationIds = handleSearch(message.payload.query);
        response = { id, action, success: true, result: { conversationIds } };
        break;
      }
      default: {
        throw new Error(`Unsupported action: ${action satisfies never}`);
      }
    }

    self.postMessage(response satisfies SearchWorkerResponse);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown worker error';
    self.postMessage({ id, success: false, error: errorMessage });
  }
};
