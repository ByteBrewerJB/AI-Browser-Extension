import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { PromptRecord } from '@/core/models';
import { listPrompts } from '@/core/storage';

export function usePrompts() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listPrompts()).subscribe({
      next: (value) => setPrompts(value),
      error: (error) => console.error('[ai-companion] prompt list subscription failed', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  return prompts;
}
