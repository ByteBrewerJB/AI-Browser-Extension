import { FormEvent, useMemo, useState } from 'react';
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

import { OptionBubble, flattenFolderOptions, formatDate, formatNumber } from '../shared';
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

  const [showConversationFolderForm, setShowConversationFolderForm] = useState(false);

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
    setShowConversationFolderForm(false);
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
    <section className="space-y-6" aria-labelledby="history-heading">
      <header className="space-y-2">
        <h2 id="history-heading" className="text-lg font-semibold text-emerald-300">
          {t('options.conversationHeading')}
        </h2>
        <p className="text-sm text-slate-300">{t('options.conversationDescription')}</p>
      </header>

      <div className="space-y-6">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <header className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
              {t('options.conversationFiltersHeading')}
            </h3>
            <p className="text-xs text-slate-400">{t('options.conversationFiltersDescription')}</p>
          </header>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.filterFolderLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <OptionBubble
                  selected={conversationConfig.folderId === 'all'}
                  onClick={() =>
                    handleConversationConfigChange({
                      folderId: 'all'
                    })
                  }
                >
                  {t('options.filterFolderAll')}
                </OptionBubble>
                {conversationFolderOptions.map((option) => (
                  <OptionBubble
                    key={option.id}
                    selected={conversationConfig.folderId === option.id}
                    onClick={() =>
                      handleConversationConfigChange({
                        folderId: option.id as ConversationTableConfig['folderId']
                      })
                    }
                    onRemove={() => void deleteConversationFolder(option.id)}
                    removeLabel={t('options.deleteFolder') ?? undefined}
                  >
                    <span className="flex items-center gap-2">
                      {option.depth > 0 ? (
                        <span className="text-xs text-slate-500">{'•'.repeat(option.depth)}</span>
                      ) : null}
                      <span>{option.name}</span>
                    </span>
                  </OptionBubble>
                ))}
                <OptionBubble
                  selected={showConversationFolderForm}
                  aria-label={t('options.addFolder') ?? 'Add folder'}
                  aria-expanded={showConversationFolderForm}
                  onClick={() => setShowConversationFolderForm((previous) => !previous)}
                >
                  +
                </OptionBubble>
              </div>
              {showConversationFolderForm ? (
                <form className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3" onSubmit={handleCreateConversationFolder}>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="conversation-folder-name">
                    {t('options.addFolder')}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                      id="conversation-folder-name"
                      placeholder={t('options.folderNamePlaceholder') ?? ''}
                      value={conversationFolderName}
                      onChange={(event) => setConversationFolderName(event.target.value)}
                    />
                    <div className="flex gap-2 sm:w-auto">
                      <button
                        className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 sm:flex-none"
                        onClick={() => setShowConversationFolderForm(false)}
                        type="button"
                      >
                        {t('options.cancelButton')}
                      </button>
                      <button
                        className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm sm:flex-none"
                        type="submit"
                      >
                        {t('options.addFolderButton')}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.filterPinnedLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <OptionBubble
                  selected={conversationConfig.pinned === 'all'}
                  onClick={() =>
                    handleConversationConfigChange({
                      pinned: 'all' as ConversationPinnedFilter
                    })
                  }
                >
                  {t('options.filterPinnedAll')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.pinned === 'pinned'}
                  onClick={() =>
                    handleConversationConfigChange({
                      pinned: 'pinned' as ConversationPinnedFilter
                    })
                  }
                >
                  {t('options.filterPinnedOnly')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.pinned === 'unpinned'}
                  onClick={() =>
                    handleConversationConfigChange({
                      pinned: 'unpinned' as ConversationPinnedFilter
                    })
                  }
                >
                  {t('options.filterPinnedExclude')}
                </OptionBubble>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.filterArchivedLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <OptionBubble
                  selected={conversationConfig.archived === 'all'}
                  onClick={() =>
                    handleConversationConfigChange({
                      archived: 'all' as ConversationArchivedFilter
                    })
                  }
                >
                  {t('options.filterArchivedAll')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.archived === 'active'}
                  onClick={() =>
                    handleConversationConfigChange({
                      archived: 'active' as ConversationArchivedFilter
                    })
                  }
                >
                  {t('options.filterArchivedActive')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.archived === 'archived'}
                  onClick={() =>
                    handleConversationConfigChange({
                      archived: 'archived' as ConversationArchivedFilter
                    })
                  }
                >
                  {t('options.filterArchivedOnly')}
                </OptionBubble>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.sortFieldLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <OptionBubble
                  selected={conversationConfig.sortField === 'updatedAt'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortField: 'updatedAt' as ConversationSortField
                    })
                  }
                >
                  {t('options.sortUpdated')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.sortField === 'title'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortField: 'title' as ConversationSortField
                    })
                  }
                >
                  {t('options.sortTitle')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.sortField === 'messageCount'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortField: 'messageCount' as ConversationSortField
                    })
                  }
                >
                  {t('options.sortMessages')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.sortField === 'wordCount'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortField: 'wordCount' as ConversationSortField
                    })
                  }
                >
                  {t('options.sortWords')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.sortField === 'charCount'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortField: 'charCount' as ConversationSortField
                    })
                  }
                >
                  {t('options.sortCharacters')}
                </OptionBubble>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('options.sortDirectionLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <OptionBubble
                  selected={conversationConfig.sortDirection === 'desc'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortDirection: 'desc' as ConversationSortDirection
                    })
                  }
                >
                  {t('options.sortDirectionDesc')}
                </OptionBubble>
                <OptionBubble
                  selected={conversationConfig.sortDirection === 'asc'}
                  onClick={() =>
                    handleConversationConfigChange({
                      sortDirection: 'asc' as ConversationSortDirection
                    })
                  }
                >
                  {t('options.sortDirectionAsc')}
                </OptionBubble>
              </div>
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
