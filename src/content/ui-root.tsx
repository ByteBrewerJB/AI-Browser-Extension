import React, { StrictMode, useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { ensureShadowHost } from './sidebar-host';
import { insertTextIntoComposer } from './textareaPrompts';
import { togglePinned } from '@/core/storage';
import type { BookmarkSummary, ConversationOverview } from '@/core/storage';
import type { PromptRecord } from '@/core/models';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import { EmptyState } from '@/shared/components';
import { useFolders } from '@/shared/hooks/useFolders';
import { usePinnedConversations } from '@/shared/hooks/usePinnedConversations';
import { usePrompts } from '@/shared/hooks/usePrompts';
import { useRecentBookmarks } from '@/shared/hooks/useRecentBookmarks';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import globalStylesUrl from '@/styles/global.css?url';
import { initializeSettingsStore, useSettingsStore } from '@/shared/state/settingsStore';

function ensureShadowRoot(host: HTMLElement): ShadowRoot {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  if (!shadow.querySelector('link[data-ai-companion="global-styles"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = globalStylesUrl;
    link.setAttribute('data-ai-companion', 'global-styles');
    shadow.appendChild(link);
  }

  if (!shadow.querySelector('style[data-ai-companion="reset"]')) {
    const style = document.createElement('style');
    style.setAttribute('data-ai-companion', 'reset');
    style.textContent = `
:host {
  all: initial;
  display: contents;
}
:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}
`;
    shadow.appendChild(style);
  }

  return shadow;
}

function mountReact(host: HTMLElement): HTMLDivElement {
  const shadow = ensureShadowRoot(host);
  host.textContent = '';

  let container = shadow.querySelector<HTMLDivElement>('div[data-ai-companion="root"]');
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-ai-companion', 'root');
    container.className = 'ai-companion-root';
    shadow.appendChild(container);
  }

  return container;
}

const numberFormatter = new Intl.NumberFormat();
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

type ToolbarKey = 'history' | 'prompts' | 'media';

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateTimeFormatter.format(date);
}

function normalizeTitle(title: string | null | undefined, fallback: string) {
  if (typeof title !== 'string') {
    return fallback;
  }
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function createSnippet(content: string, maxLength = 160) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function openConversationTab(conversationId: string) {
  const url = conversationId ? `https://chat.openai.com/c/${conversationId}` : 'https://chat.openai.com/';
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url }).catch((error) => {
      console.error('[ai-companion] failed to open conversation tab', error);
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openDashboard() {
  const dashboardUrl =
    typeof chrome !== 'undefined'
      ? chrome.runtime?.getURL?.('src/options/index.html') ?? chrome.runtime?.getURL?.('options.html')
      : undefined;

  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage(() => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        console.error('[ai-companion] failed to open options page', lastError);
        if (dashboardUrl) {
          if (chrome.tabs?.create) {
            chrome.tabs
              .create({ url: dashboardUrl })
              .catch((error) => console.error('[ai-companion] failed to open dashboard tab', error));
          } else {
            window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          console.error('[ai-companion] unable to resolve dashboard URL for fallback navigation');
        }
      }
    });
    return;
  }

  if (dashboardUrl) {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs
        .create({ url: dashboardUrl })
        .catch((error) => console.error('[ai-companion] failed to open dashboard tab', error));
    } else {
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  console.error('[ai-companion] dashboard URL could not be resolved');
}

interface SidebarSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function SidebarSection({ title, action, children }: SidebarSectionProps): ReactElement {
  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        {action}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface ConversationListProps {
  title: string;
  conversations: ConversationOverview[];
  emptyTitle: string;
  emptyDescription: string;
  onTogglePin: (id: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConversationList({ title, conversations, emptyTitle, emptyDescription, onTogglePin, t }: ConversationListProps) {
  return (
    <SidebarSection
      action={
        conversations.length > 0 ? (
          <button
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={() => openDashboard()}
            type="button"
          >
            {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
          </button>
        ) : undefined
      }
      title={title}
    >
      {conversations.length === 0 ? (
        <EmptyState
          align="start"
          className="px-4 py-6 text-sm"
          description={emptyDescription}
          title={emptyTitle}
        />
      ) : (
        <ul className="space-y-2">
          {conversations.map((conversation) => {
            const fallbackTitle = t('popup.untitledConversation') ?? 'Untitled conversation';
            const titleLabel = normalizeTitle(conversation.title, fallbackTitle);
            const metrics = t('popup.activityConversationMetrics', {
              messages: formatNumber(conversation.messageCount),
              words: formatNumber(conversation.wordCount)
            });
            const characterLabel = `${t('popup.characters')}: ${formatNumber(conversation.charCount)}`;
            const updatedAtLabel = formatDateTime(conversation.updatedAt);
            const pinLabel = conversation.pinned ? t('popup.unpin') : t('popup.pin');

            return (
              <li
                key={conversation.id}
                className="rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100">{titleLabel}</p>
                    <p className="text-[11px] text-slate-400">{metrics}</p>
                    <p className="text-[11px] text-slate-500">{characterLabel}</p>
                    <p className="text-[11px] text-slate-500">{t('content.promptLauncher.updatedAt', { time: updatedAtLabel })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <button
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      onClick={() => openConversationTab(conversation.id)}
                      type="button"
                    >
                      {t('popup.openConversation') ?? 'Open'}
                    </button>
                    <button
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      onClick={() => onTogglePin(conversation.id)}
                      type="button"
                    >
                      {pinLabel}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarSection>
  );
}

interface BookmarkListProps {
  bookmarks: BookmarkSummary[];
  t: ReturnType<typeof useTranslation>['t'];
}

function BookmarkList({ bookmarks, t }: BookmarkListProps) {
  return (
    <SidebarSection
      action={
        bookmarks.length > 0 ? (
          <button
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={() => openDashboard()}
            type="button"
          >
            {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
          </button>
        ) : undefined
      }
      title={t('content.sidebar.history.bookmarksHeading', { defaultValue: 'Latest bookmarks' })}
    >
      {bookmarks.length === 0 ? (
        <EmptyState
          align="start"
          className="px-4 py-6 text-sm"
          description={t('content.sidebar.history.emptyBookmarks', {
            defaultValue: 'Bookmark messages to keep quick references here.'
          })}
          title={t('popup.noBookmarks') ?? 'No bookmarks yet.'}
        />
      ) : (
        <ul className="space-y-2">
          {bookmarks.map((bookmark) => {
            const fallbackTitle = t('popup.untitledConversation') ?? 'Untitled conversation';
            const titleLabel = normalizeTitle(bookmark.conversationTitle, fallbackTitle);
            const preview = bookmark.messagePreview ?? t('popup.bookmarkConversationOnly');
            const subtitleParts = [preview];
            if (bookmark.note) {
              subtitleParts.push(t('popup.bookmarkNote', { note: bookmark.note }));
            }
            const subtitle = subtitleParts.join(' | ');
            const timestamp = formatDateTime(bookmark.createdAt);

            return (
              <li
                key={bookmark.id}
                className="rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100">{titleLabel}</p>
                    <p className="text-[11px] text-slate-400">{subtitle}</p>
                    <p className="text-[11px] text-slate-500">{t('popup.bookmarkSaved', { time: timestamp })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <button
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      onClick={() => openConversationTab(bookmark.conversationId)}
                      type="button"
                    >
                      {t('popup.openConversation') ?? 'Open'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarSection>
  );
}

interface PromptListProps {
  prompts: PromptRecord[];
  folderNames: Map<string, string>;
  t: ReturnType<typeof useTranslation>['t'];
}

function PromptList({ prompts, folderNames, t }: PromptListProps) {
  const limited = useMemo(() => prompts.slice(0, 6), [prompts]);

  return (
    <SidebarSection
      action={
        prompts.length > 0 ? (
          <button
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={() => openDashboard()}
            type="button"
          >
            {t('content.sidebar.prompts.openLibrary', { defaultValue: 'Open prompt library' })}
          </button>
        ) : undefined
      }
      title={t('content.sidebar.prompts.heading', { defaultValue: 'Prompt templates' })}
    >
      {limited.length === 0 ? (
        <EmptyState
          align="start"
          className="px-4 py-6 text-sm"
          description={t('content.sidebar.prompts.empty', {
            defaultValue: 'Save prompts in the dashboard or popup to reuse them here.'
          })}
          title={t('content.sidebar.prompts.emptyTitle', { defaultValue: 'No prompts yet.' })}
        />
      ) : (
        <ul className="space-y-2">
          {limited.map((prompt) => {
            const folderName = prompt.folderId ? folderNames.get(prompt.folderId) : undefined;
            const folderLabel = folderName
              ? t('content.promptLauncher.folderLabel', { name: folderName })
              : t('options.noneOption', { defaultValue: 'None' });
            const updatedAtLabel = formatDateTime(prompt.updatedAt);

            return (
              <li
                key={prompt.id}
                className="rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100">{prompt.name}</p>
                    {prompt.description ? (
                      <p className="text-[11px] text-slate-400">{prompt.description}</p>
                    ) : null}
                    <p className="text-[11px] text-slate-500">{createSnippet(prompt.content)}</p>
                    <p className="text-[11px] text-slate-500">{folderLabel}</p>
                    <p className="text-[11px] text-slate-500">{t('content.promptLauncher.updatedAt', { time: updatedAtLabel })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <button
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      onClick={() => {
                        const inserted = insertTextIntoComposer(prompt.content);
                        if (!inserted) {
                          return;
                        }
                      }}
                      type="button"
                    >
                      {t('content.promptLauncher.insertButton', { defaultValue: 'Insert' })}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarSection>
  );
}

function HistoryTab(): ReactElement {
  const { t } = useTranslation();
  const pinnedConversations = usePinnedConversations(6);
  const recentConversations = useRecentConversations(6);
  const bookmarks = useRecentBookmarks(4);

  const handleTogglePin = useCallback((conversationId: string) => {
    void togglePinned(conversationId);
  }, []);

  return (
    <div className="space-y-4">
      <SidebarSection
        action={
          pinnedConversations.length > 0 ? (
            <button
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => openDashboard()}
              type="button"
            >
              {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
            </button>
          ) : undefined
        }
        title={t('content.sidebar.history.pinnedHeading', { defaultValue: 'Pinned conversations' })}
      >
        {pinnedConversations.length === 0 ? (
          <EmptyState
            align="start"
            className="px-4 py-6 text-sm"
            description={t('content.sidebar.history.emptyPinned', {
              defaultValue: 'Pin chats from ChatGPT to keep them handy.'
            })}
            title={t('popup.noPinned', { defaultValue: 'No pinned chats yet.' })}
          />
        ) : (
          <ul className="space-y-2">
            {pinnedConversations.map((conversation) => {
              const fallbackTitle = t('popup.untitledConversation') ?? 'Untitled conversation';
              const titleLabel = normalizeTitle(conversation.title, fallbackTitle);
              const metrics = t('popup.activityConversationMetrics', {
                messages: formatNumber(conversation.messageCount),
                words: formatNumber(conversation.wordCount)
              });
              const characterLabel = `${t('popup.characters')}: ${formatNumber(conversation.charCount)}`;
              const updatedAtLabel = formatDateTime(conversation.updatedAt);

              return (
                <li
                  key={conversation.id}
                  className="rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-100">{titleLabel}</p>
                      <p className="text-[11px] text-slate-400">{metrics}</p>
                      <p className="text-[11px] text-slate-500">{characterLabel}</p>
                      <p className="text-[11px] text-slate-500">{t('content.promptLauncher.updatedAt', { time: updatedAtLabel })}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <button
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        onClick={() => openConversationTab(conversation.id)}
                        type="button"
                      >
                        {t('popup.openConversation') ?? 'Open'}
                      </button>
                      <button
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        onClick={() => handleTogglePin(conversation.id)}
                        type="button"
                      >
                        {t('popup.unpin')}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SidebarSection>

      <ConversationList
        conversations={recentConversations}
        emptyDescription={t('content.sidebar.history.emptyRecent', {
          defaultValue: 'Start chatting to populate your history.'
        })}
        emptyTitle={t('content.sidebar.history.recentHeading', { defaultValue: 'Recent updates' })}
        onTogglePin={handleTogglePin}
        t={t}
        title={t('content.sidebar.history.recentHeading', { defaultValue: 'Recent updates' })}
      />

      <BookmarkList bookmarks={bookmarks} t={t} />
    </div>
  );
}

function PromptsTab(): ReactElement {
  const { t } = useTranslation();
  const prompts = usePrompts();
  const folders = useFolders('prompt');

  const folderNames = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [folders]);

  return <PromptList folderNames={folderNames} prompts={prompts} t={t} />;
}

function MediaTab(): ReactElement {
  const { t } = useTranslation();

  return (
    <SidebarSection
      action={
        <button
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          onClick={() => openDashboard()}
          type="button"
        >
          {t('content.sidebar.media.openOptions', { defaultValue: 'Open dashboard' })}
        </button>
      }
      title={t('content.sidebar.media.heading', { defaultValue: 'Voice & sync' })}
    >
      <p className="text-sm text-slate-300">
        {t('content.sidebar.media.description', {
          defaultValue: 'Manage audio downloads, voice playback, and sync preferences from the dashboard.'
        })}
      </p>
    </SidebarSection>
  );
}

interface CompanionSidebarRootProps {
  host: HTMLElement;
}

function CompanionSidebarRoot({ host }: CompanionSidebarRootProps): ReactElement | null {
  const { hydrated, showSidebar } = useSettingsStore((state) => ({
    hydrated: state.hydrated,
    showSidebar: state.showSidebar
  }));

  useEffect(() => {
    const shouldShow = hydrated && showSidebar;
    host.style.display = shouldShow ? '' : 'none';
    return () => {
      host.style.display = '';
    };
  }, [host, hydrated, showSidebar]);

  if (!hydrated || !showSidebar) {
    return null;
  }

  return <CompanionSidebar />;
}


function CompanionSidebar(): ReactElement {
  const { t } = useTranslation();
  const modalHeadingId = useId();
  const [activeToolbar, setActiveToolbar] = useState<ToolbarKey>('history');
  const [isModalOpen, setModalOpen] = useState(false);

  const toolbarLabel = useMemo(
    () => t(`content.sidebar.toolbars.${activeToolbar}` as const),
    [activeToolbar, t]
  );

  const modalPoints = useMemo(() => {
    const points = t('content.sidebar.modal.points', { returnObjects: true });
    return Array.isArray(points) ? (points as string[]) : [];
  }, [t]);

  return (
    <div className="pointer-events-auto w-full rounded-lg border border-white/10 bg-slate-900/70 p-3 text-slate-100 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-300">{t('content.sidebar.title')}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">{toolbarLabel}</h2>
        </div>
        <button
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          aria-label={t('content.sidebar.patternButtonAria')}
          onClick={() => setModalOpen(true)}
          type="button"
        >
          {t('content.sidebar.patternButton')}
        </button>
      </header>
      <Tabs
        defaultValue="history"
        onChange={(value) => {
          if (value === 'history' || value === 'prompts' || value === 'media') {
            setActiveToolbar(value);
          }
        }}
      >
        <TabList className="mb-3 flex flex-nowrap gap-1 rounded-lg bg-white/5 p-1 text-sm text-slate-200">
          <Tab
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 aria-selected:bg-white/10 aria-selected:text-slate-100"
            value="history"
          >
            {t('content.sidebar.tabs.history')}
          </Tab>
          <Tab
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 aria-selected:bg-white/10 aria-selected:text-slate-100"
            value="prompts"
          >
            {t('content.sidebar.tabs.prompts')}
          </Tab>
          <Tab
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 aria-selected:bg-white/10 aria-selected:text-slate-100"
            value="media"
          >
            {t('content.sidebar.tabs.media')}
          </Tab>
        </TabList>
        <TabPanels className="rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-200">
          <TabPanel value="history">
            <HistoryTab />
          </TabPanel>
          <TabPanel value="prompts">
            <PromptsTab />
          </TabPanel>
          <TabPanel value="media">
            <MediaTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Modal labelledBy={modalHeadingId} onClose={() => setModalOpen(false)} open={isModalOpen}>
        <ModalHeader className="space-y-2">
          <h3 id={modalHeadingId} className="text-lg font-semibold text-slate-100">
            {t('content.sidebar.modal.title')}
          </h3>
          <p className="text-sm text-slate-300">{t('content.sidebar.modal.description')}</p>
        </ModalHeader>
        <ModalBody>
          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-200">
            {modalPoints.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </ModalBody>
        <ModalFooter>
          <button
            className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            aria-label={t('content.sidebar.modal.closeAria')}
            onClick={() => setModalOpen(false)}
            type="button"
          >
            {t('content.sidebar.modal.close')}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

async function init() {
  await initializeSettingsStore();
  if (!useSettingsStore.getState().showSidebar) {
    return;
  }

  const host = await ensureShadowHost();
  const container = mountReact(host);
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <CompanionSidebar />
    </StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}







