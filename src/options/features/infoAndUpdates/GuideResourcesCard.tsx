import { useCallback, useMemo, useState } from 'react';

import type { GuideResource } from '@/core/models/guides';
import { useTranslation } from '@/shared/i18n/useTranslation';
import { sendRuntimeMessage } from '@/shared/messaging/router';
import { openGuideResource, useGuideResources } from '@/shared/hooks/useGuideResources';
import { useSettingsStore } from '@/shared/state/settingsStore';

const BADGE_CLASSES: Record<GuideResource['badgeColor'], string> = {
  amber: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
  emerald: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
  rose: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
  sky: 'bg-sky-500/20 text-sky-200 border border-sky-400/40',
  slate: 'bg-slate-500/20 text-slate-200 border border-slate-400/40',
  violet: 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
};

function formatBadgeLabel(color: GuideResource['badgeColor']) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export function GuideResourcesCard() {
  const { t } = useTranslation();
  const guidesState = useGuideResources();
  const [pendingGuideId, setPendingGuideId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dismissedGuideIds = useSettingsStore((state) => state.dismissedGuideIds);
  const setGuideDismissed = useSettingsStore((state) => state.setGuideDismissed);

  const isLoading = guidesState.status === 'loading';
  const hasGuides = guidesState.status === 'loaded' && guidesState.guides.length > 0;
  const guides = guidesState.guides;

  const topicLabel = useCallback(
    (topics: string[]) => {
      if (topics.length === 0) {
        return null;
      }
      return topics.join(', ');
    },
    []
  );

  const handleViewGuide = useCallback(
    async (guide: GuideResource) => {
      setActionError(null);
      setPendingGuideId(guide.id);
      try {
        await openGuideResource(guide.url);
        await sendRuntimeMessage('jobs/log-event', {
          event: 'guide-opened',
          guideId: guide.id,
          metadata: {
            topics: guide.topics,
            estimatedTimeMinutes: guide.estimatedTimeMinutes
          },
          surface: 'options'
        });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setPendingGuideId((current) => (current === guide.id ? null : current));
      }
    },
    []
  );

  const handleToggleDismissed = useCallback(
    (guideId: string, dismissed: boolean) => {
      setGuideDismissed(guideId, dismissed);
    },
    [setGuideDismissed]
  );

  const heading = t('options.guideResources.heading', { defaultValue: 'Guides & updates' });
  const description = t('options.guideResources.description', {
    defaultValue: 'Explore quickstart guides to learn new workflows and settings.'
  });

  const emptyStateLabel = t('options.guideResources.empty', {
    defaultValue: 'Guides will appear here once they are published.'
  });
  const errorLabel = t('options.guideResources.error', {
    defaultValue: 'We could not load guide resources. Try again later.'
  });
  const topicsLabel = t('options.guideResources.topics', {
    defaultValue: 'Topics'
  });
  const markViewedLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.markViewed', {
          defaultValue: 'Mark “{{title}}” as viewed',
          title
        }),
    [t]
  );
  const markViewedAriaLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.markViewedAria', {
          defaultValue: 'Mark guide {{title}} as viewed',
          title
        }),
    [t]
  );
  const markUnviewedLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.markUnviewed', {
          defaultValue: 'Restore “{{title}}”',
          title
        }),
    [t]
  );
  const markUnviewedAriaLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.markUnviewedAria', {
          defaultValue: 'Restore guide {{title}}',
          title
        }),
    [t]
  );
  const viewedBadge = t('options.guideResources.viewedBadge', { defaultValue: 'Viewed' });
  const estimatedTimeLabel = useMemo(
    () =>
      (minutes: number) =>
        t('options.guideResources.estimatedTime', {
          defaultValue: '{{minutes}} min read',
          minutes
        }),
    [t]
  );
  const openLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.openCta', {
          defaultValue: 'View',
          title
        }),
    [t]
  );
  const openAriaLabel = useMemo(
    () =>
      (title: string) =>
        t('options.guideResources.openAria', {
          defaultValue: 'Open guide {{title}}',
          title
        }),
    [t]
  );

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <header className="mb-4 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{heading}</h2>
        <p className="text-xs text-slate-400">{description}</p>
      </header>

      {actionError ? <p className="mb-3 text-xs text-rose-400">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-xs text-slate-400">{t('options.loading', { defaultValue: 'Loading…' })}</p>
      ) : guidesState.status === 'error' ? (
        <p className="text-xs text-rose-400">{errorLabel}</p>
      ) : hasGuides ? (
        <ul className="flex flex-col gap-4">
          {guides.map((guide) => {
            const badgeClasses = BADGE_CLASSES[guide.badgeColor];
            const topics = topicLabel(guide.topics);
            const estimatedTime = guide.estimatedTimeMinutes
              ? estimatedTimeLabel(guide.estimatedTimeMinutes)
              : null;
            const pending = pendingGuideId === guide.id;
            const dismissed = dismissedGuideIds.includes(guide.id);

            return (
              <li
                key={guide.id}
                className="rounded-md border border-slate-800/60 bg-slate-950/40 p-4 shadow-sm transition hover:border-emerald-500/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClasses}`}>
                        {formatBadgeLabel(guide.badgeColor)}
                      </span>
                      {dismissed ? (
                        <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                          {viewedBadge}
                        </span>
                      ) : null}
                      {estimatedTime ? (
                        <span className="text-[11px] text-slate-400">{estimatedTime}</span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-100">{guide.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{guide.description}</p>
                    {topics ? (
                      <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                        <span className="font-semibold text-slate-400">{topicsLabel}: </span>
                        <span className="normal-case text-slate-400">{topics}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => void handleViewGuide(guide)}
                      disabled={pending}
                      aria-label={openAriaLabel(guide.title)}
                    >
                      {pending ? t('options.guideResources.opening', { defaultValue: 'Opening…' }) : openLabel(guide.title)}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => handleToggleDismissed(guide.id, !dismissed)}
                      aria-pressed={dismissed}
                      aria-label={dismissed ? markUnviewedAriaLabel(guide.title) : markViewedAriaLabel(guide.title)}
                    >
                      {dismissed ? markUnviewedLabel(guide.title) : markViewedLabel(guide.title)}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">{emptyStateLabel}</p>
      )}
    </section>
  );
}
