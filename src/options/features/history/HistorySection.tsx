import { FormEvent, useMemo } from 'react';
import { useTranslation } from '@/shared/i18n/useTranslation';

import type {
  ConversationArchivedFilter,
  ConversationPinnedFilter,
  ConversationSortDirection,
  ConversationSortField,
  ConversationTableConfig,
  ConversationTablePreset
} from '@/core/models';
import { EmptyState } from '@/shared/components';
import { useConversationPresets } from '@/shared/hooks/useConversationPresets';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';

import {
  FolderTreeList,
  flattenFolderOptions,
  formatDate,
  formatNumber
} from '../shared';
import { useHistoryStore } from './historyStore';

export function HistorySection() {
  const { t } = useTranslation();
  const conversations = useRecentConversations(20);
  const conversationFolders = useFolderTree('conversation');
  const conversationPresets = useConversationPresets();

  const {
    conversationConfig,
    presetName,
    conversationFolderName,
    updateConversationConfig,
    setPresetName,
    setConversationFolderName,
    savePreset,
    deletePreset,
    applyPreset,
    createConversationFolder,
    deleteConversationFolder,
    togglePin
  } = useHistoryStore();

  const conversationFolderOptions = useMemo(
    () => flattenFolderOptions(conversationFolders),
    [conversationFolders]
  );

  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter((conversation) => {
      if (conversationConfig.folderId !== 'all') {
        if ((conversation.folderId ?? '') !== conversationConfig.folderId) {
          return false;
        }
      }

      if (conversationConfig.pinned === 'pinned' && !conversation.pinned) {
        return false;
      }

      if (conversationConfig.pinned === 'unpinned' && conversation.pinned) {
        return false;
      }

      const isArchived = conversation.archived ?? false;
      if (conversationConfig.archived === 'archived' && !isArchived) {
        return false;
      }

      if (conversationConfig.archived === 'active' && isArchived) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (conversationConfig.sortField) {
        case 'title': {
          const titleA = a.title || '';
          const titleB = b.title || '';
          comparison = titleA.localeCompare(titleB);
          break;
        }
        case 'messageCount':
          comparison = a.messageCount - b.messageCount;
          break;
        case 'wordCount':
          comparison = a.wordCount - b.wordCount;
          break;
        case 'charCount':
          comparison = a.charCount - b.charCount;
          break;
        case 'updatedAt':
        default: {
          const timeA = Number(new Date(a.updatedAt));
          const timeB = Number(new Date(b.updatedAt));
          if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
            comparison = a.updatedAt.localeCompare(b.updatedAt);
          } else {
            comparison = timeA - timeB;
          }
          break;
        }
      }

      if (comparison === 0 && conversationConfig.sortField !== 'title') {
        const timeA = Number(new Date(a.updatedAt));
        const timeB = Number(new Date(b.updatedAt));
        if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
          comparison = a.updatedAt.localeCompare(b.updatedAt);
        } else {
          comparison = timeA - timeB;
        }
      }

      return conversationConfig.sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [conversations, conversationConfig]);

  const handleSavePreset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePreset();
  };

  const handleCreateConversationFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createConversationFolder();
  };

  const handleDeleteConversationPreset = async (presetId: string) => {
    await deletePreset(presetId);
  };

  const handleApplyConversationPreset = (preset: ConversationTablePreset) => {
    applyPreset(preset);
  };

  const handleConversationConfigChange = (partial: Partial<ConversationTableConfig>) => {
    updateConversationConfig(partial);
  };

  const handlePinToggle = async (conversationId: string) => {
    await togglePin(conversationId);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]" aria-labelledby="history-heading">
      <aside>
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <header className="space-y-1">
            <h2 id="history-heading" className="text-base font-semibold text-emerald-300">
              {t('options.conversationFolderHeading')}
            </h2>
            <p className="text-xs text-slate-400">{t('options.conversationFolderDescription')}</p>
          </header>
          <form className="flex flex-col gap-2" onSubmit={handleCreateConversationFolder}>
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
          <div className="space-y-2" role="tree" aria-label={t('options.conversationFolderHeading')}>
            <FolderTreeList
              nodes={conversationFolders}
              deleteLabel={t('options.deleteButton') ?? ''}
              onDelete={deleteConversationFolder}
            />
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-emerald-300">{t('options.conversationHeading')}</h2>
          <p className="text-sm text-slate-300">{t('options.conversationDescription')}</p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-emerald-200">{t('options.filterHeading')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-filter-folder">
                  {t('options.filterFolderLabel')}
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  id="conversation-filter-folder"
                  value={conversationConfig.folderId}
                  onChange={(event) =>
                    handleConversationConfigChange({
                      folderId: event.target.value as ConversationTableConfig['folderId']
                    })
                  }
                >
                  <option value="all">{t('options.filterFolderAll')}</option>
                  {conversationFolderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {`${'— '.repeat(option.depth)}${option.name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-filter-pinned">
                  {t('options.filterPinnedLabel')}
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  id="conversation-filter-pinned"
                  value={conversationConfig.pinned}
                  onChange={(event) =>
                    handleConversationConfigChange({
                      pinned: event.target.value as ConversationPinnedFilter
                    })
                  }
                >
                  <option value="all">{t('options.filterPinnedAll')}</option>
                  <option value="pinned">{t('options.filterPinnedOnly')}</option>
                  <option value="unpinned">{t('options.filterPinnedExclude')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-filter-archived">
                  {t('options.filterArchivedLabel')}
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  id="conversation-filter-archived"
                  value={conversationConfig.archived}
                  onChange={(event) =>
                    handleConversationConfigChange({
                      archived: event.target.value as ConversationArchivedFilter
                    })
                  }
                >
                  <option value="all">{t('options.filterArchivedAll')}</option>
                  <option value="active">{t('options.filterArchivedActive')}</option>
                  <option value="archived">{t('options.filterArchivedOnly')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-sort-field">
                  {t('options.sortFieldLabel')}
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  id="conversation-sort-field"
                  value={conversationConfig.sortField}
                  onChange={(event) =>
                    handleConversationConfigChange({
                      sortField: event.target.value as ConversationSortField
                    })
                  }
                >
                  <option value="updatedAt">{t('options.sortUpdated')}</option>
                  <option value="title">{t('options.sortTitle')}</option>
                  <option value="messageCount">{t('options.sortMessages')}</option>
                  <option value="wordCount">{t('options.sortWords')}</option>
                  <option value="charCount">{t('options.sortCharacters')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-sort-direction">
                  {t('options.sortDirectionLabel')}
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  id="conversation-sort-direction"
                  value={conversationConfig.sortDirection}
                  onChange={(event) =>
                    handleConversationConfigChange({
                      sortDirection: event.target.value as ConversationSortDirection
                    })
                  }
                >
                  <option value="desc">{t('options.sortDirectionDesc')}</option>
                  <option value="asc">{t('options.sortDirectionAsc')}</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <header className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('options.presetHeading')}</h4>
              <p className="text-xs text-slate-500">{t('options.presetDescription')}</p>
            </header>
            <form className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3" onSubmit={handleSavePreset}>
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="conversation-preset-name">
                  {t('options.presetNameLabel')}
                </label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  id="conversation-preset-name"
                  placeholder={t('options.presetNamePlaceholder') ?? ''}
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </div>
              <button
                className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm md:self-start"
                type="submit"
              >
                {t('options.presetSaveButton')}
              </button>
            </form>
            {conversationPresets.length === 0 ? (
              <EmptyState title={t('options.presetEmpty')} align="start" className="py-4 text-xs" />
            ) : (
              <ul className="space-y-2">
                {conversationPresets.map((preset) => (
                  <li
                    key={preset.id}
                    className="flex flex-col gap-3 rounded-md border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-100">{preset.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(preset.updatedAt)}</p>
                    </div>
                    <div className="flex gap-2 sm:justify-end">
                      <button
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                        onClick={() => handleApplyConversationPreset(preset)}
                        type="button"
                      >
                        {t('options.presetApplyButton')}
                      </button>
                      <button
                        className="rounded-md border border-rose-600 px-3 py-1 text-xs uppercase tracking-wide text-rose-300 hover:bg-rose-600/20"
                        onClick={() => void handleDeleteConversationPreset(preset.id)}
                        type="button"
                      >
                        {t('options.presetDeleteButton')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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
              {filteredConversations.length === 0 ? (
                <tr>
                  <td className="px-4 py-6" colSpan={6}>
                    <EmptyState
                      title={
                        conversations.length === 0
                          ? t('options.conversationEmpty')
                          : t('options.conversationFilteredEmpty')
                      }
                      className="py-8"
                    />
                  </td>
                </tr>
              ) : (
                filteredConversations.map((conversation) => (
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
                        onClick={() => void handlePinToggle(conversation.id)}
                        type="button"
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
  );
}
