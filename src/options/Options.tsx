import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FolderRecord } from '@/core/models';
import { createFolder, togglePinned } from '@/core/storage';
import { useFolders } from '@/shared/hooks/useFolders';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import { initI18n } from '@/shared/i18n';
import { useSettingsStore } from '@/shared/state/settingsStore';

const featureColumns = [
  {
    title: 'Conversations',
    items: ['Bookmarks', 'Pinned', 'Bulk archive', 'Bulk export', 'Word counter']
  },
  {
    title: 'Prompts & GPTs',
    items: ['Prompt chains', 'Folders & subfolders', 'GPT folders', 'Bulk actions']
  },
  {
    title: 'Audio & Sync',
    items: ['Audio download', 'Advanced voice mode', 'Voice options', 'Cross-device sync']
  }
];

interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[];
}

function buildFolderTree(folders: FolderRecord[]): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  folders.forEach((folder) => {
    nodes.set(folder.id, { ...folder, children: [] });
  });

  const roots: FolderTreeNode[] = [];
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: FolderTreeNode[]) => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

interface FlatFolderOption {
  id: string;
  label: string;
}

function flattenFolderList(nodes: FolderTreeNode[], depth = 0, acc: FlatFolderOption[] = []) {
  nodes.forEach((node) => {
    const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
    acc.push({ id: node.id, label: `${prefix}${node.name}` });
    if (node.children.length > 0) {
      flattenFolderList(node.children, depth + 1, acc);
    }
  });
  return acc;
}

interface FolderTreeViewProps {
  nodes: FolderTreeNode[];
  activeFolderId: string | 'all';
  onSelect: (folderId: string | 'all') => void;
  allLabel: string;
  emptyLabel: string;
}

function FolderTreeView({ nodes, activeFolderId, onSelect, allLabel, emptyLabel }: FolderTreeViewProps) {
  return (
    <div className="space-y-2">
      <button
        className={`w-full rounded-md border px-2 py-1 text-left text-sm transition ${
          activeFolderId === 'all'
            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
            : 'border-transparent text-slate-200 hover:bg-slate-800/70'
        }`}
        onClick={() => onSelect('all')}
      >
        {allLabel}
      </button>
      {nodes.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {nodes.map((node) => (
            <FolderTreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface FolderTreeNodeItemProps {
  node: FolderTreeNode;
  depth: number;
  activeFolderId: string | 'all';
  onSelect: (folderId: string | 'all') => void;
}

function FolderTreeNodeItem({ node, depth, activeFolderId, onSelect }: FolderTreeNodeItemProps) {
  const isActive = activeFolderId === node.id;
  return (
    <li>
      <button
        className={`w-full rounded-md border px-2 py-1 text-left transition ${
          isActive
            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
            : 'border-transparent text-slate-200 hover:bg-slate-800/70'
        }`}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        {node.name}
      </button>
      {node.children.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <FolderTreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function Options() {
  const { t } = useTranslation();
  const { direction } = useSettingsStore();
  const conversations = useRecentConversations(50);
  const folders = useFolders('conversation');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const folderOptions = useMemo(() => flattenFolderList(folderTree), [folderTree]);
  const folderMap = useMemo(() => {
    const map = new Map<string, FolderRecord>();
    folders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [folders]);

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sortedConversations.filter((conversation) => {
      const matchesFolder =
        activeFolderId === 'all'
          ? true
          : (conversation.folderId ?? null) === (activeFolderId ?? null);
      const matchesSearch = normalizedSearch
        ? conversation.title.toLowerCase().includes(normalizedSearch)
        : true;
      return matchesFolder && matchesSearch;
    });
  }, [sortedConversations, activeFolderId, searchTerm]);

  const hasActiveFilter = activeFolderId !== 'all' || searchTerm.trim().length > 0;

  const handlePinToggle = async (conversationId: string) => {
    await togglePinned(conversationId);
  };

  const handleFolderCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newFolderName.trim()) {
      setCreateError(t('options.folderNameError'));
      return;
    }

    setIsCreatingFolder(true);
    setCreateError(null);
    try {
      const folder = await createFolder({
        name: newFolderName,
        parentId: newFolderParentId || undefined,
        kind: 'conversation'
      });
      setNewFolderName('');
      setNewFolderParentId('');
      setActiveFolderId(folder.id);
    } catch (error) {
      if (error instanceof Error) {
        setCreateError(error.message);
      } else {
        setCreateError(t('options.folderUnknownError'));
      }
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={direction}>
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">AI Companion</p>
          <h1 className="text-3xl font-semibold">{t('options.heading')}</h1>
          <p className="max-w-2xl text-sm text-slate-300">{t('options.description')}</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <section className="grid gap-6 lg:grid-cols-[260px,1fr]">
          <aside className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div>
              <h2 className="text-sm font-semibold text-emerald-300">{t('options.folderHeading')}</h2>
              <p className="mt-1 text-xs text-slate-400">{t('options.folderDescription')}</p>
            </div>

            <FolderTreeView
              nodes={folderTree}
              activeFolderId={activeFolderId}
              onSelect={setActiveFolderId}
              allLabel={t('options.folderAll')}
              emptyLabel={t('options.folderEmpty')}
            />

            <form
              onSubmit={handleFolderCreate}
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.addFolderHeading')}
              </p>
              <label className="text-xs font-medium text-slate-300" htmlFor="folder-name">
                {t('options.folderNameLabel')}
              </label>
              <input
                id="folder-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newFolderName}
                onChange={(event) => {
                  setNewFolderName(event.target.value);
                  if (createError) {
                    setCreateError(null);
                  }
                }}
                placeholder={t('options.folderNamePlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="folder-parent">
                {t('options.folderParentLabel')}
              </label>
              <select
                id="folder-parent"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newFolderParentId}
                onChange={(event) => setNewFolderParentId(event.target.value)}
              >
                <option value="">{t('options.folderParentRoot')}</option>
                {folderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {createError ? (
                <p className="text-xs text-rose-400">{createError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                disabled={isCreatingFolder || !newFolderName.trim()}
              >
                {isCreatingFolder
                  ? t('options.folderCreating')
                  : t('options.folderCreateButton')}
              </button>
            </form>
          </aside>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-emerald-300">{t('options.conversationHeading')}</h2>
                <p className="text-sm text-slate-300">{t('options.conversationDescription')}</p>
              </div>
              <div className="w-full sm:w-64">
                <label className="sr-only" htmlFor="conversation-search">
                  {t('options.searchLabel')}
                </label>
                <input
                  id="conversation-search"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder={t('options.searchPlaceholder') ?? ''}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.conversationTitle')}</th>
                    <th className="px-4 py-3">{t('popup.messages')}</th>
                    <th className="px-4 py-3">{t('popup.words')}</th>
                    <th className="px-4 py-3">{t('popup.characters')}</th>
                    <th className="px-4 py-3">{t('options.conversationUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.conversationActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {filteredConversations.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={6}>
                        {hasActiveFilter
                          ? t('options.conversationFilterEmpty')
                          : t('options.conversationEmpty')}
                      </td>
                    </tr>
                  ) : (
                    filteredConversations.map((conversation) => {
                      const folderName = conversation.folderId
                        ? folderMap.get(conversation.folderId)?.name
                        : null;
                      return (
                        <tr key={conversation.id} className="bg-slate-900/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-100">
                                {conversation.title || t('options.untitledConversation')}
                              </span>
                              <span className="text-xs text-slate-400">
                                {folderName ?? t('options.folderUnfiled')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatNumber(conversation.messageCount)}</td>
                          <td className="px-4 py-3">{formatNumber(conversation.wordCount)}</td>
                          <td className="px-4 py-3">{formatNumber(conversation.charCount)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(conversation.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                              onClick={() => handlePinToggle(conversation.id)}
                            >
                              {conversation.pinned ? t('popup.unpin') : t('popup.pin')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {featureColumns.map((column) => (
            <article
              key={column.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <h2 className="text-lg font-medium text-emerald-300">{column.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {column.items.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
          <p className="text-sm text-slate-300">{t('options.comingSoon')}</p>
        </section>
      </main>
    </div>
  );
}
