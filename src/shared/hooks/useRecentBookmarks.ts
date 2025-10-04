import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { getRecentBookmarks } from '@/core/storage';
import type { BookmarkSummary } from '@/core/storage';

export function useRecentBookmarks(limit = 5) {
  const [bookmarks, setBookmarks] = useState<BookmarkSummary[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getRecentBookmarks(limit)).subscribe({
      next: (value) => setBookmarks(value),
      error: (error) => console.error('[ai-companion] recent bookmarks live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return bookmarks;
}
