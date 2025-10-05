import React, { StrictMode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from '@/shared/i18n/useTranslation';
import { ensureShadowHost } from './sidebar-host';
import { insertTextIntoComposer } from './textareaPrompts';
import { collectMessageElements, getConversationId, getConversationTitle } from './chatDom';
import {
  archiveConversations,
  createPrompt,
  getBookmarks,
  getConversationOverviewById,
  toggleBookmark,
  togglePinned,
  upsertConversation
} from '@/core/storage';
import type { BookmarkSummary, ConversationOverview, FolderTreeNode } from '@/core/storage';
import type { BookmarkRecord, PromptRecord } from '@/core/models';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { MoveDialog, type MoveDialogOption } from '@/ui/components/MoveDialog';
import { EmptyState } from '@/shared/components';
import { useFolders } from '@/shared/hooks/useFolders';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
import { usePinnedConversations } from '@/shared/hooks/usePinnedConversations';
import { usePrompts } from '@/shared/hooks/usePrompts';
import { useRecentBookmarks } from '@/shared/hooks/useRecentBookmarks';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import { useBubbleLauncherStore } from '@/shared/state/bubbleLauncherStore';
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

const CONVERSATION_BOOKMARK_KEY = '__conversation__';

interface BookmarkCandidateOption {
  key: string;
  messageId: string | null;
  title: string;
  subtitle: string;
}

function normalizeMessageContent(content: string) {
  return content.replace(/\s+/g, ' ').trim();
}

function toBookmarkKey(messageId: string | null | undefined) {
  return messageId ? `message:${messageId}` : CONVERSATION_BOOKMARK_KEY;
}

function formatBookmarkRole(
  role: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t']
) {
  switch ((role ?? '').toLowerCase()) {
    case 'user':
      return t('content.sidebar.history.bookmarkModalRoleUser', { defaultValue: 'You' });
    case 'assistant':
      return t('content.sidebar.history.bookmarkModalRoleAssistant', { defaultValue: 'Assistant' });
    case 'system':
      return t('content.sidebar.history.bookmarkModalRoleSystem', { defaultValue: 'System' });
    case 'tool':
      return t('content.sidebar.history.bookmarkModalRoleTool', { defaultValue: 'Tool' });
    default:
      return t('content.sidebar.history.bookmarkModalRoleDefault', { defaultValue: 'Message' });
  }
}

interface BookmarkTarget {
  messageId: string | null;
}

type ContextMenuAction = 'pin' | 'prompt' | 'copy';

type ActionTone = 'neutral' | 'success' | 'error';

interface ActionToast {
  id: number;
  message: string;
  tone: ActionTone;
}

interface ContextMenuState {
  position: { x: number; y: number };
  conversationId: string;
  conversationTitle: string;
  messageId: string | null;
  messageRole: string | null;
  messagePreview: string;
  messageText: string;
  pinned: boolean;
  hasText: boolean;
}

interface BookmarkDialogProps {
  open: boolean;
  onClose: () => void;
  initialTarget?: BookmarkTarget | null;
  t: ReturnType<typeof useTranslation>['t'];
}

function BookmarkDialog({ open, onClose, initialTarget, t }: BookmarkDialogProps): ReactElement | null {
  const headingId = useId();
  const descriptionId = `${headingId}-description`;
  const noteFieldId = `${headingId}-note`;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BookmarkCandidateOption[]>([]);
  const [existingMap, setExistingMap] = useState<Map<string, BookmarkRecord>>(new Map());
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialKey = useMemo(() => {
    if (!initialTarget) {
      return undefined;
    }
    return toBookmarkKey(initialTarget.messageId ?? null);
  }, [initialTarget]);

  useEffect(() => {
    if (!open) {
      setConversationId(null);
      setCandidates([]);
      setExistingMap(new Map());
      setSelectedKey('');
      setNote('');
      setPending(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const resolvedConversationId = getConversationId();
      if (cancelled) {
        return;
      }

      setConversationId(resolvedConversationId);

      const elements = collectMessageElements();
      const seen = new Set<string>();
      const messageCandidates: BookmarkCandidateOption[] = [];

      for (const element of elements) {
        const messageId = element.getAttribute('data-message-id');
        if (!messageId) {
          continue;
        }
        const key = toBookmarkKey(messageId);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const rawText = normalizeMessageContent(element.textContent ?? '');
        if (!rawText) {
          continue;
        }

        const role = element.getAttribute('data-message-author-role');
        const roleLabel = formatBookmarkRole(role, t);
        const title = t('content.sidebar.history.bookmarkModalMessageTitle', {
          role: roleLabel,
          defaultValue: '{{role}} message'
        });

        messageCandidates.push({
          key,
          messageId,
          title,
          subtitle: createSnippet(rawText, 200)
        });
      }

      const nextCandidates: BookmarkCandidateOption[] = [];

      if (resolvedConversationId) {
        nextCandidates.push({
          key: CONVERSATION_BOOKMARK_KEY,
          messageId: null,
          title: t('content.sidebar.history.bookmarkModalConversationOption', {
            defaultValue: 'Bookmark entire conversation'
          }),
          subtitle: t('content.sidebar.history.bookmarkModalConversationDescription', {
            defaultValue: 'Save without linking to a specific message.'
          })
        });
      }

      nextCandidates.push(...messageCandidates);

      let bookmarkMap = new Map<string, BookmarkRecord>();

      if (resolvedConversationId) {
        try {
          const bookmarks = await getBookmarks(resolvedConversationId);
          if (!cancelled) {
            bookmarkMap = new Map(
              bookmarks.map((bookmark) => [toBookmarkKey(bookmark.messageId ?? null), bookmark])
            );
          }
        } catch (loadError) {
          console.error('[ai-companion] failed to load conversation bookmarks', loadError);
          if (!cancelled) {
            setError(
              t('content.sidebar.history.bookmarkModalLoadError', {
                defaultValue: 'We could not load existing bookmarks. Try again later.'
              })
            );
          }
        }
      }

      if (cancelled) {
        return;
      }

      setCandidates(nextCandidates);
      setExistingMap(bookmarkMap);

      const candidateKeys = new Set(nextCandidates.map((candidate) => candidate.key));
      const defaultKey =
        initialKey && candidateKeys.has(initialKey)
          ? initialKey
          : bookmarkMap.size > 0
            ? bookmarkMap.keys().next().value ?? nextCandidates[0]?.key ?? ''
            : nextCandidates[0]?.key ?? '';

      setSelectedKey(defaultKey);
      const defaultBookmark = defaultKey ? bookmarkMap.get(defaultKey) : undefined;
      setNote(defaultBookmark?.note ?? '');
      setError(null);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialKey, open, t]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.key === selectedKey) ?? null,
    [candidates, selectedKey]
  );

  const selectedBookmark = selectedCandidate
    ? existingMap.get(selectedCandidate.key)
    : undefined;

  const handleCandidateChange = useCallback(
    (key: string) => {
      setSelectedKey(key);
      const bookmark = existingMap.get(key);
      setNote(bookmark?.note ?? '');
      setError(null);
    },
    [existingMap]
  );

  const handleNoteChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setNote(event.target.value);
  }, []);

  const handleRequestClose = useCallback(() => {
    if (pending) {
      return;
    }
    onClose();
  }, [onClose, pending]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      if (!conversationId || !selectedCandidate) {
        setError(
          t('content.sidebar.history.bookmarkModalNoConversation', {
            defaultValue: 'Open a ChatGPT conversation to add bookmarks.'
          })
        );
        return;
      }

      const bookmark = selectedBookmark;
      const trimmedNote = note.trim();
      const normalizedExistingNote = bookmark?.note?.trim() ?? '';
      if (bookmark && normalizedExistingNote === trimmedNote) {
        onClose();
        return;
      }

      const noteValue = trimmedNote.length > 0 ? trimmedNote : undefined;

      setPending(true);
      setError(null);

      try {
        const targetMessageId = selectedCandidate.messageId ?? undefined;
        if (bookmark) {
          await toggleBookmark(conversationId, targetMessageId);
          await toggleBookmark(conversationId, targetMessageId, noteValue);
        } else {
          await toggleBookmark(conversationId, targetMessageId, noteValue);
        }
        onClose();
      } catch (submitError) {
        console.error('[ai-companion] failed to save bookmark', submitError);
        setError(
          t('content.sidebar.history.bookmarkModalError', {
            defaultValue: 'Failed to save bookmark. Please try again.'
          })
        );
      } finally {
        setPending(false);
      }
    },
    [conversationId, note, onClose, pending, selectedBookmark, selectedCandidate, t]
  );

  const handleRemove = useCallback(async () => {
    if (pending) {
      return;
    }
    if (!conversationId || !selectedCandidate) {
      return;
    }
    try {
      setPending(true);
      setError(null);
      await toggleBookmark(conversationId, selectedCandidate.messageId ?? undefined);
      onClose();
    } catch (removeError) {
      console.error('[ai-companion] failed to remove bookmark', removeError);
      setError(
        t('content.sidebar.history.bookmarkModalRemoveError', {
          defaultValue: 'Failed to remove bookmark. Please try again.'
        })
      );
    } finally {
      setPending(false);
    }
  }, [conversationId, onClose, pending, selectedCandidate, t]);

  const disableSubmit = !conversationId || !selectedCandidate || pending;

  return (
    <Modal
      open={open}
      onClose={handleRequestClose}
      labelledBy={headingId}
      describedBy={descriptionId}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <ModalHeader className="space-y-2">
          <h3 id={headingId} className="text-lg font-semibold text-slate-100">
            {t('content.sidebar.history.bookmarkModalTitle', { defaultValue: 'Save bookmark' })}
          </h3>
          <p id={descriptionId} className="text-sm text-slate-300">
            {t('content.sidebar.history.bookmarkModalDescription', {
              defaultValue: 'Choose a message and add an optional note to store it in your bookmark bubble.'
            })}
          </p>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {conversationId ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('content.sidebar.history.bookmarkModalSelectLabel', { defaultValue: 'Choose a target' })}
                </p>
                {candidates.length === 0 ? (
                  <p className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
                    {t('content.sidebar.history.bookmarkModalNoMessages', {
                      defaultValue: 'No messages available yet. Send a prompt or wait for responses to appear.'
                    })}
                  </p>
                ) : (
                  <ul className="space-y-2" role="radiogroup" aria-labelledby={headingId}>
                    {candidates.map((candidate) => {
                      const isSelected = candidate.key === selectedKey;
                      const existing = existingMap.get(candidate.key);
                      return (
                        <li key={candidate.key}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                              isSelected
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                                : 'border-white/10 bg-slate-900/60 text-slate-200 hover:border-emerald-400 hover:text-emerald-100'
                            }`}
                          >
                            <input
                              type="radio"
                              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                              name={`${headingId}-target`}
                              value={candidate.key}
                              checked={isSelected}
                              onChange={() => handleCandidateChange(candidate.key)}
                              disabled={pending}
                            />
                            <span className="flex-1 space-y-1">
                              <span className="flex items-center justify-between gap-3">
                                <span className="font-semibold">{candidate.title}</span>
                                {existing ? (
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                    {t('content.sidebar.history.bookmarkModalExistingBadge', {
                                      defaultValue: 'Saved'
                                    })}
                                  </span>
                                ) : null}
                              </span>
                              <span className="block text-xs text-slate-300">{candidate.subtitle}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                  htmlFor={noteFieldId}
                >
                  {t('content.sidebar.history.bookmarkModalNoteLabel', { defaultValue: 'Note (optional)' })}
                </label>
                <textarea
                  id={noteFieldId}
                  className="min-h-[96px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  value={note}
                  onChange={handleNoteChange}
                  placeholder={t('content.sidebar.history.bookmarkModalNotePlaceholder', {
                    defaultValue: 'Add context or reminders for this bookmark.'
                  })}
                  disabled={pending || !selectedCandidate}
                />
                <p className="text-xs text-slate-500">
                  {selectedBookmark
                    ? t('content.sidebar.history.bookmarkModalUpdateInfo', {
                        defaultValue: 'Saving will update the note for this bookmark.'
                      })
                    : t('content.sidebar.history.bookmarkModalCreateInfo', {
                        defaultValue: 'Notes help you remember why you saved the message.'
                      })}
                </p>
              </div>
            </>
          ) : (
            <p className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
              {t('content.sidebar.history.bookmarkModalNoConversation', {
                defaultValue: 'Open a ChatGPT conversation to add bookmarks.'
              })}
            </p>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {selectedBookmark ? (
              <button
                type="button"
                className="rounded-md border border-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-rose-300 transition hover:bg-rose-600/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                onClick={handleRemove}
                disabled={pending}
              >
                {t('content.sidebar.history.bookmarkModalRemove', { defaultValue: 'Remove bookmark' })}
              </button>
            ) : null}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
              onClick={handleRequestClose}
              disabled={pending}
            >
              {t('content.sidebar.history.bookmarkModalCancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={disableSubmit}
            >
              {selectedBookmark
                ? t('content.sidebar.history.bookmarkModalUpdate', { defaultValue: 'Update bookmark' })
                : t('content.sidebar.history.bookmarkModalSave', { defaultValue: 'Save bookmark' })}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface FolderOption {
  id: string;
  name: string;
  depth: number;
  favorite: boolean;
}

function flattenFolderTree(nodes: FolderTreeNode[], depth = 0): FolderOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth, favorite: Boolean(node.favorite) },
    ...flattenFolderTree(node.children, depth + 1)
  ]);
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

interface OpenDashboardOptions {
  searchParams?: Record<string, string | undefined>;
}

function resolveDashboardUrl() {
  if (typeof chrome === 'undefined') {
    return undefined;
  }
  return chrome.runtime?.getURL?.('src/options/index.html') ?? chrome.runtime?.getURL?.('options.html');
}

function buildDashboardUrl(searchParams?: Record<string, string | undefined>) {
  const baseUrl = resolveDashboardUrl();
  if (!baseUrl) {
    return undefined;
  }

  if (!searchParams) {
    return baseUrl;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value != null && value !== '') {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function openDashboard(options?: OpenDashboardOptions) {
  const searchParams = options?.searchParams;
  const dashboardUrl = buildDashboardUrl(searchParams);

  if (!searchParams && typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
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
  onMove: (conversation: ConversationOverview) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConversationList({ title, conversations, emptyTitle, emptyDescription, onTogglePin, onMove, t }: ConversationListProps) {
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
                      onClick={() => onMove(conversation)}
                      type="button"
                    >
                      {t('content.sidebar.history.moveAction', { defaultValue: 'Move' })}
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
  onAddBookmark: (target?: BookmarkTarget) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BookmarkList({ bookmarks, onAddBookmark, t }: BookmarkListProps) {
  return (
    <SidebarSection
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={() => onAddBookmark()}
            type="button"
          >
            {t('content.sidebar.history.addBookmark', { defaultValue: 'Bookmark message' })}
          </button>
          {bookmarks.length > 0 ? (
            <button
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => openDashboard()}
              type="button"
            >
              {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
            </button>
          ) : null}
        </div>
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

interface HistoryTabProps {
  onAddBookmark: (target?: BookmarkTarget) => void;
}

function HistoryTab({ onAddBookmark }: HistoryTabProps): ReactElement {
  const { t } = useTranslation();
  const pinnedConversations = usePinnedConversations(6);
  const conversationFolders = useFolderTree('conversation');
  const recentConversations = useRecentConversations(6);
  const bookmarks = useRecentBookmarks(4);

  const handleTogglePin = useCallback((conversationId: string) => {
    void togglePinned(conversationId);
  }, []);

  const handleArchiveToggle = useCallback((conversationId: string, archived: boolean | undefined) => {
    void archiveConversations([conversationId], !archived);
  }, []);

  const folderOptions = useMemo(() => flattenFolderTree(conversationFolders), [conversationFolders]);

  const [moveTarget, setMoveTarget] = useState<ConversationOverview | null>(null);
  const [movePending, setMovePending] = useState(false);

  const moveDialogOptions = useMemo<MoveDialogOption[]>(
    () =>
      folderOptions.map((folder) => ({
        id: folder.id,
        label: folder.name,
        depth: folder.depth,
        favorite: folder.favorite
      })),
    [folderOptions]
  );

  const openMoveDialog = useCallback((conversation: ConversationOverview) => {
    setMoveTarget(conversation);
  }, []);

  const handleMoveDialogClose = useCallback(() => {
    if (!movePending) {
      setMoveTarget(null);
    }
  }, [movePending]);

  const handleMoveSubmit = useCallback(
    async (folderId?: string) => {
      if (!moveTarget) {
        return;
      }
      setMovePending(true);
      try {
        await upsertConversation({
          id: moveTarget.id,
          title: moveTarget.title,
          folderId,
          pinned: moveTarget.pinned,
          archived: moveTarget.archived ?? false,
          createdAt: moveTarget.createdAt,
          wordCount: moveTarget.wordCount,
          charCount: moveTarget.charCount
        });
        setMoveTarget(null);
      } catch (error) {
        console.error('[ai-companion] failed to move conversation', error);
      } finally {
        setMovePending(false);
      }
    },
    [moveTarget]
  );



  const fallbackTitle = t('popup.untitledConversation') ?? 'Untitled conversation';
  const moveDialogTitle = moveTarget
    ? t('content.sidebar.history.moveDialogTitle', {
        title: normalizeTitle(moveTarget.title, fallbackTitle)
      })
    : t('content.sidebar.history.moveDialogTitleDefault', { defaultValue: 'Move conversation' });
  const moveDialogDescription = moveTarget
    ? t('content.sidebar.history.moveDialogDescription', {
        title: normalizeTitle(moveTarget.title, fallbackTitle)
      })
    : t('content.sidebar.history.moveDialogDescriptionDefault', {
        defaultValue: 'Select a destination folder for this conversation.'
      });


  const handleNavigateToFolder = useCallback((folderId: string | undefined) => {
    const searchParams: Record<string, string | undefined> = {
      view: 'history',
      historyFolder: folderId ?? 'all'
    };
    openDashboard({ searchParams });
  }, []);

  return (
    <div className="space-y-4">
      <SidebarSection
        action={
          pinnedConversations.length > 0 || folderOptions.length > 0
            ? (
                <button
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  onClick={() => openDashboard({ searchParams: { view: 'history' } })}
                  type="button"
                >
                  {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
                </button>
              )
            : undefined
        }
        title={t('content.sidebar.history.pinnedHeading', { defaultValue: 'Pinned conversations' })}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
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
                  const archiveLabel = conversation.archived
                    ? t('content.sidebar.history.restore', { defaultValue: 'Restore' })
                    : t('content.sidebar.history.archive', { defaultValue: 'Archive' });

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
                          <p className="text-[11px] text-slate-500">
                            {t('content.promptLauncher.updatedAt', { time: updatedAtLabel })}
                          </p>
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
                            onClick={() => openMoveDialog(conversation)}
                            type="button"
                          >
                            {t('content.sidebar.history.moveAction', { defaultValue: 'Move' })}
                          </button>

                          <button
                            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            onClick={() => handleTogglePin(conversation.id)}
                            type="button"
                          >
                            {t('popup.unpin')}
                          </button>
                          <button
                            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            onClick={() => handleArchiveToggle(conversation.id, conversation.archived)}
                            type="button"
                          >
                            {archiveLabel}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="rounded-md border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {t('content.sidebar.history.folderShortcuts', { defaultValue: 'Folder shortcuts' })}
            </p>
            {folderOptions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                {t('content.sidebar.history.folderShortcutsEmpty', {
                  defaultValue: 'Create folders in the dashboard to access them quickly here.'
                })}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                <li>
                  <button
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    onClick={() => handleNavigateToFolder(undefined)}
                    type="button"
                  >
                    {t('options.filterFolderAll', { defaultValue: 'All folders' })}
                  </button>
                </li>
                {folderOptions.map((folder) => (
                  <li key={folder.id}>
                    <button
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      onClick={() => handleNavigateToFolder(folder.id)}
                      type="button"
                    >
                      <span
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${folder.depth * 12}px` }}
                      >
                        <span className="truncate">{folder.name}</span>
                        {folder.favorite ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            {t('content.sidebar.history.favoriteBadge', { defaultValue: 'Fav' })}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SidebarSection>

      <ConversationList
        conversations={recentConversations}
        emptyDescription={t('content.sidebar.history.emptyRecent', {
          defaultValue: 'Start chatting to populate your history.'
        })}
        emptyTitle={t('content.sidebar.history.recentHeading', { defaultValue: 'Recent updates' })}
        onMove={openMoveDialog}
        onTogglePin={handleTogglePin}
        t={t}
        title={t('content.sidebar.history.recentHeading', { defaultValue: 'Recent updates' })}
      />

      <BookmarkList bookmarks={bookmarks} onAddBookmark={onAddBookmark} t={t} />
      <MoveDialog
        open={Boolean(moveTarget)}
        title={moveDialogTitle}
        description={moveDialogDescription}
        currentFolderId={moveTarget?.folderId}
        rootOptionLabel={t('content.sidebar.history.moveRoot', { defaultValue: 'No folder (top level)' })}
        confirmLabel={t('content.sidebar.history.moveConfirm', { defaultValue: 'Move' })}
        cancelLabel={t('content.sidebar.history.moveCancel', { defaultValue: 'Cancel' })}
        folders={moveDialogOptions}
        pending={movePending}
        onMove={handleMoveSubmit}
        onClose={handleMoveDialogClose}
      />
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

interface ContextMenuOverlayProps {
  state: ContextMenuState | null;
  pendingAction: ContextMenuAction | null;
  onClose: () => void;
  onBookmark: () => void;
  onSavePrompt: () => void;
  onCopy: () => void;
  onTogglePin: () => void;
  onOpenDashboard: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ContextMenuOverlay({
  state,
  pendingAction,
  onClose,
  onBookmark,
  onSavePrompt,
  onCopy,
  onTogglePin,
  onOpenDashboard,
  t
}: ContextMenuOverlayProps): ReactElement | null {
  if (!state) {
    return null;
  }

  const roleLabel = formatBookmarkRole(state.messageRole, t);
  const bookmarkLabel = state.messageId
    ? t('content.sidebar.history.contextMenuBookmarkMessage', { defaultValue: 'Bookmark message' })
    : t('content.sidebar.history.contextMenuBookmarkConversation', { defaultValue: 'Bookmark conversation' });
  const promptLabel = t('content.sidebar.history.contextMenuSavePrompt', { defaultValue: 'Save as prompt' });
  const copyLabel = t('content.sidebar.history.contextMenuCopy', { defaultValue: 'Copy message text' });
  const pinLabel = state.pinned
    ? t('content.sidebar.history.contextMenuUnpin', { defaultValue: 'Unpin conversation' })
    : t('content.sidebar.history.contextMenuPin', { defaultValue: 'Pin conversation' });
  const dashboardLabel = t('content.sidebar.history.contextMenuOpenDashboard', { defaultValue: 'Open dashboard' });
  const disabledTextLabel = t('content.sidebar.history.contextMenuNoText', {
    defaultValue: 'Message has no text to reuse.'
  });

  const isPromptDisabled = !state.hasText || pendingAction === 'prompt';
  const isCopyDisabled = !state.hasText || pendingAction === 'copy';
  const isPinDisabled = pendingAction === 'pin';

  return (
    <div
      className="fixed inset-0 z-[2147483646]"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute w-64 rounded-lg border border-white/10 bg-slate-950/90 px-1 py-1 text-sm text-slate-100 shadow-2xl backdrop-blur"
        style={{ left: `${state.position.x}px`, top: `${state.position.y}px` }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="border-b border-white/10 px-3 py-2 text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t('content.sidebar.history.contextMenuTitle', { defaultValue: 'Quick actions' })}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-200">{roleLabel}</p>
          <p className="mt-1 max-h-12 overflow-hidden text-ellipsis text-xs text-slate-400" style={{ wordBreak: 'break-word' }}>
            {state.messagePreview}
          </p>
        </div>
        <div className="space-y-1 px-1 py-1">
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={onBookmark}
            type="button"
          >
            <span>{bookmarkLabel}</span>
          </button>
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:text-slate-500"
            onClick={onSavePrompt}
            type="button"
            disabled={isPromptDisabled}
            title={state.hasText ? undefined : disabledTextLabel}
          >
            <span>{promptLabel}</span>
          </button>
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:text-slate-500"
            onClick={onCopy}
            type="button"
            disabled={isCopyDisabled}
            title={state.hasText ? undefined : disabledTextLabel}
          >
            <span>{copyLabel}</span>
          </button>
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:text-slate-500"
            onClick={onTogglePin}
            type="button"
            disabled={isPinDisabled}
          >
            <span>{pinLabel}</span>
          </button>
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={onOpenDashboard}
            type="button"
          >
            <span>{dashboardLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionToastViewProps {
  toast: ActionToast | null;
}

function ActionToastView({ toast }: ActionToastViewProps): ReactElement | null {
  if (!toast) {
    return null;
  }

  const toneClass =
    toast.tone === 'success'
      ? 'bg-emerald-400 text-emerald-950'
      : toast.tone === 'error'
        ? 'bg-rose-500 text-rose-50'
        : 'bg-slate-800 text-slate-100';

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[2147483647]">
      <div className={`rounded-md px-4 py-2 text-sm font-medium shadow-lg ${toneClass}`}>
        {toast.message}
      </div>
    </div>
  );
}

interface CompanionSidebarRootProps {
  host: HTMLElement;
}

function CompanionSidebarRoot({ host }: CompanionSidebarRootProps): ReactElement | null {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const showSidebar = useSettingsStore((state) => state.showSidebar);
  const { t } = useTranslation();
  const { activeBubble, setActiveBubble } = useBubbleLauncherStore();

  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkDialogTarget, setBookmarkDialogTarget] = useState<BookmarkTarget | null>(null);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const [contextMenuPending, setContextMenuPending] = useState<ContextMenuAction | null>(null);
  const [toast, setToast] = useState<ActionToast | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [isPatternModalOpen, setPatternModalOpen] = useState(false);
  const modalHeadingId = useId();

  useEffect(() => {
    const shouldShow = hydrated && showSidebar;
    host.style.display = shouldShow ? '' : 'none';

    if (!shouldShow) {
      setActiveBubble(null);
    }

    return () => {
      host.style.display = '';
    };
  }, [host, hydrated, showSidebar, setActiveBubble]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string, tone: ActionTone = 'neutral') => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuState(null);
    setContextMenuPending(null);
  }, []);

  useEffect(() => {
    return () => {
      closeContextMenu();
    };
  }, [closeContextMenu]);

  const handleOpenBookmarkDialog = useCallback(
    (target?: BookmarkTarget) => {
      setBookmarkDialogTarget(target ?? null);
      setBookmarkDialogOpen(true);
      closeContextMenu();
    },
    [closeContextMenu]
  );

  const handleCloseBookmarkDialog = useCallback(() => {
    setBookmarkDialogOpen(false);
    setBookmarkDialogTarget(null);
  }, []);

  useEffect(() => {
    if (!hydrated || !showSidebar) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest('[data-message-author-role]');
      if (!target) {
        return;
      }

      const conversationId = getConversationId();
      if (!conversationId) {
        return;
      }

      event.preventDefault();

      const role = target.getAttribute('data-message-author-role');
      const messageId = target.getAttribute('data-message-id');
      const rawText = normalizeMessageContent(target.textContent ?? '');
      const conversationTitle = getConversationTitle();
      const previewSource = rawText || conversationTitle;
      const messagePreview = createSnippet(previewSource, 160);
      const hasText = rawText.length > 0;

      const adjustedX = Math.min(event.clientX, window.innerWidth - 272);
      const adjustedY = Math.min(event.clientY, window.innerHeight - 216);

      setContextMenuState({
        position: { x: adjustedX, y: adjustedY },
        conversationId,
        conversationTitle,
        messageId: messageId ?? null,
        messageRole: role,
        messagePreview,
        messageText: rawText,
        pinned: false,
        hasText
      });
      setContextMenuPending(null);

      void getConversationOverviewById(conversationId)
        .then((overview) => {
          setContextMenuState((current) => {
            if (!current || current.conversationId !== conversationId) {
              return current;
            }
            return { ...current, pinned: overview?.pinned ?? false };
          });
        })
        .catch((error) => {
          console.error('[ai-companion] failed to resolve conversation for context menu', error);
        });
    };

    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [hydrated, showSidebar]);

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleScroll = () => {
      closeContextMenu();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenuState, closeContextMenu]);

  useEffect(() => {
    if (!showSidebar) {
      setContextMenuState(null);
    }
  }, [showSidebar]);

  const handleBookmarkFromContext = useCallback(() => {
    if (!contextMenuState) {
      return;
    }
    handleOpenBookmarkDialog({ messageId: contextMenuState.messageId });
  }, [contextMenuState, handleOpenBookmarkDialog]);

  const handleSavePromptFromContext = useCallback(async () => {
    if (!contextMenuState) {
      return;
    }
    const content = contextMenuState.messageText.trim();
    if (!content) {
      showToast(
        t('content.sidebar.history.contextMenuNoText', { defaultValue: 'Message has no text to reuse.' }),
        'error'
      );
      closeContextMenu();
      return;
    }

    setContextMenuPending('prompt');
    try {
      const fallbackTitle = t('popup.untitledConversation') ?? 'Untitled conversation';
      const titleLabel = normalizeTitle(contextMenuState.conversationTitle, fallbackTitle);
      const snippet = createSnippet(content, 64);
      const fallbackName = t('content.sidebar.history.contextMenuPromptFallback', {
        title: titleLabel,
        defaultValue: 'Prompt from {{title}}'
      });
      const name = snippet.length >= 3 ? snippet : fallbackName;
      await createPrompt({ name, content });
      showToast(
        t('content.sidebar.history.contextMenuPromptSaved', {
          name,
          defaultValue: 'Prompt "{{name}}" saved to your library.'
        }),
        'success'
      );
    } catch (error) {
      console.error('[ai-companion] failed to save prompt from context menu', error);
      showToast(
        t('content.sidebar.history.contextMenuError', {
          defaultValue: 'We could not complete that action. Try again.'
        }),
        'error'
      );
    } finally {
      setContextMenuPending(null);
      closeContextMenu();
    }
  }, [contextMenuState, closeContextMenu, showToast, t]);

  const handleCopyMessageFromContext = useCallback(async () => {
    if (!contextMenuState) {
      return;
    }
    const content = contextMenuState.messageText.trim();
    if (!content) {
      showToast(
        t('content.sidebar.history.contextMenuNoText', { defaultValue: 'Message has no text to reuse.' }),
        'error'
      );
      closeContextMenu();
      return;
    }

    setContextMenuPending('copy');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast(
        t('content.sidebar.history.contextMenuCopied', { defaultValue: 'Message copied to clipboard.' }),
        'success'
      );
    } catch (error) {
      console.error('[ai-companion] failed to copy message from context menu', error);
      showToast(
        t('content.sidebar.history.contextMenuError', {
          defaultValue: 'We could not complete that action. Try again.'
        }),
        'error'
      );
    } finally {
      setContextMenuPending(null);
      closeContextMenu();
    }
  }, [contextMenuState, closeContextMenu, showToast, t]);

  const handleTogglePinFromContext = useCallback(async () => {
    if (!contextMenuState) {
      return;
    }

    setContextMenuPending('pin');
    try {
      const result = await togglePinned(contextMenuState.conversationId);
      const pinned = Boolean(result?.pinned);
      setContextMenuState((current) => (current ? { ...current, pinned } : current));
      showToast(
        pinned
          ? t('content.sidebar.history.contextMenuPinSuccess', { defaultValue: 'Conversation pinned.' })
          : t('content.sidebar.history.contextMenuUnpinSuccess', { defaultValue: 'Conversation unpinned.' }),
        'success'
      );
    } catch (error) {
      console.error('[ai-companion] failed to toggle pin from context menu', error);
      showToast(
        t('content.sidebar.history.contextMenuError', {
          defaultValue: 'We could not complete that action. Try again.'
        }),
        'error'
      );
    } finally {
      setContextMenuPending(null);
      closeContextMenu();
    }
  }, [contextMenuState, closeContextMenu, showToast, t]);

  const handleOpenDashboardFromContext = useCallback(() => {
    openDashboard({ searchParams: { view: 'history' } });
    closeContextMenu();
  }, [closeContextMenu]);

  const modalPoints = useMemo(() => {
    const points = t('content.sidebar.modal.points', { returnObjects: true });
    return Array.isArray(points) ? (points as string[]) : [];
  }, [t]);

  if (!hydrated) {
    return null;
  }

  const HistoryPanel = () => (
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200 shadow-sm">
      <HistoryTab onAddBookmark={handleOpenBookmarkDialog} />
    </div>
  );

  const PromptsPanel = () => (
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200 shadow-sm">
      <PromptsTab />
    </div>
  );

  const MediaPanel = () => (
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200 shadow-sm">
      <MediaTab />
    </div>
  );

  return (
    <>
      <div className="pointer-events-auto flex items-start gap-3">
        <BubbleDock onShowPatterns={() => setPatternModalOpen(true)} />
        {activeBubble === 'history' && <HistoryPanel />}
        {activeBubble === 'prompts' && <PromptsPanel />}
        {activeBubble === 'media' && <MediaPanel />}
      </div>
      <BookmarkDialog
        open={bookmarkDialogOpen}
        onClose={handleCloseBookmarkDialog}
        initialTarget={bookmarkDialogTarget ?? undefined}
        t={t}
      />
      <ContextMenuOverlay
        state={contextMenuState}
        pendingAction={contextMenuPending}
        onClose={closeContextMenu}
        onBookmark={handleBookmarkFromContext}
        onSavePrompt={handleSavePromptFromContext}
        onCopy={handleCopyMessageFromContext}
        onTogglePin={handleTogglePinFromContext}
        onOpenDashboard={handleOpenDashboardFromContext}
        t={t}
      />
      <ActionToastView toast={toast} />
      <Modal labelledBy={modalHeadingId} onClose={() => setPatternModalOpen(false)} open={isPatternModalOpen}>
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
            onClick={() => setPatternModalOpen(false)}
            type="button"
          >
            {t('content.sidebar.modal.close')}
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}

async function init() {
  await initializeSettingsStore();
  const host = await ensureShadowHost();
  const container = mountReact(host);
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <CompanionSidebarRoot host={host} />
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
>>>>>>> REPLACE