import { FormEvent, Fragment, useMemo } from 'react';
import { useTranslation } from '@/shared/i18n/useTranslation';

import type { GPTRecord, PromptChainRecord, PromptRecord } from '@/core/models';
import { EmptyState } from '@/shared/components';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
import { useFolders } from '@/shared/hooks/useFolders';
import { useGpts } from '@/shared/hooks/useGpts';
import { usePromptChains } from '@/shared/hooks/usePromptChains';
import { usePrompts } from '@/shared/hooks/usePrompts';

import { FolderTreeList, flattenFolderOptions, formatDate, formatNumber, truncate } from '../shared';
import { Tabs, Tab, TabList, TabPanel, TabPanels } from '@/ui/components/Tabs';
import { usePromptsStore } from './promptsStore';

export function PromptsSection() {
  const { t } = useTranslation();
  const gptFolderTree = useFolderTree('gpt');
  const promptFolderTree = useFolderTree('prompt');
  const gptFolders = useFolders('gpt');
  const promptFolders = useFolders('prompt');
  const gpts = useGpts();
  const prompts = usePrompts();
  const promptChains = usePromptChains();

  const {
    gptName,
    gptDescription,
    gptFolderId,
    gptFolderName,
    editingGpt,
    promptName,
    promptDescription,
    promptContent,
    promptFolderId,
    promptGptId,
    promptFolderName,
    editingPrompt,
    promptChainName,
    promptChainNodeIds,
    editingPromptChain,
    setGptName,
    setGptDescription,
    setGptFolderId,
    setGptFolderName,
    setEditingGpt,
    updateEditingGpt,
    createGpt,
    saveEditingGpt,
    removeGpt,
    createGptFolder,
    deleteGptFolder,
    setPromptName,
    setPromptDescription,
    setPromptContent,
    setPromptFolderId,
    setPromptGptId,
    setPromptFolderName,
    setEditingPrompt,
    updateEditingPrompt,
    createPrompt,
    saveEditingPrompt,
    removePrompt,
    createPromptFolder,
    deletePromptFolder,
    setPromptChainName,
    addPromptToChain,
    removePromptFromChain,
    movePromptInChain,
    loadPromptChain,
    resetPromptChainForm,
    savePromptChain,
    removePromptChain
  } = usePromptsStore();

  const gptFolderOptions = useMemo(() => flattenFolderOptions(gptFolderTree), [gptFolderTree]);
  const promptFolderOptions = useMemo(() => flattenFolderOptions(promptFolderTree), [promptFolderTree]);

  const gptFolderNameById = useMemo(() => {
    const map = new Map<string, string>();
    gptFolders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [gptFolders]);

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

  const gptById = useMemo(() => {
    const map = new Map<string, GPTRecord>();
    gpts.forEach((gpt) => {
      map.set(gpt.id, gpt);
    });
    return map;
  }, [gpts]);

  const promptById = useMemo(() => {
    const map = new Map<string, PromptRecord>();
    prompts.forEach((prompt) => {
      map.set(prompt.id, prompt);
    });
    return map;
  }, [prompts]);

  const promptFolderNameById = useMemo(() => {
    const map = new Map<string, string>();
    promptFolders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [promptFolders]);

  const selectedChainPrompts = useMemo(() => {
    return promptChainNodeIds
      .map((id) => promptById.get(id))
      .filter((prompt): prompt is PromptRecord => Boolean(prompt));
  }, [promptById, promptChainNodeIds]);

  const availableChainPrompts = useMemo(() => {
    return prompts.filter((prompt) => !promptChainNodeIds.includes(prompt.id));
  }, [prompts, promptChainNodeIds]);

  const handleCreateGpt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createGpt();
  };

  const handleSaveGpt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveEditingGpt();
  };

  const handleCreatePrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createPrompt();
  };

  const handleSavePrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveEditingPrompt();
  };

  const handleSavePromptChain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePromptChain();
  };

  const handleEditPromptChain = (chain: PromptChainRecord) => {
    loadPromptChain(chain);
  };

  const renderGptTree =
    gptFolderTree.length === 0 ? (
      <EmptyState title={t('options.folderEmpty')} align="start" className="px-4 py-6 text-sm" />
    ) : (
      <FolderTreeList nodes={gptFolderTree} deleteLabel={t('options.deleteFolder')} onDelete={deleteGptFolder} />
    );

  const renderPromptTree =
    promptFolderTree.length === 0 ? (
      <EmptyState title={t('options.folderEmpty')} align="start" className="px-4 py-6 text-sm" />
    ) : (
      <FolderTreeList nodes={promptFolderTree} deleteLabel={t('options.deleteFolder')} onDelete={deletePromptFolder} />
    );

  return (
    <section className="space-y-6" aria-labelledby="prompts-heading">
      <header>
        <h2 id="prompts-heading" className="text-lg font-semibold text-emerald-300">
          {t('options.promptSuiteHeading') ?? 'Prompt workspace'}
        </h2>
        <p className="text-sm text-slate-300">{t('options.promptSuiteDescription') ?? ''}</p>
      </header>

      <Tabs defaultValue="gpts">
        <TabList>
          <Tab value="gpts">{t('options.gptHeading')}</Tab>
          <Tab value="prompts">{t('options.promptHeading')}</Tab>
          <Tab value="chains">{t('options.promptChainHeading')}</Tab>
        </TabList>
        <TabPanels className="border border-slate-800 bg-slate-900/40 p-4">
          <TabPanel value="gpts" labelledBy="gpt-panel">
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside>
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <header className="space-y-1">
                    <h3 className="text-base font-semibold text-emerald-300">{t('options.gptFolderHeading')}</h3>
                    <p className="text-xs text-slate-400">{t('options.gptFolderDescription')}</p>
                  </header>
                  <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void createGptFolder(); }}>
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
                  <h3 className="text-lg font-semibold text-emerald-300">{t('options.gptHeading')}</h3>
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
                          value={gptName}
                          onChange={(event) => setGptName(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="gpt-folder">
                          {t('options.gptFolderSelectLabel')}
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
                        className="min-h-[80px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                        id="gpt-description"
                        value={gptDescription}
                        onChange={(event) => setGptDescription(event.target.value)}
                      />
                    </div>
                    <button
                      className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                      type="submit"
                    >
                      {t('options.createButton')}
                    </button>
                  </form>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">{t('options.columnTitle')}</th>
                        <th className="px-4 py-3">{t('options.gptFolderColumn')}</th>
                        <th className="px-4 py-3">{t('options.promptCountColumn')}</th>
                        <th className="px-4 py-3">{t('options.columnUpdated')}</th>
                        <th className="px-4 py-3 text-right">{t('options.columnActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {gpts.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6" colSpan={5}>
                            <EmptyState title={t('options.gptEmpty')} align="start" className="py-8" />
                          </td>
                        </tr>
                      ) : (
                        gpts.map((gpt) => (
                          <Fragment key={gpt.id}>
                            {editingGpt?.id === gpt.id ? (
                              <tr className="bg-slate-900/40">
                                <td colSpan={5} className="px-4 py-3">
                                  <form className="space-y-3" onSubmit={handleSaveGpt}>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-gpt-name">
                                          {t('options.gptNameLabel')}
                                        </label>
                                        <input
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-gpt-name"
                                          value={editingGpt.name}
                                          onChange={(event) =>
                                            updateEditingGpt((previous) => ({ ...previous, name: event.target.value }))
                                          }
                                        />
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-gpt-folder">
                                          {t('options.gptFolderSelectLabel')}
                                        </label>
                                        <select
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-gpt-folder"
                                          value={editingGpt.folderId}
                                          onChange={(event) =>
                                            updateEditingGpt((previous) => ({ ...previous, folderId: event.target.value }))
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
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-gpt-description">
                                        {t('options.gptDescriptionLabel')}
                                      </label>
                                      <textarea
                                        className="min-h-[80px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                        id="edit-gpt-description"
                                        value={editingGpt.description}
                                        onChange={(event) =>
                                          updateEditingGpt((previous) => ({ ...previous, description: event.target.value }))
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
                              <tr className="bg-slate-900/30">
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
                                      onClick={() => void removeGpt(gpt.id)}
                                      type="button"
                                    >
                                      {t('options.deleteButton')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="prompts" labelledBy="prompt-panel">
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside>
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <header className="space-y-1">
                    <h3 className="text-base font-semibold text-emerald-300">{t('options.promptFolderHeading')}</h3>
                    <p className="text-xs text-slate-400">{t('options.promptFolderDescription')}</p>
                  </header>
                  <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void createPromptFolder(); }}>
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
                  <h3 className="text-lg font-semibold text-emerald-300">{t('options.promptHeading')}</h3>
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
                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                          id="prompt-name"
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
                          {gpts.map((gpt) => (
                            <option key={gpt.id} value={gpt.id}>
                              {gpt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-folder">
                          {t('options.promptFolderSelectLabel')}
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
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-description">
                          {t('options.promptDescriptionLabel')}
                        </label>
                        <input
                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                          id="prompt-description"
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
                        className="min-h-[120px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                        id="prompt-content"
                        value={promptContent}
                        onChange={(event) => setPromptContent(event.target.value)}
                      />
                    </div>
                    <button
                      className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                      type="submit"
                    >
                      {t('options.createButton')}
                    </button>
                  </form>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">{t('options.columnTitle')}</th>
                        <th className="px-4 py-3">{t('options.promptFolderColumn')}</th>
                        <th className="px-4 py-3">{t('options.promptGptColumn')}</th>
                        <th className="px-4 py-3">{t('options.columnUpdated')}</th>
                        <th className="px-4 py-3 text-right">{t('options.columnActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {prompts.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6" colSpan={5}>
                            <EmptyState title={t('options.promptEmpty')} align="start" className="py-8" />
                          </td>
                        </tr>
                      ) : (
                        prompts.map((prompt) => (
                          <Fragment key={prompt.id}>
                            {editingPrompt?.id === prompt.id ? (
                              <tr className="bg-slate-900/40">
                                <td colSpan={5} className="px-4 py-3">
                                  <form className="space-y-3" onSubmit={handleSavePrompt}>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-prompt-name">
                                          {t('options.promptNameLabel')}
                                        </label>
                                        <input
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-prompt-name"
                                          value={editingPrompt.name}
                                          onChange={(event) =>
                                            updateEditingPrompt((previous) => ({ ...previous, name: event.target.value }))
                                          }
                                        />
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-prompt-gpt">
                                          {t('options.promptGptLabel')}
                                        </label>
                                        <select
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-prompt-gpt"
                                          value={editingPrompt.gptId}
                                          onChange={(event) =>
                                            updateEditingPrompt((previous) => ({ ...previous, gptId: event.target.value }))
                                          }
                                        >
                                          <option value="">{t('options.noneOption')}</option>
                                          {gpts.map((gpt) => (
                                            <option key={gpt.id} value={gpt.id}>
                                              {gpt.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-prompt-folder">
                                          {t('options.promptFolderSelectLabel')}
                                        </label>
                                        <select
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-prompt-folder"
                                          value={editingPrompt.folderId}
                                          onChange={(event) =>
                                            updateEditingPrompt((previous) => ({ ...previous, folderId: event.target.value }))
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
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-prompt-description">
                                          {t('options.promptDescriptionLabel')}
                                        </label>
                                        <input
                                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                          id="edit-prompt-description"
                                          value={editingPrompt.description}
                                          onChange={(event) =>
                                            updateEditingPrompt((previous) => ({ ...previous, description: event.target.value }))
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="edit-prompt-content">
                                        {t('options.promptContentLabel')}
                                      </label>
                                      <textarea
                                        className="min-h-[120px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                                        id="edit-prompt-content"
                                        value={editingPrompt.content}
                                        onChange={(event) =>
                                          updateEditingPrompt((previous) => ({ ...previous, content: event.target.value }))
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
                              <tr className="bg-slate-900/30">
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-100">{prompt.name}</span>
                                    {prompt.description ? (
                                      <span className="text-xs text-slate-400">{truncate(prompt.description, 90)}</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-300">
                                  {prompt.folderId ? promptFolderNameById.get(prompt.folderId) ?? t('options.noneOption') : t('options.noneOption')}
                                </td>
                                <td className="px-4 py-3 text-slate-300">
                                  {prompt.gptId ? gptById.get(prompt.gptId)?.name ?? t('options.noneOption') : t('options.noneOption')}
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
                                      onClick={() => void removePrompt(prompt.id)}
                                      type="button"
                                    >
                                      {t('options.deleteButton')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="chains" labelledBy="chain-panel">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <aside className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <header className="space-y-1">
                  <h3 className="text-base font-semibold text-emerald-300">{t('options.promptChainListHeading')}</h3>
                  <p className="text-xs text-slate-400">{t('options.promptChainListDescription')}</p>
                </header>
                {promptChains.length === 0 ? (
                  <EmptyState title={t('options.promptChainEmpty')} align="start" className="px-4 py-6 text-sm" />
                ) : (
                  <ul className="space-y-3">
                    {promptChains.map((chain) => (
                      <li
                        key={chain.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{chain.name}</p>
                            <p className="text-xs text-slate-400">
                              {t('options.promptChainPromptCount', { count: chain.nodeIds.length })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                              onClick={() => handleEditPromptChain(chain)}
                              type="button"
                            >
                              {t('options.editButton')}
                            </button>
                            <button
                              className="rounded-md border border-rose-600 px-3 py-1 text-xs uppercase tracking-wide text-rose-300 hover:bg-rose-600/20"
                              onClick={() => void removePromptChain(chain.id)}
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
              </aside>
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <header className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-100">
                    {editingPromptChain
                      ? t('options.promptChainEditTitle', { name: editingPromptChain?.name ?? '' })
                      : t('options.promptChainBuilderHeading')}
                  </h3>
                  <p className="text-xs text-slate-400">{t('options.promptChainHelper')}</p>
                </header>
                <form className="space-y-4" onSubmit={handleSavePromptChain}>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="prompt-chain-name">
                      {t('options.promptChainNameLabel')}
                    </label>
                    <input
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                      id="prompt-chain-name"
                      placeholder={t('options.promptChainNamePlaceholder') ?? ''}
                      value={promptChainName}
                      onChange={(event) => setPromptChainName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-100">{t('options.promptChainAvailableHeading')}</h4>
                      <p className="text-xs text-slate-400">{t('options.promptChainAvailableDescription')}</p>
                      {availableChainPrompts.length === 0 ? (
                        <EmptyState title={t('options.promptChainAvailableEmpty')} align="start" className="px-4 py-6 text-sm" />
                      ) : (
                        <ul className="space-y-2">
                          {availableChainPrompts.map((prompt) => (
                            <li key={prompt.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
                              <span className="text-sm text-slate-100">{prompt.name}</span>
                              <button
                                className="rounded-md border border-emerald-500 px-3 py-1 text-xs uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/10"
                                onClick={() => addPromptToChain(prompt.id)}
                                type="button"
                              >
                                {t('options.promptChainAddButton')}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-100">{t('options.promptChainStepsHeading')}</h4>
                      <p className="text-xs text-slate-400">{t('options.promptChainStepsDescription')}</p>
                      {selectedChainPrompts.length === 0 ? (
                        <EmptyState title={t('options.promptChainSelectedEmpty')} align="start" className="px-4 py-6 text-sm" />
                      ) : (
                        <ol className="space-y-2">
                          {selectedChainPrompts.map((prompt, index) => (
                            <li key={prompt.id} className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-100">
                                    {t('options.promptChainStepLabel', { index: index + 1 })}
                                  </p>
                                  <p className="text-xs text-slate-400">{prompt.name}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    aria-label={t('options.promptChainMoveUp') ?? 'Move up'}
                                    className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200"
                                    onClick={() => movePromptInChain(prompt.id, 'up')}
                                    type="button"
                                  >
                                    {t('options.promptChainMoveUp')}
                                  </button>
                                  <button
                                    aria-label={t('options.promptChainMoveDown') ?? 'Move down'}
                                    className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200"
                                    onClick={() => movePromptInChain(prompt.id, 'down')}
                                    type="button"
                                  >
                                    {t('options.promptChainMoveDown')}
                                  </button>
                                  <button
                                    className="rounded-md border border-rose-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300"
                                    onClick={() => removePromptFromChain(prompt.id)}
                                    type="button"
                                  >
                                    {t('options.promptChainRemoveButton')}
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
                      onClick={resetPromptChainForm}
                      type="button"
                    >
                      {t('options.cancelButton')}
                    </button>
                    <button
                      className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
                      type="submit"
                    >
                      {editingPromptChain ? t('options.promptChainUpdateButton') : t('options.promptChainCreateButton')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
  );
}
