import type { ReactElement } from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GPTRecord } from '@/core/models';
import type { FolderTreeNode } from '@/core/storage';
import {
  createFolder,
  createGpt,
  createPrompt,
  deleteFolder,
  deleteGpt,
  deletePrompt,
  togglePinned,
  updateGpt,
  updatePrompt
} from '@/core/storage';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
import { useFolders } from '@/shared/hooks/useFolders';
import { useGpts } from '@/shared/hooks/useGpts';
import { usePrompts } from '@/shared/hooks/usePrompts';
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

interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

function flattenFolderOptions(nodes: FolderTreeNode[], depth = 0): FolderOption[] {
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

function FolderTreeList({ nodes, deleteLabel, onDelete }: FolderTreeListProps): ReactElement | null {
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

function truncate(text: string, limit = 120) {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…`;
}

interface EditingGptState {
  id: string;
  name: string;
  description: string;
  folderId: string;
}

interface EditingPromptState {
  id: string;
  name: string;
  description: string;
  content: string;
  folderId: string;
  gptId: string;
}

export function Options() {
  const { t } = useTranslation();
  const { direction } = useSettingsStore();
  const conversations = useRecentConversations(20);
  const conversationFolders = useFolderTree('conversation');
  const gptFolderTree = useFolderTree('gpt');
  const promptFolderTree = useFolderTree('prompt');
  const gpts = useGpts();
  const prompts = usePrompts();
  const gptFolders = useFolders('gpt');
  const promptFolders = useFolders('prompt');

  const [conversationFolderName, setConversationFolderName] = useState('');
  const [gptFolderName, setGptFolderName] = useState('');
  const [promptFolderName, setPromptFolderName] = useState('');

  const [gptName, setGptName] = useState('');
  const [gptDescription, setGptDescription] = useState('');
  const [gptFolderId, setGptFolderId] = useState('');
  const [editingGpt, setEditingGpt] = useState<EditingGptState | null>(null);

  const [promptName, setPromptName] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [promptFolderId, setPromptFolderId] = useState('');
  const [promptGptId, setPromptGptId] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<EditingPromptState | null>(null);

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const gptFolderOptions = useMemo(() => flattenFolderOptions(gptFolderTree), [gptFolderTree]);
  const promptFolderOptions = useMemo(() => flattenFolderOptions(promptFolderTree), [promptFolderTree]);

  const gptFolderNameById = useMemo(() => {
    const map = new Map<string, string>();
    gptFolders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [gptFolders]);

  const promptFolderNameById = useMemo(() => {
    const map = new Map<string, string>();
    promptFolders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [promptFolders]);

  const gptById = useMemo(() => {
    const map = new Map<string, GPTRecord>();
    gpts.forEach((gpt) => {
      map.set(gpt.id, gpt);
    });
    return map;
  }, [gpts]);

  const promptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    prompts.forEach((prompt) => {
      if (!prompt.gptId) {
        return;
      }
      counts.set(prompt.gptId, (counts.get(prompt.gptId) ?? 0) + 1);
    });
    return counts;
  }, [prompts]);

  const handlePinToggle = async (conversationId: string) => {
    await togglePinned(conversationId);
  };

  const handleCreateFolder = async (
    event: FormEvent<HTMLFormElement>,
    kind: 'conversation' | 'prompt' | 'gpt',
    value: string,
    reset: (next: string) => void
  ) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    try {
      await createFolder({
        name: trimmed,
        kind
      });
      reset('');
    } catch (error) {
      console.error('[ai-companion] failed to create folder', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
    } catch (error) {
      console.error('[ai-companion] failed to delete folder', error);
    }
  };

  const handleCreateGpt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gptName.trim()) {
      return;
    }

    try {
      await createGpt({
        name: gptName,
        description: gptDescription,
        folderId: gptFolderId || undefined
      });
      setGptName('');
      setGptDescription('');
      setGptFolderId('');
    } catch (error) {
      console.error('[ai-companion] failed to create GPT', error);
    }
  };

  const handleDeleteGpt = async (id: string) => {
    try {
      await deleteGpt(id);
    } catch (error) {
      console.error('[ai-companion] failed to delete GPT', error);
    }
  };

  const handleSaveGpt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingGpt) {
      return;
    }

    try {
      await updateGpt({
        id: editingGpt.id,
        name: editingGpt.name,
        description: editingGpt.description,
        folderId: editingGpt.folderId || null
      });
      setEditingGpt(null);
    } catch (error) {
      console.error('[ai-companion] failed to update GPT', error);
    }
  };

  const handleCreatePrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!promptName.trim() || !promptContent.trim()) {
      return;
    }

    try {
      await createPrompt({
        name: promptName,
        description: promptDescription,
        content: promptContent,
        folderId: promptFolderId || undefined,
        gptId: promptGptId || undefined
      });
      setPromptName('');
      setPromptDescription('');
      setPromptContent('');
      setPromptFolderId('');
      setPromptGptId('');
    } catch (error) {
      console.error('[ai-companion] failed to create prompt', error);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await deletePrompt(id);
    } catch (error) {
      console.error('[ai-companion] failed to delete prompt', error);
    }
  };

  const handleSavePrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPrompt) {
      return;
    }

    try {
      await updatePrompt({
        id: editingPrompt.id,
        name: editingPrompt.name,
        description: editingPrompt.description,
        content: editingPrompt.content,
        folderId: editingPrompt.folderId || null,
        gptId: editingPrompt.gptId || null
      });
      setEditingPrompt(null);
    } catch (error) {
      console.error('[ai-companion] failed to update prompt', error);
    }
  };

  const renderConversationTree = conversationFolders.length === 0 ? (
    <p className="text-sm text-slate-300">{t('options.folderEmpty')}</p>
  ) : (
    <FolderTreeList nodes={conversationFolders} deleteLabel={t('options.deleteFolder')} onDelete={handleDeleteFolder} />
  );

  const renderGptTree = gptFolderTree.length === 0 ? (
    <p className="text-sm text-slate-300">{t('options.folderEmpty')}</p>
  ) : (
    <FolderTreeList nodes={gptFolderTree} deleteLabel={t('options.deleteFolder')} onDelete={handleDeleteFolder} />
  );

  const renderPromptTree = promptFolderTree.length === 0 ? (
    <p className="text-sm text-slate-300">{t('options.folderEmpty')}</p>
  ) : (
    <FolderTreeList nodes={promptFolderTree} deleteLabel={t('options.deleteFolder')} onDelete={handleDeleteFolder} />
  );

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
        <section className="flex flex-col gap-6 md:flex-row">
          <aside className="md:w-64">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <header className="space-y-1">
                <h2 className="text-base font-semibold text-emerald-300">{t('options.folderHeading')}</h2>
                <p className="text-xs text-slate-400">{t('options.folderDescription')}</p>
              </header>
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) =>
                  handleCreateFolder(event, 'conversation', conversationFolderName, setConversationFolderName)
                }
              >
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="conversation-folder-name">
                  {t('options.addFolder')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="conversation-folder-name"
                    placeholder={t('options.folderNamePlaceholder') ?? ''}
                    value={conversationFolderName}
                    onChange={(event) => setConversationFolderName(event.target.value)}
                  />
                  <button
                    className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                    type="submit"
                  >
                    {t('options.addFolderButton')}
                  </button>
                </div>
              </form>
              <div className="space-y-2" role="tree" aria-label={t('options.folderHeading')}>
                {renderConversationTree}
              </div>
            </div>
          </aside>
          <div className="flex-1 space-y-4">
            <header>
              <h2 className="text-lg font-semibold text-emerald-300">{t('options.conversationHeading')}</h2>
              <p className="text-sm text-slate-300">{t('options.conversationDescription')}</p>
            </header>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.columnTitle')}</th>
                    <th className="px-4 py-3">{t('popup.messages')}</th>
                    <th className="px-4 py-3">{t('popup.words')}</th>
                    <th className="px-4 py-3">{t('popup.characters')}</th>
                    <th className="px-4 py-3">{t('options.columnUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.columnActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {conversations.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={6}>
                        {t('options.conversationEmpty')}
                      </td>
                    </tr>
                  ) : (
                    conversations.map((conversation) => (
                      <tr key={conversation.id} className="bg-slate-900/30">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-100">
                              {conversation.title || t('options.untitledConversation')}
                            </span>
                            <span className="text-xs text-slate-400">
                              {conversation.pinned ? t('popup.unpin') : t('popup.pin')}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside>
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <header className="space-y-1">
                <h2 className="text-base font-semibold text-emerald-300">{t('options.gptFolderHeading')}</h2>
                <p className="text-xs text-slate-400">{t('options.gptFolderDescription')}</p>
              </header>
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => handleCreateFolder(event, 'gpt', gptFolderName, setGptFolderName)}
              >
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="gpt-folder-name">
                  {t('options.addFolder')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="gpt-folder-name"
                    placeholder={t('options.folderNamePlaceholder') ?? ''}
                    value={gptFolderName}
                    onChange={(event) => setGptFolderName(event.target.value)}
                  />
                  <button
                    className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                    type="submit"
                  >
                    {t('options.addFolderButton')}
                  </button>
                </div>
              </form>
              <div className="space-y-2" role="tree" aria-label={t('options.gptFolderHeading')}>
                {renderGptTree}
              </div>
            </div>
          </aside>
          <div className="space-y-4">
            <header>
              <h2 className="text-lg font-semibold text-emerald-300">{t('options.gptHeading')}</h2>
              <p className="text-sm text-slate-300">{t('options.gptDescription')}</p>
            </header>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <form className="space-y-3" onSubmit={handleCreateGpt}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="gpt-name">
                      {t('options.gptNameLabel')}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                      id="gpt-name"
                      placeholder={t('options.gptNamePlaceholder') ?? ''}
                      value={gptName}
                      onChange={(event) => setGptName(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="gpt-folder">
                      {t('options.folderLabel')}
                    </label>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                      id="gpt-folder"
                      value={gptFolderId}
                      onChange={(event) => setGptFolderId(event.target.value)}
                    >
                      <option value="">{t('options.noneOption')}</option>
                      {gptFolderOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {`${'— '.repeat(option.depth)}${option.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="gpt-description">
                    {t('options.gptDescriptionLabel')}
                  </label>
                  <textarea
                    className="min-h-[88px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="gpt-description"
                    placeholder={t('options.gptDescriptionPlaceholder') ?? ''}
                    value={gptDescription}
                    onChange={(event) => setGptDescription(event.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                    type="submit"
                  >
                    {t('options.gptCreateButton')}
                  </button>
                </div>
              </form>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.gptTableName')}</th>
                    <th className="px-4 py-3">{t('options.gptTableFolder')}</th>
                    <th className="px-4 py-3">{t('options.gptTablePrompts')}</th>
                    <th className="px-4 py-3">{t('options.columnUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.columnActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {gpts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                        {t('options.gptEmpty')}
                      </td>
                    </tr>
                  ) : (
                    gpts.map((gpt) =>
                      editingGpt?.id === gpt.id ? (
                        <tr key={gpt.id}>
                          <td className="px-4 py-3" colSpan={5}>
                            <form className="space-y-3" onSubmit={handleSaveGpt}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-gpt-name-${gpt.id}`}>
                                    {t('options.gptNameLabel')}
                                  </label>
                                  <input
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-gpt-name-${gpt.id}`}
                                    value={editingGpt.name}
                                    onChange={(event) =>
                                      setEditingGpt((previous) =>
                                        previous ? { ...previous, name: event.target.value } : previous
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-gpt-folder-${gpt.id}`}>
                                    {t('options.folderLabel')}
                                  </label>
                                  <select
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-gpt-folder-${gpt.id}`}
                                    value={editingGpt.folderId}
                                    onChange={(event) =>
                                      setEditingGpt((previous) =>
                                        previous ? { ...previous, folderId: event.target.value } : previous
                                      )
                                    }
                                  >
                                    <option value="">{t('options.noneOption')}</option>
                                    {gptFolderOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {`${'— '.repeat(option.depth)}${option.name}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-gpt-description-${gpt.id}`}>
                                  {t('options.gptDescriptionLabel')}
                                </label>
                                <textarea
                                  className="min-h-[88px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                  id={`edit-gpt-description-${gpt.id}`}
                                  value={editingGpt.description}
                                  onChange={(event) =>
                                    setEditingGpt((previous) =>
                                      previous ? { ...previous, description: event.target.value } : previous
                                    )
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
                                  onClick={() => setEditingGpt(null)}
                                  type="button"
                                >
                                  {t('options.cancelButton')}
                                </button>
                                <button
                                  className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                                  type="submit"
                                >
                                  {t('options.saveButton')}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={gpt.id} className="bg-slate-900/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-100">{gpt.name}</span>
                              {gpt.description ? (
                                <span className="text-xs text-slate-400">{truncate(gpt.description, 90)}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {gpt.folderId ? gptFolderNameById.get(gpt.folderId) ?? t('options.noneOption') : t('options.noneOption')}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatNumber(promptCounts.get(gpt.id) ?? 0)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(gpt.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                                onClick={() =>
                                  setEditingGpt({
                                    id: gpt.id,
                                    name: gpt.name,
                                    description: gpt.description ?? '',
                                    folderId: gpt.folderId ?? ''
                                  })
                                }
                                type="button"
                              >
                                {t('options.editButton')}
                              </button>
                              <button
                                className="rounded-md border border-rose-600 px-3 py-1 text-xs uppercase tracking-wide text-rose-300 hover:bg-rose-600/20"
                                onClick={() => void handleDeleteGpt(gpt.id)}
                                type="button"
                              >
                                {t('options.deleteButton')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside>
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <header className="space-y-1">
                <h2 className="text-base font-semibold text-emerald-300">{t('options.promptFolderHeading')}</h2>
                <p className="text-xs text-slate-400">{t('options.promptFolderDescription')}</p>
              </header>
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => handleCreateFolder(event, 'prompt', promptFolderName, setPromptFolderName)}
              >
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="prompt-folder-name">
                  {t('options.addFolder')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="prompt-folder-name"
                    placeholder={t('options.folderNamePlaceholder') ?? ''}
                    value={promptFolderName}
                    onChange={(event) => setPromptFolderName(event.target.value)}
                  />
                  <button
                    className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                    type="submit"
                  >
                    {t('options.addFolderButton')}
                  </button>
                </div>
              </form>
              <div className="space-y-2" role="tree" aria-label={t('options.promptFolderHeading')}>
                {renderPromptTree}
              </div>
            </div>
          </aside>
          <div className="space-y-4">
            <header>
              <h2 className="text-lg font-semibold text-emerald-300">{t('options.promptHeading')}</h2>
              <p className="text-sm text-slate-300">{t('options.promptDescription')}</p>
            </header>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <form className="space-y-3" onSubmit={handleCreatePrompt}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-name">
                      {t('options.promptNameLabel')}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                      id="prompt-name"
                      placeholder={t('options.promptNamePlaceholder') ?? ''}
                      value={promptName}
                      onChange={(event) => setPromptName(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-gpt">
                      {t('options.promptGptLabel')}
                    </label>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                      id="prompt-gpt"
                      value={promptGptId}
                      onChange={(event) => setPromptGptId(event.target.value)}
                    >
                      <option value="">{t('options.noneOption')}</option>
                      {gpts.map((gptOption) => (
                        <option key={gptOption.id} value={gptOption.id}>
                          {gptOption.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-folder">
                      {t('options.folderLabel')}
                    </label>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                      id="prompt-folder"
                      value={promptFolderId}
                      onChange={(event) => setPromptFolderId(event.target.value)}
                    >
                      <option value="">{t('options.noneOption')}</option>
                      {promptFolderOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {`${'— '.repeat(option.depth)}${option.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-summary">
                      {t('options.promptDescriptionLabel')}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                      id="prompt-summary"
                      placeholder={t('options.promptDescriptionPlaceholder') ?? ''}
                      value={promptDescription}
                      onChange={(event) => setPromptDescription(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-content">
                    {t('options.promptContentLabel')}
                  </label>
                  <textarea
                    className="min-h-[120px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="prompt-content"
                    placeholder={t('options.promptContentPlaceholder') ?? ''}
                    value={promptContent}
                    onChange={(event) => setPromptContent(event.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                    type="submit"
                  >
                    {t('options.promptCreateButton')}
                  </button>
                </div>
              </form>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('options.promptTableName')}</th>
                    <th className="px-4 py-3">{t('options.promptTableGpt')}</th>
                    <th className="px-4 py-3">{t('options.promptTableFolder')}</th>
                    <th className="px-4 py-3">{t('options.columnUpdated')}</th>
                    <th className="px-4 py-3 text-right">{t('options.columnActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {prompts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                        {t('options.promptEmpty')}
                      </td>
                    </tr>
                  ) : (
                    prompts.map((prompt) =>
                      editingPrompt?.id === prompt.id ? (
                        <tr key={prompt.id}>
                          <td className="px-4 py-3" colSpan={5}>
                            <form className="space-y-3" onSubmit={handleSavePrompt}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-prompt-name-${prompt.id}`}>
                                    {t('options.promptNameLabel')}
                                  </label>
                                  <input
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-prompt-name-${prompt.id}`}
                                    value={editingPrompt.name}
                                    onChange={(event) =>
                                      setEditingPrompt((previous) =>
                                        previous ? { ...previous, name: event.target.value } : previous
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-prompt-gpt-${prompt.id}`}>
                                    {t('options.promptGptLabel')}
                                  </label>
                                  <select
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-prompt-gpt-${prompt.id}`}
                                    value={editingPrompt.gptId}
                                    onChange={(event) =>
                                      setEditingPrompt((previous) =>
                                        previous ? { ...previous, gptId: event.target.value } : previous
                                      )
                                    }
                                  >
                                    <option value="">{t('options.noneOption')}</option>
                                    {gpts.map((gptOption) => (
                                      <option key={gptOption.id} value={gptOption.id}>
                                        {gptOption.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-2 md:col-span-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-prompt-folder-${prompt.id}`}>
                                    {t('options.folderLabel')}
                                  </label>
                                  <select
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-prompt-folder-${prompt.id}`}
                                    value={editingPrompt.folderId}
                                    onChange={(event) =>
                                      setEditingPrompt((previous) =>
                                        previous ? { ...previous, folderId: event.target.value } : previous
                                      )
                                    }
                                  >
                                    <option value="">{t('options.noneOption')}</option>
                                    {promptFolderOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {`${'— '.repeat(option.depth)}${option.name}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-2 md:col-span-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-prompt-summary-${prompt.id}`}>
                                    {t('options.promptDescriptionLabel')}
                                  </label>
                                  <input
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                    id={`edit-prompt-summary-${prompt.id}`}
                                    value={editingPrompt.description}
                                    onChange={(event) =>
                                      setEditingPrompt((previous) =>
                                        previous ? { ...previous, description: event.target.value } : previous
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`edit-prompt-content-${prompt.id}`}>
                                  {t('options.promptContentLabel')}
                                </label>
                                <textarea
                                  className="min-h-[120px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                  id={`edit-prompt-content-${prompt.id}`}
                                  value={editingPrompt.content}
                                  onChange={(event) =>
                                    setEditingPrompt((previous) =>
                                      previous ? { ...previous, content: event.target.value } : previous
                                    )
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
                                  onClick={() => setEditingPrompt(null)}
                                  type="button"
                                >
                                  {t('options.cancelButton')}
                                </button>
                                <button
                                  className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                                  type="submit"
                                >
                                  {t('options.saveButton')}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={prompt.id} className="bg-slate-900/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-100">{prompt.name}</span>
                              <span className="text-xs text-slate-400">
                                {prompt.description ? truncate(prompt.description, 90) : truncate(prompt.content, 90)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {prompt.gptId ? gptById.get(prompt.gptId)?.name ?? t('options.noneOption') : t('options.noneOption')}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {prompt.folderId
                              ? promptFolderNameById.get(prompt.folderId) ?? t('options.noneOption')
                              : t('options.noneOption')}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(prompt.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                                onClick={() =>
                                  setEditingPrompt({
                                    id: prompt.id,
                                    name: prompt.name,
                                    description: prompt.description ?? '',
                                    content: prompt.content,
                                    folderId: prompt.folderId ?? '',
                                    gptId: prompt.gptId ?? ''
                                  })
                                }
                                type="button"
                              >
                                {t('options.editButton')}
                              </button>
                              <button
                                className="rounded-md border border-rose-600 px-3 py-1 text-xs uppercase tracking-wide text-rose-300 hover:bg-rose-600/20"
                                onClick={() => void handleDeletePrompt(prompt.id)}
                                type="button"
                              >
                                {t('options.deleteButton')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )
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
