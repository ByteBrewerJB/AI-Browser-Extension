import { db } from './db';
import type { PromptChainRecord } from '@/core/models';

type PromptChainTable = {
  put(record: PromptChainRecord): Promise<unknown>;
  update(id: string, changes: Partial<PromptChainRecord>): Promise<unknown>;
  delete(id: string): Promise<void>;
  orderBy(index: string): {
    reverse(): {
      toArray(): Promise<PromptChainRecord[]>;
    };
  };
  get(id: string): Promise<PromptChainRecord | undefined>;
};

const memoryStore = new Map<string, PromptChainRecord>();

function createMemoryPromptChainTable(): PromptChainTable {
  return {
    async put(record) {
      memoryStore.set(record.id, { ...record });
      return record.id;
    },
    async update(id, changes) {
      const current = memoryStore.get(id);
      if (!current) {
        return 0;
      }
      memoryStore.set(id, { ...current, ...changes });
      return 1;
    },
    async delete(id) {
      memoryStore.delete(id);
    },
    orderBy() {
      return {
        reverse() {
          return {
            async toArray() {
              return [...memoryStore.values()].sort((a, b) =>
                a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
              );
            }
          };
        }
      };
    },
    async get(id) {
      const record = memoryStore.get(id);
      return record ? { ...record } : undefined;
    }
  };
}

const usingMemoryStore = typeof indexedDB === 'undefined';
const promptChainTable: PromptChainTable = usingMemoryStore
  ? createMemoryPromptChainTable()
  : (db.promptChains as unknown as PromptChainTable);

function nowIso() {
  return new Date().toISOString();
}

function sanitizeNodeIds(nodeIds: readonly string[] | undefined) {
  if (!nodeIds || nodeIds.length === 0) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const rawId of nodeIds) {
    const trimmed = rawId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  return cleaned;
}

export interface CreatePromptChainInput {
  name: string;
  nodeIds?: readonly string[];
}

export interface UpdatePromptChainInput {
  id: string;
  name?: string;
  nodeIds?: readonly string[];
}

export async function createPromptChain(input: CreatePromptChainInput) {
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error('Prompt chain name is required');
  }

  const timestamp = nowIso();
  const record: PromptChainRecord = {
    id: crypto.randomUUID(),
    name: trimmedName,
    nodeIds: sanitizeNodeIds(input.nodeIds),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await promptChainTable.put(record);
  return record;
}

export async function updatePromptChain(input: UpdatePromptChainInput) {
  const changes: Partial<PromptChainRecord> = {
    updatedAt: nowIso()
  };

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Prompt chain name is required');
    }
    changes.name = trimmedName;
  }

  if (input.nodeIds !== undefined) {
    changes.nodeIds = sanitizeNodeIds(input.nodeIds);
  }

  await promptChainTable.update(input.id, changes);
}

export async function deletePromptChain(id: string) {
  await promptChainTable.delete(id);
}

export async function listPromptChains() {
  return promptChainTable.orderBy('updatedAt').reverse().toArray();
}

export async function getPromptChainById(id: string) {
  return promptChainTable.get(id);
}

export async function reorderPromptChainNodes(id: string, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return;
  }

  const chain = await promptChainTable.get(id);
  if (!chain) {
    throw new Error('Prompt chain not found');
  }

  const { nodeIds } = chain;
  if (fromIndex < 0 || fromIndex >= nodeIds.length || toIndex < 0 || toIndex >= nodeIds.length) {
    throw new Error('Prompt chain reorder indices out of range');
  }

  const updated = [...nodeIds];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);

  await updatePromptChain({
    id,
    nodeIds: updated
  });
}

export async function __resetPromptChainStoreForTests() {
  if (usingMemoryStore) {
    memoryStore.clear();
    return;
  }

  await db.promptChains.clear();
}
