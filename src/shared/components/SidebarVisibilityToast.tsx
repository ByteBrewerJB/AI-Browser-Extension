import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/shared/i18n/useTranslation';
import { useSidebarVisibilityStore } from '@/shared/state/sidebarVisibilityStore';
import type {
  SidebarVisibilityActionKind,
  SidebarVisibilityAnnouncementDirection
} from '@/shared/state/sidebarVisibilityStore';
import type { SidebarSectionId } from '@/shared/types/sidebar';

interface SidebarVisibilityToastProps {
  className?: string;
}

const SECTION_FALLBACK_TITLES: Record<SidebarSectionId, string> = {
  'history.pinned': 'Pinned conversations',
  'history.recent': 'Recent conversations',
  'history.bookmarks': 'Latest bookmarks',
  'prompts.library': 'Prompt templates',
  'media.overview': 'Voice & sync overview'
};

const MESSAGE_FALLBACKS: Record<
  SidebarVisibilityActionKind,
  Record<
    SidebarVisibilityAnnouncementDirection,
    { singular: string; plural: string }
  >
> = {
  pin: {
    apply: {
      singular: 'Pinned {{section}}',
      plural: 'Pinned {{count}} sections'
    },
    undo: {
      singular: 'Unpinned {{section}}',
      plural: 'Unpinned {{count}} sections'
    },
    redo: {
      singular: 'Pinned {{section}} again',
      plural: 'Pinned {{count}} sections again'
    }
  },
  unpin: {
    apply: {
      singular: 'Unpinned {{section}}',
      plural: 'Unpinned {{count}} sections'
    },
    undo: {
      singular: 'Re-pinned {{section}}',
      plural: 'Re-pinned {{count}} sections'
    },
    redo: {
      singular: 'Unpinned {{section}} again',
      plural: 'Unpinned {{count}} sections again'
    }
  },
  hide: {
    apply: {
      singular: 'Hidden {{section}}',
      plural: 'Hidden {{count}} sections'
    },
    undo: {
      singular: 'Restored {{section}}',
      plural: 'Restored {{count}} sections'
    },
    redo: {
      singular: 'Hidden {{section}} again',
      plural: 'Hidden {{count}} sections again'
    }
  },
  show: {
    apply: {
      singular: 'Restored {{section}}',
      plural: 'Restored {{count}} sections'
    },
    undo: {
      singular: 'Hidden {{section}}',
      plural: 'Hidden {{count}} sections'
    },
    redo: {
      singular: 'Restored {{section}} again',
      plural: 'Restored {{count}} sections again'
    }
  }
};

function getSectionTitle(
  t: ReturnType<typeof useTranslation>['t'],
  sectionId: SidebarSectionId
) {
  return t(`sidebarVisibility.sections.${sectionId}`, {
    defaultValue: SECTION_FALLBACK_TITLES[sectionId]
  });
}

function getMessage(
  t: ReturnType<typeof useTranslation>['t'],
  kind: SidebarVisibilityActionKind,
  direction: SidebarVisibilityAnnouncementDirection,
  sections: SidebarSectionId[]
) {
  const count = sections.length;
  const keyBase = `sidebarVisibility.toast.${kind}.${direction}`;
  const fallback = MESSAGE_FALLBACKS[kind][direction];
  if (count === 1) {
    const sectionTitle = getSectionTitle(t, sections[0]!);
    return t(keyBase, {
      section: sectionTitle,
      count,
      defaultValue: fallback.singular
    });
  }

  return t(`${keyBase}_plural`, {
    count,
    defaultValue: fallback.plural
  });
}

export function SidebarVisibilityToast({ className }: SidebarVisibilityToastProps) {
  const { t } = useTranslation();
  const announcement = useSidebarVisibilityStore((state) => state.announcement);
  const undo = useSidebarVisibilityStore((state) => state.undo);
  const redo = useSidebarVisibilityStore((state) => state.redo);
  const acknowledge = useSidebarVisibilityStore((state) => state.acknowledgeAnnouncement);

  const toastClassName = className ?? 'fixed bottom-4 right-4 z-[2147483646]';

  const message = useMemo(() => {
    if (!announcement) {
      return '';
    }
    return getMessage(
      t,
      announcement.entry.metadata.kind,
      announcement.direction,
      announcement.entry.metadata.sections
    );
  }, [announcement, t]);

  const actionLabel = useMemo(() => {
    if (!announcement) {
      return '';
    }
    const key =
      announcement.direction === 'undo'
        ? 'sidebarVisibility.buttons.redo'
        : 'sidebarVisibility.buttons.undo';
    const fallback = announcement.direction === 'undo' ? 'Redo' : 'Undo';
    return t(key, { defaultValue: fallback });
  }, [announcement, t]);

  const dismissLabel = t('sidebarVisibility.buttons.dismiss', { defaultValue: 'Dismiss' });

  const handleAction = useCallback(() => {
    if (!announcement) {
      return;
    }
    if (announcement.direction === 'undo') {
      redo();
    } else {
      undo();
    }
  }, [announcement, redo, undo]);

  const handleDismiss = useCallback(() => {
    if (announcement) {
      acknowledge(announcement.id);
    }
  }, [acknowledge, announcement]);

  if (!announcement) {
    return null;
  }

  return (
    <div className={toastClassName} role="status" aria-live="polite">
      <div className="pointer-events-auto max-w-sm rounded-lg border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl">
        <p className="text-sm font-medium text-slate-100">{message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            onClick={handleAction}
          >
            {actionLabel}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200"
            onClick={handleDismiss}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
