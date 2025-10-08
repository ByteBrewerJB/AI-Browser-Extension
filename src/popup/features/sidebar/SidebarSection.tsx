import { useMemo, useCallback, useId } from 'react';

import { useTranslation } from '@/shared/i18n/useTranslation';
import {
  getSidebarSectionDefinitions,
  type SidebarSectionId
} from '@/shared/types/sidebar';
import { useSidebarVisibilityStore } from '@/shared/state/sidebarVisibilityStore';

const SECTION_DEFINITIONS = getSidebarSectionDefinitions();

function getSectionLabels(
  t: ReturnType<typeof useTranslation>['t'],
  sectionId: SidebarSectionId
) {
  switch (sectionId) {
    case 'history.pinned':
      return {
        title: t('popup.sidebarPreferences.sections.historyPinned.title', {
          defaultValue: 'Pinned conversations'
        }),
        description: t('popup.sidebarPreferences.sections.historyPinned.description', {
          defaultValue: 'Highlights pinned chats and folder shortcuts at the top of the history bubble.'
        })
      };
    case 'history.recent':
      return {
        title: t('popup.sidebarPreferences.sections.historyRecent.title', {
          defaultValue: 'Recent conversations'
        }),
        description: t('popup.sidebarPreferences.sections.historyRecent.description', {
          defaultValue: 'Latest conversations with quick access to pin, move, and archive actions.'
        })
      };
    case 'history.bookmarks':
      return {
        title: t('popup.sidebarPreferences.sections.historyBookmarks.title', {
          defaultValue: 'Latest bookmarks'
        }),
        description: t('popup.sidebarPreferences.sections.historyBookmarks.description', {
          defaultValue: 'Keeps recently saved bookmarks visible for quick insertion or review.'
        })
      };
    case 'prompts.library':
      return {
        title: t('popup.sidebarPreferences.sections.promptsLibrary.title', {
          defaultValue: 'Prompt templates'
        }),
        description: t('popup.sidebarPreferences.sections.promptsLibrary.description', {
          defaultValue: 'Shows your most recent prompt templates with insert shortcuts.'
        })
      };
    case 'media.overview':
    default:
      return {
        title: t('popup.sidebarPreferences.sections.mediaOverview.title', {
          defaultValue: 'Voice & sync overview'
        }),
        description: t('popup.sidebarPreferences.sections.mediaOverview.description', {
          defaultValue: 'Summary of voice downloads, audio tools, and sync preferences.'
        })
      };
  }
}

export function SidebarSection() {
  const { t } = useTranslation();
  const componentInstanceId = useId();
  const hydrated = useSidebarVisibilityStore((state) => state.hydrated);
  const pinnedSections = useSidebarVisibilityStore((state) => state.pinnedSections);
  const hiddenSections = useSidebarVisibilityStore((state) => state.hiddenSections);
  const collapsedSections = useSidebarVisibilityStore((state) => state.collapsedSections);
  const setSectionPinned = useSidebarVisibilityStore((state) => state.setSectionPinned);
  const setSectionHidden = useSidebarVisibilityStore((state) => state.setSectionHidden);
  const setSectionCollapsed = useSidebarVisibilityStore((state) => state.setSectionCollapsed);

  const sectionStates = useMemo(
    () =>
      SECTION_DEFINITIONS.map((definition) => {
        const pinned = pinnedSections.includes(definition.id);
        const hidden = hiddenSections.includes(definition.id);
        const collapsed = collapsedSections.includes(definition.id);
        return {
          id: definition.id,
          pinned,
          hidden,
          collapsed
        };
      }),
    [collapsedSections, hiddenSections, pinnedSections]
  );

  const handleTogglePinned = useCallback(
    (sectionId: SidebarSectionId, nextPinned: boolean) => {
      setSectionPinned(sectionId, nextPinned);
      if (!nextPinned) {
        return;
      }
      setSectionHidden(sectionId, false);
    },
    [setSectionHidden, setSectionPinned]
  );

  const handleToggleCollapsed = useCallback(
    (sectionId: SidebarSectionId, nextCollapsed: boolean) => {
      setSectionCollapsed(sectionId, nextCollapsed);
      if (!nextCollapsed) {
        setSectionHidden(sectionId, false);
      }
    },
    [setSectionCollapsed, setSectionHidden]
  );

  const handleToggleHidden = useCallback(
    (sectionId: SidebarSectionId, nextHidden: boolean) => {
      setSectionHidden(sectionId, nextHidden);
      if (nextHidden) {
        setSectionPinned(sectionId, false);
        setSectionCollapsed(sectionId, true);
      }
    },
    [setSectionCollapsed, setSectionHidden, setSectionPinned]
  );

  const heading = t('popup.sidebarPreferences.heading', { defaultValue: 'Sidebar layout' });
  const description = t('popup.sidebarPreferences.description', {
    defaultValue: 'Choose which sections stay visible or pinned in the ChatGPT sidebar.'
  });
  const loadingLabel = t('popup.sidebarPreferences.loading', { defaultValue: 'Loading preferences…' });
  const pinLabel = t('popup.sidebarPreferences.pin', { defaultValue: 'Pin' });
  const unpinLabel = t('popup.sidebarPreferences.unpin', { defaultValue: 'Unpin' });
  const collapseLabel = t('popup.sidebarPreferences.collapse', { defaultValue: 'Collapse' });
  const expandLabel = t('popup.sidebarPreferences.expand', { defaultValue: 'Expand' });
  const hideLabel = t('popup.sidebarPreferences.hide', { defaultValue: 'Hide' });
  const showLabel = t('popup.sidebarPreferences.show', { defaultValue: 'Show' });

  return (
    <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{heading}</h2>
        <p className="text-xs text-slate-400">{description}</p>
      </header>

      {!hydrated ? (
        <p className="text-xs text-slate-400">{loadingLabel}</p>
      ) : (
        <ul className="space-y-3">
          {sectionStates.map((section) => {
            const labels = getSectionLabels(t, section.id);
            const pinned = section.pinned;
            const collapsed = section.collapsed;
            const hidden = section.hidden;
            const descriptionId = `${componentInstanceId}-${section.id}-description`;
            const controlsLabel = t('popup.sidebarPreferences.sectionControlsLabel', {
              defaultValue: '{{section}} controls',
              section: labels.title
            });
            const pinAriaLabel = pinned
              ? t('popup.sidebarPreferences.unpinSection', {
                  defaultValue: 'Unpin {{section}} section',
                  section: labels.title
                })
              : t('popup.sidebarPreferences.pinSection', {
                  defaultValue: 'Pin {{section}} section',
                  section: labels.title
                });
            const collapseAriaLabel = collapsed
              ? t('popup.sidebarPreferences.expandSection', {
                  defaultValue: 'Expand {{section}} section',
                  section: labels.title
                })
              : t('popup.sidebarPreferences.collapseSection', {
                  defaultValue: 'Collapse {{section}} section',
                  section: labels.title
                });
            const hiddenAriaLabel = hidden
              ? t('popup.sidebarPreferences.showSection', {
                  defaultValue: 'Show {{section}} section',
                  section: labels.title
                })
              : t('popup.sidebarPreferences.hideSection', {
                  defaultValue: 'Hide {{section}} section',
                  section: labels.title
                });

            return (
              <li
                key={section.id}
                className="rounded-md border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{labels.title}</p>
                    <p className="text-xs text-slate-400" id={descriptionId}>
                      {labels.description}
                    </p>
                  </div>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-describedby={descriptionId}
                    aria-label={controlsLabel}
                  >
                    <button
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                        pinned
                          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                      aria-pressed={pinned}
                      aria-label={pinAriaLabel}
                      onClick={() => handleTogglePinned(section.id, !pinned)}
                      disabled={!hydrated || hidden}
                    >
                      {pinned ? unpinLabel : pinLabel}
                    </button>
                    <button
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                        collapsed
                          ? 'border-slate-600 bg-slate-800 text-slate-200'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                      aria-pressed={collapsed}
                      aria-label={collapseAriaLabel}
                      onClick={() => handleToggleCollapsed(section.id, !collapsed)}
                      disabled={!hydrated || hidden}
                    >
                      {collapsed ? expandLabel : collapseLabel}
                    </button>
                    <button
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 ${
                        hidden
                          ? 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                      aria-pressed={hidden}
                      aria-label={hiddenAriaLabel}
                      onClick={() => handleToggleHidden(section.id, !hidden)}
                      disabled={!hydrated}
                    >
                      {hidden ? showLabel : hideLabel}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
