import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { HistorySection } from './features/history/HistorySection';
import { MediaSection } from './features/media/MediaSection';
import { PromptsSection } from './features/prompts/PromptsSection';
import { useSettingsStore } from '@/shared/state/settingsStore';
import { sendRuntimeMessage } from '@/shared/messaging/router';

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

export function Options() {
  const { t } = useTranslation();
  const { direction } = useSettingsStore();
  const conversations = useRecentConversations(20);
  const conversationFolders = useFolderTree('conversation');
  const gptFolderTree = useFolderTree('gpt');
  const promptFolderTree = useFolderTree('prompt');
  const gpts = useGpts();
  const prompts = usePrompts();
  const promptChains = usePromptChains();
  const [isSchedulingExport, setIsSchedulingExport] = useState(false);
  const [exportScheduledAt, setExportScheduledAt] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const gptFolders = useFolders('gpt');
  const promptFolders = useFolders('prompt');
  const conversationPresets = useConversationPresets();

  const [conversationConfig, setConversationConfig] = useState<ConversationTableConfig>({
    folderId: 'all',
    pinned: 'all',
    archived: 'active',
    sortField: 'updatedAt',
    sortDirection: 'desc'
  });
  const [presetName, setPresetName] = useState('');

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
  const [promptChainName, setPromptChainName] = useState('');
  const [promptChainNodeIds, setPromptChainNodeIds] = useState<string[]>([]);
  const [editingPromptChain, setEditingPromptChain] = useState<EditingPromptChainState | null>(null);

  const scheduleExportJob = async () => {
    setIsSchedulingExport(true);
    setExportError(null);
    try {
      const response = await sendRuntimeMessage('jobs/schedule-export', {
        exportId: crypto.randomUUID(),
        runAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        payload: { scope: 'conversations' },
        maxAttempts: 5
      });
      setExportScheduledAt(response.scheduledFor);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSchedulingExport(false);
    }
  };

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

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
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Scheduled exports</h2>
              <p className="text-xs text-slate-400">Plan conversation backups via the background job queue.</p>
            </div>
            <button
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm disabled:opacity-60"
              onClick={() => void scheduleExportJob()}
              disabled={isSchedulingExport}
              type="button"
            >
              {isSchedulingExport ? 'Scheduling…' : 'Schedule export in 5 min'}
            </button>
          </header>
          {exportScheduledAt ? (
            <p className="text-xs text-slate-300">Next export scheduled for {new Date(exportScheduledAt).toLocaleString()}</p>
          ) : (
            <p className="text-xs text-slate-400">No export scheduled yet.</p>
          )}
          {exportError ? <p className="mt-2 text-xs text-rose-400">{exportError}</p> : null}
        </section>

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
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold text-emerald-300">
                  {t('options.conversationFiltersHeading')}
                </h3>
                <p className="text-xs text-slate-400">{t('options.conversationFiltersDescription')}</p>
              </header>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    htmlFor="conversation-filter-folder"
                  >
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
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    htmlFor="conversation-filter-pinned"
                  >
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
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    htmlFor="conversation-filter-archived"
                  >
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
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    htmlFor="conversation-sort-field"
                  >
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
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    htmlFor="conversation-sort-direction"
                  >
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
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <header className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('options.presetHeading')}
                  </h4>
                  <p className="text-xs text-slate-500">{t('options.presetDescription')}</p>
                </header>
                <form
                  className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3"
                  onSubmit={handleSaveConversationPreset}
                >
                  <div className="flex-1">
                    <label
                      className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                      htmlFor="conversation-preset-name"
                    >
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
                      <td className="px-4 py-6" colSpan={5}>
                        <EmptyState title={t('options.gptEmpty')} className="py-8" />
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
                      <td className="px-4 py-6" colSpan={5}>
                        <EmptyState title={t('options.promptEmpty')} className="py-8" />
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

        <section className="space-y-4">
          <header>
            <h2 className="text-lg font-semibold text-emerald-300">{t('options.promptChainHeading')}</h2>
            <p className="text-sm text-slate-300">{t('options.promptChainDescription')}</p>
          </header>
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <header className="space-y-1">
                <h3 className="text-base font-semibold text-slate-100">{t('options.promptChainListHeading')}</h3>
                <p className="text-xs text-slate-400">{t('options.promptChainListDescription')}</p>
              </header>
              {promptChains.length === 0 ? (
                <EmptyState title={t('options.promptChainEmpty')} align="start" className="px-4 py-6 text-sm" />
              ) : (
                <ul className="space-y-3">
                  {promptChains.map((chain) => (
                    <li key={chain.id} className="rounded-lg border border-slate-800 bg-slate-950/40">
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-100">{chain.name}</p>
                          <p className="text-xs text-slate-400">
                            {t('options.promptChainPromptCount', { count: chain.nodeIds.length })}
                          </p>
                          <p className="text-xs text-slate-500">{formatDate(chain.updatedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                            onClick={() => handleEditPromptChain(chain)}
                            type="button"
                          >
                            {t('options.editButton')}
                          </button>
                          <button
                            className="rounded-md border border-rose-600 px-3 py-1 text-xs uppercase tracking-wide text-rose-300 hover:bg-rose-600/20"
                            onClick={() => void handleDeletePromptChain(chain.id)}
                            type="button"
                          >
                            {t('options.deleteButton')}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              </div>
          </div>
        </section>
      </main>
    </div>
  );
}
