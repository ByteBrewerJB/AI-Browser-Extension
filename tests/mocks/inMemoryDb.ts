import type {
  BookmarkRecord,
  ConversationRecord,
  FolderItemRecord,
  FolderRecord,
  MediaItemRecord,
  MessageRecord,
  PromptChainRecord
} from '@/core/models';

export const ENCRYPTION_DATA_VERSION = 1;
export const ENCRYPTION_METADATA_KEY = 'encryption';

type RecordWithId = { id: string };

type LimitedResult<T extends RecordWithId> = {
  toArray(): Promise<T[]>;
};

type DirectionalResult<T extends RecordWithId> = {
  limit(limit: number): LimitedResult<T>;
  toArray(): Promise<T[]>;
};

type WhereResult<T extends RecordWithId> = {
  count(): Promise<number>;
  toArray(): Promise<T[]>;
  delete(): Promise<void>;
  and(predicate: (item: T) => boolean): WhereResult<T>;
  first(): Promise<T | undefined>;
  reverse(): DirectionalResult<T>;
  limit(limit: number): LimitedResult<T>;
};

type WhereQuery<T extends RecordWithId> = {
  equals(value: unknown): WhereResult<T>;
  anyOf(values: readonly unknown[]): WhereResult<T>;
  below(value: unknown): WhereResult<T>;
  between(
    lower: unknown,
    upper: unknown,
    includeLower?: boolean,
    includeUpper?: boolean
  ): WhereResult<T>;
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
  count(): Promise<number>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createWhereResult<T extends RecordWithId>(
  table: InMemoryTable<T>,
  items: T[],
  sortField?: keyof T
): WhereResult<T> {
  const sortAscending = () => table.sortItems(items, sortField, false);
  const sortDescending = () => table.sortItems(items, sortField, true);

  return {
    async count() {
      return items.length;
    },
    async toArray() {
      return sortAscending();
    },
    async delete() {
      for (const item of items) {
        table.deleteSync(item.id);
      }
    },
    and(predicate: (item: T) => boolean) {
      const filtered = items.filter((item) => predicate(item));
      return createWhereResult(table, filtered, sortField);
    },
    async first() {
      const [first] = sortAscending();
      return first ?? undefined;
    },
    reverse() {
      return {
        limit(limit: number) {
          return {
            async toArray() {
              return sortDescending().slice(0, limit);
            }
          } satisfies LimitedResult<T>;
        },
        async toArray() {
          return sortDescending();
        }
      } satisfies DirectionalResult<T>;
    },
    limit(limit: number) {
      return {
        async toArray() {
          return sortAscending().slice(0, limit);
        }
      } satisfies LimitedResult<T>;
    }
  };
}

class InMemoryTable<T extends RecordWithId> implements MutableTable<T> {
  protected store = new Map<string, T>();

  constructor(private readonly sortFallback: keyof T | null = null) {}

  private resolveSortValue(item: T, field?: keyof T) {
    if (field) {
      const value = (item as Record<string, unknown>)[field as string];
      if (value !== undefined) {
        return value;
      }
    }

    if (this.sortFallback) {
      return (item as Record<string, unknown>)[this.sortFallback as string];
    }

    return field ? (item as Record<string, unknown>)[field as string] : undefined;
  }

  sortItems(items: T[], sortField?: keyof T, descending = false) {
    const sorted = [...items].sort((a, b) => {
      const aValue = this.resolveSortValue(a, sortField);
      const bValue = this.resolveSortValue(b, sortField);

      if (aValue === bValue) {
        return 0;
      }

      if (aValue == null) {
        return 1;
      }

      if (bValue == null) {
        return -1;
      }

      return aValue > bValue ? 1 : -1;
    });

    if (descending) {
      sorted.reverse();
    }

    return sorted.map((item) => clone(item));
  }

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

  async count() {
    return this.store.size;
  }

  where<K extends keyof T>(field: K): WhereQuery<T> {
    const values = () => [...this.store.values()];
    const toNumber = (value: unknown, fallback: number) =>
      typeof value === 'number' ? value : fallback;

    return {
      equals: (value: unknown) => {
        const items = values().filter((item) => (item as any)[field] === value);
        return createWhereResult(this, items, field);
      },
      anyOf: (incoming: readonly unknown[]) => {
        const set = new Set(incoming);
        const items = values().filter((item) => set.has((item as any)[field]));
        return createWhereResult(this, items, field);
      },
      below: (value: unknown) => {
        const upper = toNumber(value, Number.POSITIVE_INFINITY);
        const items = values().filter((item) => {
          const current = (item as any)[field];
          return typeof current === 'number' && current < upper;
        });
        return createWhereResult(this, items, field);
      },
      between: (
        lower: unknown,
        upper: unknown,
        includeLower = true,
        includeUpper = true
      ) => {
        const lowerBound = toNumber(lower, Number.NEGATIVE_INFINITY);
        const upperBound = toNumber(upper, Number.POSITIVE_INFINITY);
        const items = values().filter((item) => {
          const current = (item as any)[field];
          if (typeof current !== 'number') {
            return false;
          }
          const lowerPass = includeLower ? current >= lowerBound : current > lowerBound;
          const upperPass = includeUpper ? current <= upperBound : current < upperBound;
          return lowerPass && upperPass;
        });
        return createWhereResult(this, items, field);
      }
    } satisfies WhereQuery<T>;
  }

  orderBy<K extends keyof T>(field: K): OrderQuery<T> {
    const sortField = field;
    const values = () => [...this.store.values()];

    return {
      reverse: () => ({
        limit: (limit: number) => ({
          toArray: async () => {
            return this.sortItems(values(), sortField, true).slice(0, limit);
          }
        }),
        toArray: async () => {
          return this.sortItems(values(), sortField, true);
        }
      }),
      toArray: async () => {
        return this.sortItems(values(), sortField, false);
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

class MediaItemsTable extends InMemoryTable<MediaItemRecord> {
  constructor() {
    super('sortKey');
  }

  override where(field: keyof MediaItemRecord | '[type+sortKey]'): WhereQuery<MediaItemRecord> {
    if (field === '[type+sortKey]') {
      const values = () => [...this.store.values()];

      return {
        equals: (value: unknown) => {
          const [type, sortKey] = Array.isArray(value) ? value : [];
          const items = values().filter(
            (item) => item.type === type && item.sortKey === sortKey
          );
          return createWhereResult(this, items, 'sortKey');
        },
        anyOf: (incoming: readonly unknown[]) => {
          const normalized = incoming
            .map((value) => (Array.isArray(value) ? value : []))
            .filter((entry): entry is [MediaItemRecord['type'], number] => entry.length === 2);
          const items = values().filter((item) =>
            normalized.some(([type, sortKey]) => item.type === type && item.sortKey === sortKey)
          );
          return createWhereResult(this, items, 'sortKey');
        },
        below: (value: unknown) => {
          if (!Array.isArray(value) || value.length < 2) {
            return createWhereResult(this, [], 'sortKey');
          }
          const [type, sortKey] = value as [MediaItemRecord['type'], number];
          const items = values().filter(
            (item) => item.type === type && item.sortKey < sortKey
          );
          return createWhereResult(this, items, 'sortKey');
        },
        between: (
          lower: unknown,
          upper: unknown,
          includeLower = true,
          includeUpper = true
        ) => {
          const lowerTuple = Array.isArray(lower) ? lower : [];
          const upperTuple = Array.isArray(upper) ? upper : [];
          const type = (lowerTuple[0] ?? upperTuple[0]) as MediaItemRecord['type'] | undefined;
          if (!type) {
            return createWhereResult(this, [], 'sortKey');
          }

          const lowerValue =
            typeof lowerTuple[1] === 'number' ? lowerTuple[1] : Number.NEGATIVE_INFINITY;
          const upperValue =
            typeof upperTuple[1] === 'number' ? upperTuple[1] : Number.POSITIVE_INFINITY;

          const items = values().filter((item) => {
            if (item.type !== type) {
              return false;
            }

            const current = item.sortKey;
            const lowerPass = includeLower ? current >= lowerValue : current > lowerValue;
            const upperPass = includeUpper ? current <= upperValue : current < upperValue;
            return lowerPass && upperPass;
          });

          return createWhereResult(this, items, 'sortKey');
        }
      } satisfies WhereQuery<MediaItemRecord>;
    }

    return super.where(field as keyof MediaItemRecord);
  }
}

class ConversationTable extends InMemoryTable<ConversationRecord> {
  constructor() {
    super('updatedAt');
  }
}

class FolderTable extends InMemoryTable<FolderRecord> {
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
          return createWhereResult(this, items, 'updatedAt');
        },
        anyOf: (values: readonly unknown[]) => {
          const normalized = values
            .map((value) => (Array.isArray(value) ? value : []))
            .filter((entry): entry is [FolderItemRecord['itemType'], string] => entry.length === 2);
          const items = [...this.store.values()].filter((item) =>
            normalized.some(([type, id]) => item.itemType === type && item.itemId === id)
          );
          return createWhereResult(this, items, 'updatedAt');
        },
        below: () => createWhereResult(this, [], 'updatedAt'),
        between: () => createWhereResult(this, [], 'updatedAt')
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

  async delete(key: string) {
    this.store.delete(key);
  }

  async clear() {
    this.store.clear();
  }
}

const conversations = new ConversationTable();
const messages = new MessageTable();
const bookmarks = new BookmarkTable();
const promptChains = new PromptChainTable();
const folders = new FolderTable();
const folderItems = new FolderItemsTable();
const metadata = new MetadataTable();
const mediaItems = new MediaItemsTable();

export const db = {
  conversations,
  messages,
  bookmarks,
  promptChains,
  folders,
  folderItems,
  metadata,
  mediaItems,
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
    folders.clear(),
    folderItems.clear(),
    metadata.clear(),
    mediaItems.clear()
  ]);
}

export const __stores = {
  conversations,
  messages,
  bookmarks,
  promptChains,
  folders,
  folderItems,
  metadata,
  mediaItems
};
