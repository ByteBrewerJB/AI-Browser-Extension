import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { GPTRecord } from '@/core/models';
import { listGpts } from '@/core/storage';

export function useGpts() {
  const [gpts, setGpts] = useState<GPTRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listGpts()).subscribe({
      next: (value) => setGpts(value),
      error: (error) => console.error('[ai-companion] GPT list subscription failed', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  return gpts;
}
