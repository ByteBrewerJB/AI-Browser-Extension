import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { PromptChainRecord } from '@/core/models';
import { listPromptChains } from '@/core/storage';

export function usePromptChains() {
  const [chains, setChains] = useState<PromptChainRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listPromptChains()).subscribe({
      next: (value) => setChains(value),
      error: (error) => console.error('[ai-companion] prompt chain subscription failed', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  return chains;
}
