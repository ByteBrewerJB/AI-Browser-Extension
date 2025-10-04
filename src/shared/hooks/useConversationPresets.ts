import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { ConversationTablePreset } from '@/core/models';
import { getConversationTablePresets } from '@/core/storage';

export function useConversationPresets() {
  const [presets, setPresets] = useState<ConversationTablePreset[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getConversationTablePresets()).subscribe({
      next: (value) => setPresets(value),
      error: (error) => console.error('[ai-companion] conversation presets live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  return presets;
}
