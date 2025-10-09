import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { MediaItemFilter, MediaItemRecord } from '@/core/models';
import { countMediaItems, seedMediaItems } from '@/core/storage';
import { useMediaItems } from '@/shared/hooks/useMediaItems';
import { useTranslation } from '@/shared/i18n/useTranslation';

import { useMediaStore } from './mediaStore';

const PAGE_SIZE = 60;
const SEED_TARGET = 1000;
const TILE_WIDTH = 168;
const TILE_HEIGHT = 188;
const TILE_GAP = 12;

const TYPE_ORDER: MediaItemFilter[] = ['all', 'audio', 'video', 'image'];

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function MediaGallerySkeleton({ count }: { count: number }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-lg border border-slate-800/60 bg-slate-900/40 p-3"
        >
          <div className="h-24 w-full rounded-md bg-slate-800/70" />
          <div className="mt-3 h-3 w-3/4 rounded bg-slate-800/60" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-800/40" />
        </div>
      ))}
    </div>
  );
}

function MediaTile({ item }: { item: MediaItemRecord }) {
  return (
    <div
      aria-label={`${item.title} · ${item.type}`}
      className="flex h-full w-full flex-col justify-between rounded-lg border border-slate-800/70 bg-slate-900/70 p-3 text-slate-100 shadow-sm"
      role="listitem"
    >
      <div
        className="relative flex h-24 items-center justify-center overflow-hidden rounded-md text-2xl font-semibold uppercase tracking-wide"
        style={{
          backgroundColor: item.dominantColor
        }}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `linear-gradient(135deg, ${item.dominantColor} 0%, ${item.accentColor} 100%)`
          }}
        />
        <span className="relative drop-shadow-sm">{item.thumbnailLabel}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs">
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="text-slate-300">
          {formatDuration(item.durationSeconds)} · {item.collection}
        </p>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.type}</p>
      </div>
    </div>
  );
}

interface VirtualMediaGridProps {
  items: MediaItemRecord[];
  isLoading: boolean;
  onEndReached?: () => void;
  loadingLabel?: string;
  initialViewport?: { width: number; height: number };
  forcedColumnCount?: number;
}

export function VirtualMediaGrid({
  items,
  isLoading,
  onEndReached,
  loadingLabel,
  initialViewport,
  forcedColumnCount
}: VirtualMediaGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(() => {
    if (initialViewport) {
      return initialViewport;
    }
    if (forcedColumnCount) {
      return {
        width: forcedColumnCount * (TILE_WIDTH + TILE_GAP),
        height: 360
      };
    }
    return { width: 0, height: 0 };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      loadMoreRef.current = null;
    }
  }, [items.length]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const columnCount = useMemo(() => {
    if (forcedColumnCount) {
      return forcedColumnCount;
    }
    if (!viewport.width) {
      return 3;
    }
    const calculated = Math.floor((viewport.width + TILE_GAP) / (TILE_WIDTH + TILE_GAP));
    return Math.max(1, calculated);
  }, [forcedColumnCount, viewport.width]);

  const rowStride = TILE_HEIGHT + TILE_GAP;
  const columnStride = TILE_WIDTH + TILE_GAP;
  const totalRows = Math.ceil(items.length / columnCount);
  const containerHeight = Math.max(0, totalRows * rowStride - TILE_GAP);
  const containerWidth = columnCount * columnStride - TILE_GAP;
  const visibleRowEstimate = viewport.height ? Math.ceil(viewport.height / rowStride) : 6;
  const baseRow = Math.floor(scrollTop / rowStride);
  const buffer = 2;
  const startRow = Math.max(0, baseRow - buffer);
  const endRow = Math.min(totalRows, baseRow + visibleRowEstimate + buffer);
  const startIndex = startRow * columnCount;
  const endIndex = Math.min(items.length, endRow * columnCount);

  const visibleItems = useMemo(() => {
    const subset: Array<{ item: MediaItemRecord; left: number; top: number }> = [];

    for (let index = startIndex; index < endIndex; index += 1) {
      const item = items[index];
      if (!item) {
        continue;
      }
      const row = Math.floor(index / columnCount);
      const column = index % columnCount;
      subset.push({
        item,
        left: column * columnStride,
        top: row * rowStride
      });
    }

    return subset;
  }, [columnCount, columnStride, endIndex, items, rowStride, startIndex]);

  useEffect(() => {
    if (!onEndReached || isLoading || items.length === 0) {
      return;
    }

    if (endRow >= totalRows - 1) {
      if (loadMoreRef.current === items.length) {
        return;
      }
      loadMoreRef.current = items.length;
      onEndReached();
    }
  }, [endRow, isLoading, items.length, onEndReached, totalRows]);

  return (
    <div
      aria-busy={isLoading}
      className="relative h-[360px] overflow-y-auto"
      onScroll={handleScroll}
      ref={scrollRef}
      role="list"
    >
      <div
        className="relative"
        style={{ height: containerHeight, minWidth: '100%' }}
      >
        <div style={{ height: containerHeight, width: containerWidth, position: 'relative' }}>
          {visibleItems.map(({ item, left, top }) => (
            <div
              key={item.id}
              className="absolute"
              style={{
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                transform: `translate3d(${left}px, ${top}px, 0)`
              }}
            >
              <MediaTile item={item} />
            </div>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent pb-3 pt-8 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            <span>{loadingLabel ?? 'Loading…'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MediaGallery() {
  const { t } = useTranslation();
  const { mediaFilter, setMediaFilter } = useMediaStore();
  const [items, setItems] = useState<MediaItemRecord[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(true);
  const [seedError, setSeedError] = useState(false);

  const { items: pageItems, nextCursor: incomingCursor, total, isLoading } = useMediaItems({
    limit: PAGE_SIZE,
    cursor,
    type: mediaFilter
  });

  useEffect(() => {
    let cancelled = false;

    async function seed() {
      try {
        const current = await countMediaItems();
        if (cancelled) {
          return;
        }
        if (current < SEED_TARGET) {
          await seedMediaItems(SEED_TARGET);
        }
      } catch (error) {
        console.error('[ai-companion] failed to seed media items', error);
        if (!cancelled) {
          setSeedError(true);
        }
      } finally {
        if (!cancelled) {
          setIsSeeding(false);
        }
      }
    }

    seed();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cursor === null) {
      setItems(pageItems);
    } else if (pageItems.length) {
      setItems((previous) => {
        const existing = new Set(previous.map((item) => item.id));
        const appended = pageItems.filter((item) => !existing.has(item.id));
        if (appended.length === 0) {
          return previous;
        }
        return [...previous, ...appended];
      });
    }
    setNextCursor(incomingCursor ?? null);
  }, [cursor, incomingCursor, pageItems]);

  useEffect(() => {
    if (!isLoading && !isSeeding) {
      setHasLoaded(true);
    }
  }, [isLoading, isSeeding]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setNextCursor(null);
    setHasLoaded(false);
  }, [mediaFilter]);

  const handleEndReached = useCallback(() => {
    if (isLoading || nextCursor === null || cursor === nextCursor) {
      return;
    }
    setCursor(nextCursor);
  }, [cursor, isLoading, nextCursor]);

  const showSkeleton = !hasLoaded && (isLoading || isSeeding);
  const visibleCount = Math.min(items.length, total);
  const countLabel = t('options.mediaGalleryCount', { visible: visibleCount, total }) ?? `Showing ${visibleCount} of ${total}`;
  const filterLabel = t('options.mediaGalleryFilterLabel') ?? 'Filter by type';
  const loadingMoreLabel = t('options.mediaGalleryLoadingMore') ?? 'Loading more…';
  const emptyLabel = t('options.mediaGalleryEmpty') ?? 'No media items yet.';
  const seedErrorLabel = t('options.mediaGallerySeedError') ?? 'Demo media items could not be prepared. Reload the dashboard to retry.';

  let body: ReactNode;

  if (showSkeleton) {
    body = <MediaGallerySkeleton count={12} />;
  } else if (items.length === 0) {
    body = (
      <div className="mt-4 rounded-lg border border-slate-800/70 bg-slate-950/40 p-6 text-sm text-slate-300">
        <p>{emptyLabel}</p>
      </div>
    );
  } else {
    body = (
      <div className="mt-4 rounded-lg border border-slate-800/70 bg-slate-950/40 p-3">
        <VirtualMediaGrid
          initialViewport={{ width: 720, height: 360 }}
          isLoading={isLoading}
          items={items}
          loadingLabel={loadingMoreLabel}
          onEndReached={handleEndReached}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-emerald-200">
            {t('options.mediaGalleryHeading') ?? 'Media gallery'}
          </h3>
          <p className="text-xs text-slate-300">
            {t('options.mediaGalleryDescription') ?? 'Browse recent voice captures and uploads with virtualised thumbnails.'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 text-xs text-slate-300 sm:flex-row sm:items-center">
          <label className="font-semibold uppercase tracking-wide text-slate-400" htmlFor="media-gallery-filter">
            {filterLabel}
          </label>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            id="media-gallery-filter"
            onChange={(event) => setMediaFilter(event.target.value as MediaItemFilter)}
            value={mediaFilter}
          >
            {TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {t(`options.mediaGalleryFilter.${type}` as const) ?? type}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{countLabel}</p>
      {body}
      {seedError ? <p className="mt-3 text-xs text-rose-400">{seedErrorLabel}</p> : null}
    </div>
  );
}
