import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { getRecentActivity } from '@/core/storage';
import type { ActivityItem } from '@/core/storage';

export function useRecentActivity(limit = 6) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getRecentActivity(limit)).subscribe({
      next: (value) => setActivity(value),
      error: (error) => console.error('[ai-companion] recent activity live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return activity;
}
