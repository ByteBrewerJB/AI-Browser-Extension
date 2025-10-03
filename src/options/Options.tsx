import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FolderRecord } from '@/core/models';
import {
  createFolder,
  createGPT,
  createPrompt,
  deleteGPT,
  deletePrompt,
  togglePinned,
  updateGPT,
  updatePrompt
} from '@/core/storage';
import { useFolders } from '@/shared/hooks/useFolders';
import { useGPTs } from '@/shared/hooks/useGPTs';
import { usePrompts } from '@/shared/hooks/usePrompts';
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
  const gptFolders = useFolders('gpt');
  const promptFolders = useFolders('prompt');
  const gpts = useGPTs();
  const prompts = usePrompts();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [activeGPTFolderId, setActiveGPTFolderId] = useState<string | 'all'>('all');
  const [activePromptFolderId, setActivePromptFolderId] = useState<string | 'all'>('all');
  const [newGPTName, setNewGPTName] = useState('');
  const [newGPTDescription, setNewGPTDescription] = useState('');
  const [newGPTFolderId, setNewGPTFolderId] = useState('');
  const [gptCreateError, setGPTCreateError] = useState<string | null>(null);
  const [gptActionError, setGPTActionError] = useState<string | null>(null);
  const [isCreatingGPT, setIsCreatingGPT] = useState(false);
  const [gptSearchTerm, setGPTSearchTerm] = useState('');
  const [newGPTFolderName, setNewGPTFolderName] = useState('');
  const [newGPTFolderParentId, setNewGPTFolderParentId] = useState('');
  const [gptFolderError, setGPTFolderError] = useState<string | null>(null);
  const [isCreatingGPTFolder, setIsCreatingGPTFolder] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [newPromptFolderId, setNewPromptFolderId] = useState('');
  const [promptCreateError, setPromptCreateError] = useState<string | null>(null);
  const [promptActionError, setPromptActionError] = useState<string | null>(null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [promptSearchTerm, setPromptSearchTerm] = useState('');
  const [newPromptFolderName, setNewPromptFolderName] = useState('');
  const [newPromptFolderParentId, setNewPromptFolderParentId] = useState('');
  const [promptFolderError, setPromptFolderError] = useState<string | null>(null);
  const [isCreatingPromptFolder, setIsCreatingPromptFolder] = useState(false);

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
  const gptFolderTree = useMemo(() => buildFolderTree(gptFolders), [gptFolders]);
  const gptFolderOptions = useMemo(() => flattenFolderList(gptFolderTree), [gptFolderTree]);
  const gptFolderMap = useMemo(() => {
    const map = new Map<string, FolderRecord>();
    gptFolders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [gptFolders]);
  const promptFolderTree = useMemo(() => buildFolderTree(promptFolders), [promptFolders]);
  const promptFolderOptions = useMemo(
    () => flattenFolderList(promptFolderTree),
    [promptFolderTree]
  );
  const promptFolderMap = useMemo(() => {
    const map = new Map<string, FolderRecord>();
    promptFolders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [promptFolders]);

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
  const hasGPTFilter = activeGPTFolderId !== 'all' || gptSearchTerm.trim().length > 0;
  const hasPromptFilter =
    activePromptFolderId !== 'all' || promptSearchTerm.trim().length > 0;

  const sortedGpts = useMemo(
    () =>
      [...gpts].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [gpts]
  );

  const filteredGpts = useMemo(() => {
    const normalizedSearch = gptSearchTerm.trim().toLowerCase();
    return sortedGpts.filter((gpt) => {
      const matchesFolder =
        activeGPTFolderId === 'all'
          ? true
          : (gpt.folderId ?? null) === (activeGPTFolderId ?? null);
      const matchesSearch = normalizedSearch
        ? gpt.name.toLowerCase().includes(normalizedSearch)
        : true;
      return matchesFolder && matchesSearch;
    });
  }, [sortedGpts, activeGPTFolderId, gptSearchTerm]);

  const sortedPrompts = useMemo(
    () =>
      [...prompts].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [prompts]
  );

  const filteredPrompts = useMemo(() => {
    const normalizedSearch = promptSearchTerm.trim().toLowerCase();
    return sortedPrompts.filter((prompt) => {
      const matchesFolder =
        activePromptFolderId === 'all'
          ? true
          : (prompt.folderId ?? null) === (activePromptFolderId ?? null);
      const matchesSearch = normalizedSearch
        ? prompt.name.toLowerCase().includes(normalizedSearch) ||
          prompt.content.toLowerCase().includes(normalizedSearch)
        : true;
      return matchesFolder && matchesSearch;
    });
  }, [sortedPrompts, activePromptFolderId, promptSearchTerm]);

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

  const handleGPTCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newGPTName.trim()) {
      setGPTCreateError(t('options.gptNameError'));
      return;
    }

    setIsCreatingGPT(true);
    setGPTCreateError(null);
    setGPTActionError(null);
    try {
      const gpt = await createGPT({
        name: newGPTName,
        description: newGPTDescription,
        folderId: newGPTFolderId || undefined
      });
      setNewGPTName('');
      setNewGPTDescription('');
      setNewGPTFolderId('');
      if (gpt.folderId) {
        setActiveGPTFolderId(gpt.folderId);
      }
    } catch (error) {
      if (error instanceof Error) {
        setGPTCreateError(error.message);
      } else {
        setGPTCreateError(t('options.gptUnknownError'));
      }
    } finally {
      setIsCreatingGPT(false);
    }
  };

  const handleGPTFolderCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newGPTFolderName.trim()) {
      setGPTFolderError(t('options.folderNameError'));
      return;
    }

    setIsCreatingGPTFolder(true);
    setGPTFolderError(null);
    try {
      const folder = await createFolder({
        name: newGPTFolderName,
        parentId: newGPTFolderParentId || undefined,
        kind: 'gpt'
      });
      setNewGPTFolderName('');
      setNewGPTFolderParentId('');
      setActiveGPTFolderId(folder.id);
    } catch (error) {
      if (error instanceof Error) {
        setGPTFolderError(error.message);
      } else {
        setGPTFolderError(t('options.folderUnknownError'));
      }
    } finally {
      setIsCreatingGPTFolder(false);
    }
  };

  const handleGPTFolderChange = async (gptId: string, folderId: string) => {
    setGPTActionError(null);
    try {
      await updateGPT(gptId, { folderId: folderId || undefined });
    } catch (error) {
      if (error instanceof Error) {
        setGPTActionError(error.message);
      } else {
        setGPTActionError(t('options.gptUnknownError'));
      }
    }
  };

  const handleGPTDelete = async (gptId: string) => {
    setGPTActionError(null);
    try {
      const shouldDelete = window.confirm(t('options.gptDeleteConfirm'));
      if (!shouldDelete) {
        return;
      }
      await deleteGPT(gptId);
    } catch (error) {
      if (error instanceof Error) {
        setGPTActionError(error.message);
      } else {
        setGPTActionError(t('options.gptUnknownError'));
      }
    }
  };

  const handlePromptCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPromptName.trim()) {
      setPromptCreateError(t('options.promptNameError'));
      return;
    }
    if (!newPromptContent.trim()) {
      setPromptCreateError(t('options.promptContentError'));
      return;
    }

    setIsCreatingPrompt(true);
    setPromptCreateError(null);
    setPromptActionError(null);
    try {
      const prompt = await createPrompt({
        name: newPromptName,
        content: newPromptContent,
        folderId: newPromptFolderId || undefined
      });
      setNewPromptName('');
      setNewPromptContent('');
      setNewPromptFolderId('');
      if (prompt.folderId) {
        setActivePromptFolderId(prompt.folderId);
      }
    } catch (error) {
      if (error instanceof Error) {
        setPromptCreateError(error.message);
      } else {
        setPromptCreateError(t('options.promptUnknownError'));
      }
    } finally {
      setIsCreatingPrompt(false);
    }
  };

  const handlePromptFolderCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPromptFolderName.trim()) {
      setPromptFolderError(t('options.folderNameError'));
      return;
    }

    setIsCreatingPromptFolder(true);
    setPromptFolderError(null);
    try {
      const folder = await createFolder({
        name: newPromptFolderName,
        parentId: newPromptFolderParentId || undefined,
        kind: 'prompt'
      });
      setNewPromptFolderName('');
      setNewPromptFolderParentId('');
      setActivePromptFolderId(folder.id);
    } catch (error) {
      if (error instanceof Error) {
        setPromptFolderError(error.message);
      } else {
        setPromptFolderError(t('options.folderUnknownError'));
      }
    } finally {
      setIsCreatingPromptFolder(false);
    }
  };

  const handlePromptFolderChange = async (promptId: string, folderId: string) => {
    setPromptActionError(null);
    try {
      await updatePrompt(promptId, { folderId: folderId || undefined });
    } catch (error) {
      if (error instanceof Error) {
        setPromptActionError(error.message);
      } else {
        setPromptActionError(t('options.promptUnknownError'));
      }
    }
  };

  const handlePromptDelete = async (promptId: string) => {
    setPromptActionError(null);
    try {
      const shouldDelete = window.confirm(t('options.promptDeleteConfirm'));
      if (!shouldDelete) {
        return;
      }
      await deletePrompt(promptId);
    } catch (error) {
      if (error instanceof Error) {
        setPromptActionError(error.message);
      } else {
        setPromptActionError(t('options.promptUnknownError'));
      }
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

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <header className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-300">{t('options.gptHeading')}</h2>
              <p className="text-sm text-slate-300">{t('options.gptDescription')}</p>
            </header>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:w-56">
                <label className="sr-only" htmlFor="gpt-folder-filter">
                  {t('options.gptFilterLabel')}
                </label>
                <select
                  id="gpt-folder-filter"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  value={activeGPTFolderId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setActiveGPTFolderId(value === 'all' ? 'all' : value);
                  }}
                >
                  <option value="all">{t('options.gptFilterAll')}</option>
                  {gptFolderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-64">
                <label className="sr-only" htmlFor="gpt-search">
                  {t('options.gptSearchLabel')}
                </label>
                <input
                  id="gpt-search"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  placeholder={t('options.gptSearchPlaceholder') ?? ''}
                  value={gptSearchTerm}
                  onChange={(event) => setGPTSearchTerm(event.target.value)}
                />
              </div>
            </div>
            {gptActionError ? (
              <p className="text-xs text-rose-400">{gptActionError}</p>
            ) : null}
            <form
              onSubmit={handleGPTFolderCreate}
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.addFolderHeading')}
              </p>
              <label className="text-xs font-medium text-slate-300" htmlFor="gpt-folder-name">
                {t('options.folderNameLabel')}
              </label>
              <input
                id="gpt-folder-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newGPTFolderName}
                onChange={(event) => {
                  setNewGPTFolderName(event.target.value);
                  if (gptFolderError) {
                    setGPTFolderError(null);
                  }
                }}
                placeholder={t('options.folderNamePlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="gpt-folder-parent">
                {t('options.folderParentLabel')}
              </label>
              <select
                id="gpt-folder-parent"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newGPTFolderParentId}
                onChange={(event) => setNewGPTFolderParentId(event.target.value)}
              >
                <option value="">{t('options.folderParentRoot')}</option>
                {gptFolderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {gptFolderError ? (
                <p className="text-xs text-rose-400">{gptFolderError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                disabled={isCreatingGPTFolder || !newGPTFolderName.trim()}
              >
                {isCreatingGPTFolder
                  ? t('options.folderCreating')
                  : t('options.folderCreateButton')}
              </button>
            </form>
            <form
              onSubmit={handleGPTCreate}
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.gptFormHeading')}
              </p>
              <label className="text-xs font-medium text-slate-300" htmlFor="gpt-name">
                {t('options.gptNameLabel')}
              </label>
              <input
                id="gpt-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newGPTName}
                onChange={(event) => {
                  setNewGPTName(event.target.value);
                  if (gptCreateError) {
                    setGPTCreateError(null);
                  }
                }}
                placeholder={t('options.gptNamePlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="gpt-description">
                {t('options.gptDescriptionLabel')}
              </label>
              <textarea
                id="gpt-description"
                className="h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newGPTDescription}
                onChange={(event) => setNewGPTDescription(event.target.value)}
                placeholder={t('options.gptDescriptionPlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="gpt-folder">
                {t('options.gptFolderLabel')}
              </label>
              <select
                id="gpt-folder"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newGPTFolderId}
                onChange={(event) => setNewGPTFolderId(event.target.value)}
              >
                <option value="">{t('options.gptFolderNone')}</option>
                {gptFolderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {gptCreateError ? (
                <p className="text-xs text-rose-400">{gptCreateError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                disabled={isCreatingGPT || !newGPTName.trim()}
              >
                {isCreatingGPT ? t('options.gptCreating') : t('options.gptCreateButton')}
              </button>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.gptTableName')}</th>
                    <th className="px-4 py-3">{t('options.gptTableFolder')}</th>
                    <th className="px-4 py-3">{t('options.gptTableUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.gptTableActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {filteredGpts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                        {hasGPTFilter
                          ? t('options.gptEmptyWithFilter')
                          : t('options.gptEmpty')}
                      </td>
                    </tr>
                  ) : (
                    filteredGpts.map((gpt) => {
                      const folderLabel = gpt.folderId
                        ? gptFolderMap.get(gpt.folderId)?.name
                        : null;
                      return (
                        <tr key={gpt.id} className="bg-slate-900/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-slate-100">{gpt.name}</span>
                              {gpt.description ? (
                                <span className="text-xs text-slate-400">
                                  {gpt.description}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                              value={gpt.folderId ?? ''}
                              onChange={(event) => handleGPTFolderChange(gpt.id, event.target.value)}
                            >
                              <option value="">{t('options.gptFolderNone')}</option>
                              {gptFolderOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">
                              {folderLabel ?? t('options.gptFolderNone')}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(gpt.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200"
                              onClick={() => handleGPTDelete(gpt.id)}
                            >
                              {t('options.gptDelete')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <header className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-300">{t('options.promptHeading')}</h2>
              <p className="text-sm text-slate-300">{t('options.promptDescription')}</p>
            </header>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:w-56">
                <label className="sr-only" htmlFor="prompt-folder-filter">
                  {t('options.promptFilterLabel')}
                </label>
                <select
                  id="prompt-folder-filter"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  value={activePromptFolderId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setActivePromptFolderId(value === 'all' ? 'all' : value);
                  }}
                >
                  <option value="all">{t('options.promptFilterAll')}</option>
                  {promptFolderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-64">
                <label className="sr-only" htmlFor="prompt-search">
                  {t('options.promptSearchLabel')}
                </label>
                <input
                  id="prompt-search"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  placeholder={t('options.promptSearchPlaceholder') ?? ''}
                  value={promptSearchTerm}
                  onChange={(event) => setPromptSearchTerm(event.target.value)}
                />
              </div>
            </div>
            {promptActionError ? (
              <p className="text-xs text-rose-400">{promptActionError}</p>
            ) : null}
            <form
              onSubmit={handlePromptFolderCreate}
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.addFolderHeading')}
              </p>
              <label className="text-xs font-medium text-slate-300" htmlFor="prompt-folder-name">
                {t('options.folderNameLabel')}
              </label>
              <input
                id="prompt-folder-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newPromptFolderName}
                onChange={(event) => {
                  setNewPromptFolderName(event.target.value);
                  if (promptFolderError) {
                    setPromptFolderError(null);
                  }
                }}
                placeholder={t('options.folderNamePlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="prompt-folder-parent">
                {t('options.folderParentLabel')}
              </label>
              <select
                id="prompt-folder-parent"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newPromptFolderParentId}
                onChange={(event) => setNewPromptFolderParentId(event.target.value)}
              >
                <option value="">{t('options.folderParentRoot')}</option>
                {promptFolderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {promptFolderError ? (
                <p className="text-xs text-rose-400">{promptFolderError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                disabled={isCreatingPromptFolder || !newPromptFolderName.trim()}
              >
                {isCreatingPromptFolder
                  ? t('options.folderCreating')
                  : t('options.folderCreateButton')}
              </button>
            </form>
            <form
              onSubmit={handlePromptCreate}
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.promptFormHeading')}
              </p>
              <label className="text-xs font-medium text-slate-300" htmlFor="prompt-name">
                {t('options.promptNameLabel')}
              </label>
              <input
                id="prompt-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newPromptName}
                onChange={(event) => {
                  setNewPromptName(event.target.value);
                  if (promptCreateError) {
                    setPromptCreateError(null);
                  }
                }}
                placeholder={t('options.promptNamePlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="prompt-content">
                {t('options.promptContentLabel')}
              </label>
              <textarea
                id="prompt-content"
                className="h-28 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newPromptContent}
                onChange={(event) => setNewPromptContent(event.target.value)}
                placeholder={t('options.promptContentPlaceholder') ?? ''}
              />
              <label className="text-xs font-medium text-slate-300" htmlFor="prompt-folder">
                {t('options.promptFolderLabel')}
              </label>
              <select
                id="prompt-folder"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={newPromptFolderId}
                onChange={(event) => setNewPromptFolderId(event.target.value)}
              >
                <option value="">{t('options.promptFolderNone')}</option>
                {promptFolderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {promptCreateError ? (
                <p className="text-xs text-rose-400">{promptCreateError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                disabled={isCreatingPrompt || !newPromptName.trim() || !newPromptContent.trim()}
              >
                {isCreatingPrompt
                  ? t('options.promptCreating')
                  : t('options.promptCreateButton')}
              </button>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.promptTableName')}</th>
                    <th className="px-4 py-3">{t('options.promptTableFolder')}</th>
                    <th className="px-4 py-3">{t('options.promptTablePreview')}</th>
                    <th className="px-4 py-3">{t('options.promptTableUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.promptTableActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {filteredPrompts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                        {hasPromptFilter
                          ? t('options.promptEmptyWithFilter')
                          : t('options.promptEmpty')}
                      </td>
                    </tr>
                  ) : (
                    filteredPrompts.map((prompt) => {
                      const folderLabel = prompt.folderId
                        ? promptFolderMap.get(prompt.folderId)?.name
                        : null;
                      const preview = prompt.content.length > 160
                        ? `${prompt.content.slice(0, 157)}…`
                        : prompt.content;
                      return (
                        <tr key={prompt.id} className="bg-slate-900/30">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-100">{prompt.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                              value={prompt.folderId ?? ''}
                              onChange={(event) => handlePromptFolderChange(prompt.id, event.target.value)}
                            >
                              <option value="">{t('options.promptFolderNone')}</option>
                              {promptFolderOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">
                              {folderLabel ?? t('options.promptFolderNone')}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">{preview}</td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(prompt.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200"
                              onClick={() => handlePromptDelete(prompt.id)}
                            >
                              {t('options.promptDelete')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
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
