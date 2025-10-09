import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { MediaItemFilter, MediaItemRecord } from '@/core/models';
import { listMediaItems } from '@/core/storage';

interface UseMediaItemsOptions {
  limit?: number;
  cursor?: number | null;
  type?: MediaItemFilter;
}

interface UseMediaItemsState {
  items: MediaItemRecord[];
  nextCursor: number | null;
  total: number;
  isLoading: boolean;
}

const DEFAULT_STATE: UseMediaItemsState = {
  items: [],
  nextCursor: null,
  total: 0,
  isLoading: true
};

export function useMediaItems(options: UseMediaItemsOptions = {}): UseMediaItemsState {
  const { limit = 60, cursor = null, type = 'all' } = options;
  const [state, setState] = useState<UseMediaItemsState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    setState((previous) => ({ ...previous, isLoading: true }));

    const subscription = liveQuery(() => listMediaItems({ limit, cursor, type })).subscribe({
      next: (value) => {
        if (cancelled) {
          return;
        }

        setState({
          items: value.items,
          nextCursor: value.nextCursor,
          total: value.total,
          isLoading: false
        });
      },
      error: (error) => {
        console.error('[ai-companion] media items live query failed', error);
        if (cancelled) {
          return;
        }
        setState((previous) => ({ ...previous, isLoading: false }));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [limit, cursor, type]);

  return state;
}
