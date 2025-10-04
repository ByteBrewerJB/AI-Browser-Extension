import type { ReactElement } from 'react';

import type { FolderTreeNode } from '@/core/storage';

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

export function flattenFolderOptions(nodes: FolderTreeNode[], depth = 0): FolderOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenFolderOptions(node.children, depth + 1)
  ]);
}

interface FolderTreeListProps {
  nodes: FolderTreeNode[];
  deleteLabel: string;
  onDelete: (folderId: string) => Promise<void> | void;
}

export function FolderTreeList({ nodes, deleteLabel, onDelete }: FolderTreeListProps): ReactElement | null {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1" role="group">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-1" role="treeitem" aria-expanded={node.children.length > 0}>
          <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100">
            <span className="truncate" title={node.name}>
              {node.name}
            </span>
            <button
              className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
              onClick={() => void onDelete(node.id)}
              type="button"
            >
              {deleteLabel}
            </button>
          </div>
          {node.children.length > 0 ? (
            <div className="ml-4 border-l border-slate-800 pl-3" role="group">
              <FolderTreeList nodes={node.children} deleteLabel={deleteLabel} onDelete={onDelete} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function truncate(text: string, limit = 120) {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…`;
}
