import { useCallback, useMemo } from 'react';

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
        title: t('options.sidebarPreferences.sections.historyPinned.title', {
          defaultValue: 'Pinned conversations'
        }),
        description: t('options.sidebarPreferences.sections.historyPinned.description', {
          defaultValue: 'Keeps critical chats and folder shortcuts anchored at the top of the history bubble.'
        })
      };
    case 'history.recent':
      return {
        title: t('options.sidebarPreferences.sections.historyRecent.title', {
          defaultValue: 'Recent conversations'
        }),
        description: t('options.sidebarPreferences.sections.historyRecent.description', {
          defaultValue: 'Shows the latest conversations with quick pin, archive, and move controls.'
        })
      };
    case 'history.bookmarks':
      return {
        title: t('options.sidebarPreferences.sections.historyBookmarks.title', {
          defaultValue: 'Latest bookmarks'
        }),
        description: t('options.sidebarPreferences.sections.historyBookmarks.description', {
          defaultValue: 'Lists recently saved bookmarks so you can reopen or insert them without leaving ChatGPT.'
        })
      };
    case 'prompts.library':
      return {
        title: t('options.sidebarPreferences.sections.promptsLibrary.title', {
          defaultValue: 'Prompt templates'
        }),
        description: t('options.sidebarPreferences.sections.promptsLibrary.description', {
          defaultValue: 'Surface the most recent prompt templates with inline insert buttons.'
        })
      };
    case 'media.overview':
    default:
      return {
        title: t('options.sidebarPreferences.sections.mediaOverview.title', {
          defaultValue: 'Voice & sync overview'
        }),
        description: t('options.sidebarPreferences.sections.mediaOverview.description', {
          defaultValue: 'Provides shortcuts to audio downloads, voice playback, and sync preferences.'
        })
      };
  }
}

export function SidebarPreferences() {
  const { t } = useTranslation();
  const hydrated = useSidebarVisibilityStore((state) => state.hydrated);
  const pinnedSections = useSidebarVisibilityStore((state) => state.pinnedSections);
  const collapsedSections = useSidebarVisibilityStore((state) => state.collapsedSections);
  const hiddenSections = useSidebarVisibilityStore((state) => state.hiddenSections);
  const setSectionPinned = useSidebarVisibilityStore((state) => state.setSectionPinned);
  const setSectionCollapsed = useSidebarVisibilityStore((state) => state.setSectionCollapsed);
  const setSectionHidden = useSidebarVisibilityStore((state) => state.setSectionHidden);

  const rows = useMemo(
    () =>
      SECTION_DEFINITIONS.map((definition) => ({
        id: definition.id,
        pinned: pinnedSections.includes(definition.id),
        collapsed: collapsedSections.includes(definition.id),
        hidden: hiddenSections.includes(definition.id)
      })),
    [collapsedSections, hiddenSections, pinnedSections]
  );

  const handlePinnedChange = useCallback(
    (sectionId: SidebarSectionId, nextPinned: boolean) => {
      setSectionPinned(sectionId, nextPinned);
      if (nextPinned) {
        setSectionHidden(sectionId, false);
      }
    },
    [setSectionHidden, setSectionPinned]
  );

  const handleCollapsedChange = useCallback(
    (sectionId: SidebarSectionId, nextCollapsed: boolean) => {
      setSectionCollapsed(sectionId, nextCollapsed);
      if (!nextCollapsed) {
        setSectionHidden(sectionId, false);
      }
    },
    [setSectionCollapsed, setSectionHidden]
  );

  const handleHiddenChange = useCallback(
    (sectionId: SidebarSectionId, nextHidden: boolean) => {
      setSectionHidden(sectionId, nextHidden);
      if (nextHidden) {
        setSectionPinned(sectionId, false);
        setSectionCollapsed(sectionId, true);
      }
    },
    [setSectionCollapsed, setSectionHidden, setSectionPinned]
  );

  const heading = t('options.sidebarPreferences.heading', { defaultValue: 'Sidebar layout' });
  const description = t('options.sidebarPreferences.description', {
    defaultValue: 'Configure which sections remain visible in the ChatGPT sidebar and how they behave.'
  });
  const loadingLabel = t('options.sidebarPreferences.loading', { defaultValue: 'Loading preferences…' });
  const pinLabel = t('options.sidebarPreferences.pin', { defaultValue: 'Pinned' });
  const collapsedLabel = t('options.sidebarPreferences.collapsed', { defaultValue: 'Collapsed' });
  const hiddenLabel = t('options.sidebarPreferences.hidden', { defaultValue: 'Hidden' });

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">{heading}</h2>
        <p className="text-sm text-slate-300">{description}</p>
      </header>

      {!hydrated ? (
        <p className="mt-4 text-sm text-slate-400">{loadingLabel}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full table-auto border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-semibold">{t('options.sidebarPreferences.sectionColumn', { defaultValue: 'Section' })}</th>
                <th className="px-4 py-2 font-semibold">{pinLabel}</th>
                <th className="px-4 py-2 font-semibold">{collapsedLabel}</th>
                <th className="px-4 py-2 font-semibold">{hiddenLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const labels = getSectionLabels(t, row.id);
                return (
                  <tr key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/70 align-top text-sm text-slate-200 shadow-sm">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100">{labels.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{labels.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-400 focus:ring-emerald-400"
                          checked={row.pinned}
                          onChange={(event) => handlePinnedChange(row.id, event.target.checked)}
                          disabled={row.hidden}
                        />
                        <span>{pinLabel}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-400 focus:ring-emerald-400"
                          checked={row.collapsed}
                          onChange={(event) => handleCollapsedChange(row.id, event.target.checked)}
                          disabled={row.hidden}
                        />
                        <span>{collapsedLabel}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-rose-400 focus:ring-rose-400"
                          checked={row.hidden}
                          onChange={(event) => handleHiddenChange(row.id, event.target.checked)}
                        />
                        <span>{hiddenLabel}</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
