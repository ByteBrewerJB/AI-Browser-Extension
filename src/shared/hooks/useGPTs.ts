import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { GPTRecord } from '@/core/models';
import { listGPTs } from '@/core/storage';

export function useGPTs() {
  const [gpts, setGpts] = useState<GPTRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listGPTs()).subscribe({
      next: (value) => setGpts(value),
      error: (error) => console.error('[ai-companion] GPT live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  return gpts;
}
