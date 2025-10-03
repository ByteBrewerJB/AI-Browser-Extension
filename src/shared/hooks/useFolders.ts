import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { FolderRecord } from '@/core/models';
import { listFolders } from '@/core/storage/folders';

export function useFolders(kind?: FolderRecord['kind']) {
  const [folders, setFolders] = useState<FolderRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listFolders(kind)).subscribe({
      next: (value) => setFolders(value),
      error: (error) => console.error('[ai-companion] folders live query failed', error)
    });

    return () => subscription.unsubscribe();
  }, [kind]);

  return folders;
}
