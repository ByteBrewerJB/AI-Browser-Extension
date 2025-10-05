import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

import type { FolderTreeNode } from '@/core/storage';

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
  favorite: boolean;
}

export function flattenFolderOptions(nodes: FolderTreeNode[], depth = 0): FolderOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth, favorite: Boolean(node.favorite) },
    ...flattenFolderOptions(node.children, depth + 1)
  ]);
}

export interface OptionBubbleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> {
  children: ReactNode;
  selected?: boolean;
  onRemove?: () => Promise<void> | void;
  removeLabel?: string;
}

export function OptionBubble({
  children,
  selected = false,
  onRemove,
  removeLabel,
  className = '',
  disabled,
  ...rest
}: OptionBubbleProps): ReactElement {
  const baseClasses =
    'rounded-full border border-slate-700 px-4 py-2 text-sm font-medium transition inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400';
  const stateClasses = selected
    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100 shadow-sm'
    : 'bg-slate-900/60 text-slate-200 hover:border-emerald-400 hover:text-emerald-100';

  return (
    <span className="relative inline-flex items-center">
      <button
        {...rest}
        type="button"
        aria-pressed={selected}
        className={`${baseClasses} ${stateClasses} ${className}`.trim()}
        disabled={disabled}
      >
        <span className="truncate">{children}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? 'Remove'}
          className="absolute -top-2 -right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500 bg-slate-900 text-xs font-bold text-rose-200 shadow-sm transition hover:bg-rose-500/20"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export interface OptionBubbleListItem extends Omit<OptionBubbleProps, 'children'> {
  id: string;
  label: ReactNode;
}

export function renderOptionBubbleList(items: OptionBubbleListItem[]): ReactElement[] {
  return items.map(({ id, label, ...props }) => (
    <OptionBubble key={id} {...props}>
      {label}
    </OptionBubble>
  ));
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

