import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import type { FolderKind, FolderTreeNode } from '@/core/storage';
import { getFolderTree } from '@/core/storage';

export function useFolderTree(kind: FolderKind) {
  const [tree, setTree] = useState<FolderTreeNode[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => getFolderTree(kind)).subscribe({
      next: (value) => setTree(value),
      error: (error) => console.error('[ai-companion] folder tree subscription failed', error)
    });

    return () => subscription.unsubscribe();
  }, [kind]);

  return tree;
}
