import type { ReactElement } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FolderTreeNode } from '@/core/storage';
import { createFolder, deleteFolder, togglePinned } from '@/core/storage';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
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

export function Options() {
  const { t } = useTranslation();
  const { direction } = useSettingsStore();
  const conversations = useRecentConversations(20);
  const folderTree = useFolderTree('conversation');
  const [folderName, setFolderName] = useState('');

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const handlePinToggle = async (conversationId: string) => {
    await togglePinned(conversationId);
  };

  const handleCreateFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      return;
    }

    try {
      await createFolder({
        name: trimmed,
        kind: 'conversation'
      });
      setFolderName('');
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

  const renderNodes = (nodes: FolderTreeNode[]): ReactElement => (
    <ul className="space-y-1" role="group">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-1" role="treeitem" aria-expanded={node.children.length > 0}>
          <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100">
            <span className="truncate" title={node.name}>
              {node.name}
            </span>
            <button
              className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
              onClick={() => handleDeleteFolder(node.id)}
              type="button"
            >
              {t('options.deleteFolder')}
            </button>
          </div>
          {node.children.length > 0 ? (
            <div className="ml-4 border-l border-slate-800 pl-3" role="group">
              {renderNodes(node.children)}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );

  const treeContent = folderTree.length === 0 ? (
    <p className="text-sm text-slate-300">{t('options.folderEmpty')}</p>
  ) : (
    renderNodes(folderTree)
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
              <form className="flex flex-col gap-2" onSubmit={handleCreateFolder}>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="new-folder-name">
                  {t('options.addFolder')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    id="new-folder-name"
                    placeholder={t('options.folderNamePlaceholder') ?? ''}
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
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
                {treeContent}
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
