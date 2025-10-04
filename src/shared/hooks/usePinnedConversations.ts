import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { getPinnedConversations } from '@/core/storage';
import type { ConversationOverview } from '@/core/storage';

export function usePinnedConversations(limit = 5) {
  const [conversations, setConversations] = useState<ConversationOverview[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getPinnedConversations(limit)).subscribe({
      next: (value) => setConversations(value),
      error: (error) => console.error('[ai-companion] pinned conversations live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  return conversations;
}
