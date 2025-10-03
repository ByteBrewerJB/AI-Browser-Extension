import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { FolderRecord } from '@/core/models';
import type { FolderKind } from '@/core/storage';
import { listFolders } from '@/core/storage';

export function useFolders(kind: FolderKind) {
  const [folders, setFolders] = useState<FolderRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => listFolders(kind)).subscribe({
      next: (value) => setFolders(value),
      error: (error) => console.error('[ai-companion] folder list subscription failed', error)
    });

    return () => subscription.unsubscribe();
  }, [kind]);

  return folders;
}
