import type { MediaItemFilter, MediaItemRecord, MediaItemType } from '@/core/models';

import { db } from './db';

const DEFAULT_SEED_COUNT = 1000;
const MEDIA_TYPES: MediaItemType[] = ['audio', 'video', 'image'];

const TYPE_METADATA: Record<MediaItemType, { dominant: string; accent: string; collection: string; tags: string[]; prefix: string }> = {
  audio: {
    dominant: '#0f172a',
    accent: '#22d3ee',
    collection: 'Voice captures',
    tags: ['voice', 'capture'],
    prefix: 'Clip'
  },
  video: {
    dominant: '#1e293b',
    accent: '#a855f7',
    collection: 'Recordings',
    tags: ['session', 'walkthrough'],
    prefix: 'Session'
  },
  image: {
    dominant: '#111827',
    accent: '#34d399',
    collection: 'Screenshots',
    tags: ['reference', 'snapshot'],
    prefix: 'Still'
  }
};

export async function countMediaItems(type: MediaItemFilter = 'all') {
  if (type === 'all') {
    const items = await db.mediaItems.toArray();
    return items.length;
  }

  const items = await db.mediaItems.where('type').equals(type).toArray();
  return items.length;
}

export async function seedMediaItems(target = DEFAULT_SEED_COUNT) {
  const existing = await countMediaItems();

  if (existing >= target) {
    return existing;
  }

  const missing = target - existing;
  const now = Date.now();
  const records: MediaItemRecord[] = [];

  for (let index = 0; index < missing; index += 1) {
    const sequence = existing + index;
    const type = MEDIA_TYPES[sequence % MEDIA_TYPES.length];
    const metadata = TYPE_METADATA[type];
    const sortKey = now - sequence;
    const createdAt = new Date(sortKey).toISOString();
    const title = `${metadata.prefix} ${String(sequence + 1).padStart(3, '0')}`;

    records.push({
      id: crypto.randomUUID(),
      type,
      title,
      description: `Demo ${type} asset generated for gallery performance benchmarks.`,
      createdAt,
      sortKey,
      durationSeconds: 25 + ((sequence * 7) % 95),
      sizeKb: 320 + ((sequence * 13) % 2048),
      dominantColor: metadata.dominant,
      accentColor: metadata.accent,
      thumbnailLabel: title.slice(0, 2).toUpperCase(),
      collection: metadata.collection,
      tags: metadata.tags
    });
  }

  if (records.length) {
    await db.mediaItems.bulkPut(records);
  }

  return existing + records.length;
}

export interface ListMediaItemsOptions {
  limit?: number;
  cursor?: number | null;
  type?: MediaItemFilter;
}

export interface ListMediaItemsResult {
  items: MediaItemRecord[];
  nextCursor: number | null;
  total: number;
}

export async function listMediaItems(options: ListMediaItemsOptions = {}): Promise<ListMediaItemsResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 60, 500));
  const cursor = options.cursor ?? null;
  const type = options.type ?? 'all';

  const [orderedItems, total] = await Promise.all([
    db.mediaItems.orderBy('sortKey').reverse().toArray(),
    countMediaItems(type)
  ]);

  const filtered = orderedItems.filter((item) => (type === 'all' ? true : item.type === type));
  const sliced = cursor !== null ? filtered.filter((item) => item.sortKey < cursor) : filtered;
  const items = sliced.slice(0, limit);
  const nextCursor = items.length === limit ? items[items.length - 1].sortKey : null;

  return {
    items,
    nextCursor,
    total
  };
}
