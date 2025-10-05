import type {
  BookmarkRecord,
  ConversationRecord,
  FolderItemRecord,
  MessageRecord,
  PromptChainRecord
} from '@/core/models';

export const ENCRYPTION_DATA_VERSION = 1;
export const ENCRYPTION_METADATA_KEY = 'encryption';

type RecordWithId = { id: string };

type WhereResult<T extends RecordWithId> = {
  count(): Promise<number>;
  toArray(): Promise<T[]>;
  delete(): Promise<void>;
  and(predicate: (item: T) => boolean): WhereResult<T>;
  first(): Promise<T | undefined>;
};

type WhereQuery<T extends RecordWithId> = {
  equals(value: unknown): WhereResult<T>;
  anyOf(values: readonly unknown[]): WhereResult<T>;
};

type OrderQuery<T extends RecordWithId> = {
  reverse(): {
    limit(limit: number): { toArray(): Promise<T[]> };
    toArray(): Promise<T[]>;
  };
  toArray(): Promise<T[]>;
};

type MutableTable<T extends RecordWithId> = {
  add(record: T): Promise<string>;
  put(record: T): Promise<string>;
  bulkPut(records: T[]): Promise<void>;
  get(id: string): Promise<T | undefined>;
  update(id: string, changes: Partial<T>): Promise<number>;
  bulkUpdate(updates: { key: string; changes: Partial<T> }[]): Promise<void>;
  bulkDelete(ids: string[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  where<K extends keyof T>(field: K): WhereQuery<T>;
  orderBy<K extends keyof T>(field: K): OrderQuery<T>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createWhereResult<T extends RecordWithId>(
  table: InMemoryTable<T>,
  items: T[]
): WhereResult<T> {
  return {
    async count() {
      return items.length;
    },
    async toArray() {
      return items.map((item) => clone(item));
    },
    async delete() {
      for (const item of items) {
        table.deleteSync(item.id);
      }
    },
    and(predicate: (item: T) => boolean) {
      const filtered = items.filter((item) => predicate(item));
      return createWhereResult(table, filtered);
    },
    async first() {
      const [first] = items;
      return first ? clone(first) : undefined;
    }
  };
}

class InMemoryTable<T extends RecordWithId> implements MutableTable<T> {
  protected store = new Map<string, T>();

  constructor(private readonly sortFallback: keyof T | null = null) {}

  async add(record: T) {
    return this.put(record);
  }

  async put(record: T) {
    const existing = this.store.get(record.id);
    const cloned = clone(record);
    if (existing) {
      const existingAny = existing as Record<string, any>;
      const clonedAny = cloned as Record<string, any>;
      if ('wordCount' in clonedAny && 'wordCount' in existingAny && clonedAny.wordCount === 0 && existingAny.wordCount > 0) {
        clonedAny.wordCount = existingAny.wordCount;
      }
      if ('charCount' in clonedAny && 'charCount' in existingAny && clonedAny.charCount === 0 && existingAny.charCount > 0) {
        clonedAny.charCount = existingAny.charCount;
      }
      if ('createdAt' in clonedAny && clonedAny.createdAt === undefined) {
        clonedAny.createdAt = existingAny.createdAt;
      }
      this.store.set(record.id, { ...existing, ...clonedAny } as T);
    } else {
      this.store.set(record.id, cloned);
    }
    return record.id;
  }

  async bulkPut(records: T[]) {
    for (const record of records) {
      await this.put(record);
    }
  }

  async get(id: string) {
    const record = this.store.get(id);
    return record ? clone(record) : undefined;
  }

  async update(id: string, changes: Partial<T>) {
    const current = this.store.get(id);
    if (!current) {
      return 0;
    }
    this.store.set(id, { ...current, ...clone(changes) } as T);
    return 1;
  }

  async bulkUpdate(updates: { key: string; changes: Partial<T> }[]) {
    for (const { key, changes } of updates) {
      const current = this.store.get(key);
      if (!current) continue;
      this.store.set(key, { ...current, ...clone(changes) } as T);
    }
  }

  async bulkDelete(ids: string[]) {
    ids.forEach((id) => this.store.delete(id));
  }

  async delete(id: string) {
    this.store.delete(id);
  }

  deleteSync(id: string) {
    this.store.delete(id);
  }

  async clear() {
    this.store.clear();
  }

  where<K extends keyof T>(field: K): WhereQuery<T> {
    return {
      equals: (value: unknown) => {
        const items = [...this.store.values()].filter((item) => (item as any)[field] === value);
        return createWhereResult(this, items);
      },
      anyOf: (values: readonly unknown[]) => {
        const set = new Set(values);
        const items = [...this.store.values()].filter((item) => set.has((item as any)[field]));
        return createWhereResult(this, items);
      }
    };
  }

  orderBy<K extends keyof T>(field: K): OrderQuery<T> {
    const sortField = field;
    const fallback = this.sortFallback;

    const sortValues = () =>
      [...this.store.values()].sort((a, b) => {
        const aValue = (a as any)[sortField] ?? (fallback ? (a as any)[fallback] : undefined);
        const bValue = (b as any)[sortField] ?? (fallback ? (b as any)[fallback] : undefined);
        if (aValue === bValue) return 0;
        return aValue > bValue ? 1 : -1;
      });

    return {
      reverse: () => ({
        limit: (limit: number) => ({
          toArray: async () => {
            return sortValues()
              .reverse()
              .slice(0, limit)
              .map((item) => clone(item));
          }
        }),
        toArray: async () => {
          return sortValues()
            .reverse()
            .map((item) => clone(item));
        }
      }),
      toArray: async () => {
        return sortValues().map((item) => clone(item));
      }
    };
  }

  async toArray() {
    return [...this.store.values()].map((item) => clone(item));
  }
}

class BookmarkTable extends InMemoryTable<BookmarkRecord> {
  constructor() {
    super('createdAt');
  }
}

class MessageTable extends InMemoryTable<MessageRecord> {
  constructor() {
    super('createdAt');
  }
}

class ConversationTable extends InMemoryTable<ConversationRecord> {
  constructor() {
    super('updatedAt');
  }
}

class PromptChainTable extends InMemoryTable<PromptChainRecord> {
  constructor() {
    super('updatedAt');
  }
}

class FolderItemsTable extends InMemoryTable<FolderItemRecord> {
  constructor() {
    super('updatedAt');
  }

  override where(field: keyof FolderItemRecord | '[itemType+itemId]'): WhereQuery<FolderItemRecord> {
    if (field === '[itemType+itemId]') {
      return {
        equals: (value: unknown) => {
          const [itemType, itemId] = Array.isArray(value) ? value : [];
          const items = [...this.store.values()].filter(
            (item) => item.itemType === itemType && item.itemId === itemId
          );
          return createWhereResult(this, items);
        },
        anyOf: (values: readonly unknown[]) => {
          const normalized = values
            .map((value) => (Array.isArray(value) ? value : []))
            .filter((entry): entry is [FolderItemRecord['itemType'], string] => entry.length === 2);
          const items = [...this.store.values()].filter((item) =>
            normalized.some(([type, id]) => item.itemType === type && item.itemId === id)
          );
          return createWhereResult(this, items);
        }
      } satisfies WhereQuery<FolderItemRecord>;
    }

    return super.where(field as keyof FolderItemRecord);
  }
}

type MetadataRecord = {
  key: string;
  value: unknown;
  updatedAt: string;
};

class MetadataTable {
  private store = new Map<string, MetadataRecord>();

  async get(key: string) {
    const record = this.store.get(key);
    return record ? clone(record) : undefined;
  }

  async put(record: MetadataRecord) {
    this.store.set(record.key, clone(record));
  }

  async clear() {
    this.store.clear();
  }
}

const conversations = new ConversationTable();
const messages = new MessageTable();
const bookmarks = new BookmarkTable();
const promptChains = new PromptChainTable();
const folderItems = new FolderItemsTable();
const metadata = new MetadataTable();

export const db = {
  conversations,
  messages,
  bookmarks,
  promptChains,
  folderItems,
  metadata,
  async transaction(_mode: string, ...args: unknown[]) {
    const maybeCallback = args[args.length - 1];
    if (typeof maybeCallback === 'function') {
      await (maybeCallback as () => Promise<unknown>)();
    }
  }
};

export async function resetDatabase() {
  await Promise.all([
    conversations.clear(),
    messages.clear(),
    bookmarks.clear(),
    promptChains.clear(),
    folderItems.clear(),
    metadata.clear()
  ]);
}

export const __stores = {
  conversations,
  messages,
  bookmarks,
  promptChains,
  folderItems,
  metadata
};
