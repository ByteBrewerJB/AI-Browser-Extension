import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { getRecentConversations } from '@/core/storage';
import type { ConversationOverview } from '@/core/storage';

export function useRecentConversations(limit = 5) {
  const [conversations, setConversations] = useState<ConversationOverview[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getRecentConversations(limit)).subscribe({
      next: (value) => setConversations(value),
      error: (error) => console.error('[ai-companion] recent conversations live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return conversations;
}
