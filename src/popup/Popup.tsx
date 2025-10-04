import { useEffect, useState } from 'react';
import { useTranslation } from '@/shared/i18n/useTranslation';

import type { ActivityItem, BookmarkSummary } from '@/core/storage';
import { toggleBookmark, togglePinned } from '@/core/storage';
import { usePinnedConversations } from '@/shared/hooks/usePinnedConversations';
import { useRecentActivity } from '@/shared/hooks/useRecentActivity';
import { useRecentBookmarks } from '@/shared/hooks/useRecentBookmarks';
import { useRecentConversations } from '@/shared/hooks/useRecentConversations';
import { initI18n, setLanguage } from '@/shared/i18n';
import { useSettingsStore } from '@/shared/state/settingsStore';
import { sendRuntimeMessage } from '@/shared/messaging/router';

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function openConversationTab(conversationId: string) {
  const url = conversationId ? `https://chat.openai.com/c/${conversationId}` : 'https://chat.openai.com/';
  chrome.tabs.create({ url }).catch((error) => {
    console.error('[ai-companion] failed to open conversation tab', error);
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function normalizeTitle(title: string | undefined | null, fallback: string) {
  if (typeof title !== 'string') {
    return fallback;
  }
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatBookmarkPreview(bookmark: BookmarkSummary, fallback: string) {
  if (bookmark.messagePreview) {
    return bookmark.messagePreview;
  }
  return fallback;
}

function openDashboard() {
  const dashboardUrl =
    chrome.runtime?.getURL?.('src/options/index.html') ??
    chrome.runtime?.getURL?.('options.html');

  if (chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage(() => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('[ai-companion] failed to open options page', lastError);
        if (dashboardUrl) {
          chrome.tabs
            .create({ url: dashboardUrl })
            .catch((error) => console.error('[ai-companion] failed to open dashboard tab', error));
        } else {
          console.error('[ai-companion] unable to resolve dashboard URL for fallback navigation');
        }
      }
    });
    return;
  }

  if (dashboardUrl) {
    chrome.tabs
      .create({ url: dashboardUrl })
      .catch((error) => console.error('[ai-companion] failed to open dashboard tab', error));
    return;
  }

  console.error('[ai-companion] dashboard URL could not be resolved');
}

function getActivityAccent(item: ActivityItem) {
  if (item.kind === 'job') {
    switch (item.job.status) {
      case 'failed':
        return 'bg-rose-400';
      case 'running':
        return 'bg-sky-400';
      case 'completed':
        return 'bg-emerald-400';
      case 'pending':
      default:
        return 'bg-amber-400';
    }
  }
  if (item.kind === 'bookmark') {
    return 'bg-amber-400';
  }
  return 'bg-emerald-400';
}

export function Popup() {
  const { t, i18n } = useTranslation();
  const {
    language,
    direction,
    setLanguage: setStoreLanguage,
    toggleDirection,
    hydrated
  } = useSettingsStore((state) => ({
    language: state.language,
    direction: state.direction,
    setLanguage: state.setLanguage,
    toggleDirection: state.toggleDirection,
    hydrated: state.hydrated
  }));
  const conversations = useRecentConversations(5);
  const pinnedConversations = usePinnedConversations(4);
  const recentBookmarks = useRecentBookmarks(4);
  const recentActivity = useRecentActivity(6);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; premium: boolean } | null>(null);

  const handlePinClick = async (conversationId: string) => {
    await togglePinned(conversationId);
  };

  const handleBookmarkClick = async (conversationId: string) => {
    await toggleBookmark(conversationId);
  };

  useEffect(() => {
    sendRuntimeMessage('auth/status', { includeToken: false })
      .then((status) => setAuthStatus({ authenticated: status.authenticated, premium: status.premium }))
      .catch((error) => console.error('[ai-companion] failed to fetch auth status', error));
  }, []);

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    if (i18n.language !== language) {
      setLanguage(language);
    }
    document.documentElement.dir = direction;
  }, [language, direction, i18n]);

  const untitledConversationLabel = t('popup.untitledConversation') || 'Untitled conversation';
  const bookmarkFallbackPreview = t('popup.bookmarkConversationOnly') || 'Conversation bookmark';
  const pinnedBadgeLabel = t('popup.pinnedBadge') || 'Pinned';
  const jobStatusLabels = {
    pending: t('popup.activityJobStatus.pending'),
    running: t('popup.activityJobStatus.running'),
    completed: t('popup.activityJobStatus.completed'),
    failed: t('popup.activityJobStatus.failed')
  } as const;
  const jobTypeLabels: Record<string, string> = {
    export: t('popup.activityJobType.export') || 'Export'
  };
  const resolveJobTypeLabel = (type: string) => {
    if (jobTypeLabels[type]) {
      return jobTypeLabels[type];
    }
    if (!type) {
      return 'Job';
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  const resolveJobStatusLabel = (status: keyof typeof jobStatusLabels) =>
    jobStatusLabels[status] ?? status;
  const noBookmarksLabel = t('popup.noBookmarks') || 'Save bookmarks to see them here.';
  const noPinnedLabel =
    t('popup.noPinned') || 'Pin important conversations to keep them handy.';
  const noActivityLabel =
    t('popup.noActivity') ||
    'Recent conversation edits, bookmarks, and exports will show up here.';

  if (!hydrated) {
    return (
      <div className="w-96 p-4 text-sm text-slate-300" dir={direction}>
        {t('popup.loadingSettings') ?? 'Loading settings...'}
      </div>
    );
  }

  return (
    <div className="w-96 space-y-4 p-4" dir={direction}>
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{t('app.title')}</h1>
        <p className="text-sm text-slate-300">{t('app.tagline')}</p>
        {authStatus && (
          <p className="text-xs text-slate-400">
            {authStatus.premium
              ? 'Premium features unlocked'
              : authStatus.authenticated
                ? 'Signed in (free tier)'
                : 'Offline mode'}
          </p>
        )}
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">Language</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            value={language}
            onChange={(event) => {
              const newLanguage = event.target.value;
              setStoreLanguage(newLanguage);
              setLanguage(newLanguage);
            }}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">Text direction</span>
          <button
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            onClick={() => toggleDirection()}
          >
            {direction.toUpperCase()}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('popup.recentConversations')}
          </h2>
          <button
            className="text-xs font-medium text-emerald-400"
            onClick={() => openConversationTab('')}
            title="Start new conversation"
          >
            +
          </button>
        </header>
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-300">{t('popup.noConversations')}</p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((conversation) => {
              const hasBookmark = conversation.bookmarkCount > 0;
              return (
                <li
                  key={conversation.id}
                  className="rounded-md border border-slate-800 bg-slate-900/80 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {conversation.title || 'Untitled conversation'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(conversation.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200"
                        onClick={() => handlePinClick(conversation.id)}
                      >
                        {conversation.pinned ? t('popup.unpin') : t('popup.pin')}
                      </button>
                      <button
                        className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200"
                        onClick={() => handleBookmarkClick(conversation.id)}
                      >
                        {hasBookmark ? t('popup.unbookmark') : t('popup.bookmark')}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
                    <span>
                      {t('popup.messages')}: {formatNumber(conversation.messageCount)}
                    </span>
                    <span>
                      {t('popup.words')}: {formatNumber(conversation.wordCount)}
                    </span>
                    <span>
                      {t('popup.characters')}: {formatNumber(conversation.charCount)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm"
                      onClick={() => openConversationTab(conversation.id)}
                    >
                      {t('popup.openConversation')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.bookmarks')}</h2>
        {recentBookmarks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">{noBookmarksLabel}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentBookmarks.map((bookmark) => (
              <li
                key={bookmark.id}
                className="rounded-md border border-slate-800 bg-slate-900/80 p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">
                        {normalizeTitle(bookmark.conversationTitle, untitledConversationLabel)}
                      </p>
                      {bookmark.conversationPinned ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                          {pinnedBadgeLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400">
                      {t('popup.bookmarkSaved', {
                        time: formatDateTime(bookmark.createdAt)
                      })}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-200"
                    onClick={() => openConversationTab(bookmark.conversationId)}
                  >
                    {t('popup.openConversation')}
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  <p>{formatBookmarkPreview(bookmark, bookmarkFallbackPreview)}</p>
                  {bookmark.note ? (
                    <p className="text-[11px] text-slate-400">
                      {t('popup.bookmarkNote', {
                        note: bookmark.note
                      })}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.pinnedChats')}</h2>
        {pinnedConversations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">{noPinnedLabel}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pinnedConversations.map((conversation) => (
              <li
                key={conversation.id}
                className="rounded-md border border-slate-800 bg-slate-900/80 p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {normalizeTitle(conversation.title, untitledConversationLabel)}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(conversation.updatedAt)}</p>
                  </div>
                  <button
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-200"
                    onClick={() => openConversationTab(conversation.id)}
                  >
                    {t('popup.openConversation')}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                  <span>
                    {t('popup.messages')}: {formatNumber(conversation.messageCount)}
                  </span>
                  <span>
                    {t('popup.words')}: {formatNumber(conversation.wordCount)}
                  </span>
                  <span>
                    {t('popup.characters')}: {formatNumber(conversation.charCount)}
                  </span>
                  <span>
                    {(t('popup.bookmarkTotal') || 'Bookmarks')}: {formatNumber(conversation.bookmarkCount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.recentActivity')}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {t('popup.recentActivityDescription') ||
                'Latest conversations, bookmarks, and exports at a glance.'}
            </p>
          </div>
          <button
            className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm"
            onClick={() => openDashboard()}
          >
            {t('popup.openDashboard')}
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">{noActivityLabel}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentActivity.map((item) => {
              let title: string = '';
              let subtitle: string | null = null;
              let attemptsLabel: string | null = null;
              let action: { label: string; handler: () => void } | null = null;

              if (item.kind === 'conversation') {
                const conversationTitle = normalizeTitle(
                  item.conversation.title,
                  untitledConversationLabel
                );
                title =
                  t('popup.activityConversation', {
                    title: conversationTitle
                  }) ?? `${conversationTitle} updated`;
                const metrics = [
                  t('popup.activityConversationMetrics', {
                    messages: formatNumber(item.conversation.messageCount),
                    words: formatNumber(item.conversation.wordCount)
                  })
                ];
                if (item.conversation.bookmarkCount > 0) {
                  metrics.push(
                    t('popup.activityConversationBookmarks', {
                      formattedCount: formatNumber(item.conversation.bookmarkCount)
                    })
                  );
                }
                subtitle = metrics.filter(Boolean).join(' • ');
                action = {
                  label: t('popup.openConversation'),
                  handler: () => openConversationTab(item.conversation.id)
                };
              } else if (item.kind === 'bookmark') {
                const conversationTitle = normalizeTitle(
                  item.bookmark.conversationTitle,
                  untitledConversationLabel
                );
                title =
                  t('popup.activityBookmark', {
                    title: conversationTitle
                  }) ?? `Bookmark saved in ${conversationTitle}`;
                const subtitleParts = [
                  formatBookmarkPreview(item.bookmark, bookmarkFallbackPreview)
                ];
                if (item.bookmark.note) {
                  subtitleParts.push(
                    t('popup.bookmarkNote', {
                      note: item.bookmark.note
                    })
                  );
                }
                subtitle = subtitleParts.filter(Boolean).join(' • ');
                action = {
                  label: t('popup.openConversation'),
                  handler: () => openConversationTab(item.bookmark.conversationId)
                };
              } else {
                const typeLabel = resolveJobTypeLabel(item.job.type);
                const statusLabel = resolveJobStatusLabel(item.job.status);
                title =
                  t('popup.activityJob', {
                    type: typeLabel,
                    status: statusLabel
                  }) ?? `${typeLabel} job ${statusLabel}`;

                if (item.job.status === 'failed') {
                  subtitle = item.job.lastError
                    ? t('popup.activityJobFailedWithError', {
                        error: item.job.lastError
                      })
                    : t('popup.activityJobFailed', {
                        attempts: item.job.attempts
                      });
                } else if (item.job.status === 'completed') {
                  subtitle = t('popup.activityJobCompleted', {
                    time: formatDateTime(item.job.completedAt ?? item.job.updatedAt)
                  });
                } else if (item.job.status === 'running') {
                  subtitle = t('popup.activityJobRunning', {
                    time: formatDateTime(item.job.lastRunAt ?? item.job.updatedAt)
                  });
                } else {
                  subtitle = t('popup.activityJobScheduled', {
                    time: formatDateTime(item.job.runAt)
                  });
                }

                if (item.job.attempts > 0) {
                  attemptsLabel = t('popup.activityJobAttempts', {
                    attempts: item.job.attempts,
                    max: item.job.maxAttempts
                  });
                }

                action = {
                  label: t('popup.openDashboard'),
                  handler: () => openDashboard()
                };
              }

              const accentClass = getActivityAccent(item);

              return (
                <li
                  key={item.id}
                  className="rounded-md border border-slate-800 bg-slate-900/80 p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 rounded-full ${accentClass}`} aria-hidden />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-100">{title}</p>
                      {subtitle ? (
                        <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
                      ) : null}
                      {attemptsLabel ? (
                        <p className="mt-1 text-[11px] text-slate-500">{attemptsLabel}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[11px] text-slate-500">{formatDateTime(item.timestamp)}</span>
                      {action ? (
                        <button
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                          onClick={action.handler}
                        >
                          {action.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

