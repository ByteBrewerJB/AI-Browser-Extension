import MiniSearch from 'minisearch';
import { db } from '@/core/storage/db';
import type { ConversationRecord, MessageRecord } from '@/core/models';

interface SearchDocument {
  id: string;
  text: string;
  conversationId: string;
  title?: string;
}

const miniSearch = new MiniSearch<SearchDocument>({
  fields: ['title', 'text'],
  storeFields: ['conversationId'],
  idField: 'id',
});

let indexReady = false;

export async function buildSearchIndex() {
  if (indexReady) return;

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

  await miniSearch.addAllAsync(documents);
  indexReady = true;
}

export async function search(query: string): Promise<string[]> {
  if (!indexReady) {
    await buildSearchIndex();
  }

  const results = miniSearch.search(query, { prefix: true, fuzzy: 0.2 });
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
    if (miniSearch.has(doc.id)) {
      await miniSearch.replace(doc);
    } else {
      await miniSearch.add(doc);
    }
  }
}

export async function removeFromIndex(ids: string[]) {
  if (!indexReady) return;

  // This is a simplified removal that only targets conversation documents.
  // A robust implementation would also need to remove all associated message documents.
  for (const id of ids) {
    await miniSearch.discard(`conv:${id}`);
  }
}