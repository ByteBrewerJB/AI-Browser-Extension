import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/shared/i18n/useTranslation';
import type { ConversationOverview, FolderTreeNode } from '@/core/storage';
import {
  archiveConversations,
  toggleFavoriteFolder,
  togglePinned,
  upsertConversation,
} from '@/core/storage';
import { usePinnedConversations } from '@/shared/hooks/usePinnedConversations';
import { useFolderTree } from '@/shared/hooks/useFolderTree';
import {
  useBubbleLauncherStore,
  type FolderShortcut,
} from '@/shared/state/bubbleLauncherStore';
import { EmptyState } from '@/shared/components';
import { MoveDialog, type MoveDialogOption } from '@/ui/components/MoveDialog';

// #region Helper functions from ui-root.tsx
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

function flattenFolderTree(nodes: FolderTreeNode[], depth = 0): FolderShortcut[] {
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

// #endregion

export function PinnedPanel(): ReactElement {
  const { t } = useTranslation();
  const pinnedConversations = usePinnedConversations(10);
  const conversationFolders = useFolderTree('conversation');
  const cachedFolderShortcuts = useBubbleLauncherStore((state) => state.conversationFolderShortcuts);
  const setConversationFolderShortcuts = useBubbleLauncherStore(
    (state) => state.setConversationFolderShortcuts
  );

  const handleTogglePin = useCallback((conversationId: string) => {
    void togglePinned(conversationId);
  }, []);

  const handleArchiveToggle = useCallback((conversationId: string, archived: boolean | undefined) => {
    void archiveConversations([conversationId], !archived);
  }, []);

  const flattenedFolderTree = useMemo(
    () => flattenFolderTree(conversationFolders),
    [conversationFolders]
  );

  useEffect(() => {
    if (flattenedFolderTree.length === 0) {
      return;
    }
    setConversationFolderShortcuts(flattenedFolderTree);
  }, [flattenedFolderTree, setConversationFolderShortcuts]);

  const folderOptions = flattenedFolderTree.length > 0 ? flattenedFolderTree : cachedFolderShortcuts;

  const [favoritePendingIds, setFavoritePendingIds] = useState<Set<string>>(() => new Set());

  const handleToggleFavorite = useCallback(
    async (folderId: string, next: boolean) => {
      setFavoritePendingIds((current) => {
        const nextSet = new Set(current);
        nextSet.add(folderId);
        return nextSet;
      });

      try {
        await toggleFavoriteFolder(folderId, next);
      } catch (error) {
        console.error('[ai-companion] failed to toggle favorite folder from dock', error);
      } finally {
        setFavoritePendingIds((current) => {
          const nextSet = new Set(current);
          nextSet.delete(folderId);
          return nextSet;
        });
      }
    },
    []
  );

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
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200 shadow-sm">
      <SidebarSection
        action={
          pinnedConversations.length > 0 || folderOptions.length > 0 ? (
            <button
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => openDashboard({ searchParams: { view: 'history' } })}
              type="button"
            >
              {t('content.sidebar.history.openDashboard', { defaultValue: 'Dashboard' })}
            </button>
          ) : undefined
        }
        title={t('content.sidebar.history.pinnedHeading', { defaultValue: 'Pinned & favorite items' })}
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
                {folderOptions.map((folder) => {
                  const favoriteToggleLabel = folder.favorite
                    ? t('content.sidebar.history.unfavoriteFolder', {
                        defaultValue: 'Remove favorite'
                      })
                    : t('content.sidebar.history.favoriteFolder', {
                        defaultValue: 'Mark as favorite'
                      });
                  const pendingFavorite = favoritePendingIds.has(folder.id);

                  return (
                    <li key={folder.id}>
                      <div className="flex items-center gap-2">
                        <button
                          className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
                        <button
                          className="rounded-md border border-amber-400/70 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleToggleFavorite(folder.id, !folder.favorite)}
                          type="button"
                          aria-label={favoriteToggleLabel}
                          aria-pressed={folder.favorite}
                          disabled={pendingFavorite}
                          title={favoriteToggleLabel ?? undefined}
                        >
                          {folder.favorite ? '★' : '☆'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SidebarSection>
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