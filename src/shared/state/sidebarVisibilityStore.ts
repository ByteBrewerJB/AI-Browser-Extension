import { create } from 'zustand';

import {
  SIDEBAR_SECTIONS,
  type SidebarSectionId,
  isSidebarSectionId
} from '@/shared/types/sidebar';

type SidebarVisibilitySnapshot = {
  pinnedSections: SidebarSectionId[];
  hiddenSections: SidebarSectionId[];
  collapsedSections: SidebarSectionId[];
};

interface SidebarVisibilityState extends SidebarVisibilitySnapshot {
  hydrated: boolean;
  canUndo: boolean;
  canRedo: boolean;
  history: SidebarVisibilityHistoryEntry[];
  future: SidebarVisibilityHistoryEntry[];
  announcement: SidebarVisibilityAnnouncement | null;
  setSectionPinned: (sectionId: SidebarSectionId, pinned: boolean) => void;
  setSectionHidden: (sectionId: SidebarSectionId, hidden: boolean) => void;
  setSectionCollapsed: (sectionId: SidebarSectionId, collapsed: boolean) => void;
  toggleSectionCollapsed: (sectionId: SidebarSectionId) => void;
  applyBulkUpdate: (
    changes: SidebarVisibilityChange[],
    metadata: SidebarVisibilityActionMetadata
  ) => void;
  undo: () => void;
  redo: () => void;
  acknowledgeAnnouncement: (announcementId: number) => void;
  hydrate: (snapshot: SidebarVisibilitySnapshot) => void;
}

type SidebarVisibilityChange = {
  sectionId: SidebarSectionId;
  pinned?: boolean;
  hidden?: boolean;
  collapsed?: boolean;
};

export type SidebarVisibilityActionKind = 'pin' | 'unpin' | 'hide' | 'show';

interface SidebarVisibilityActionMetadata {
  kind: SidebarVisibilityActionKind;
  sections: SidebarSectionId[];
}

interface SidebarVisibilityHistoryEntry {
  before: SidebarVisibilitySnapshot;
  after: SidebarVisibilitySnapshot;
  metadata: SidebarVisibilityActionMetadata;
  id: number;
}

export type SidebarVisibilityAnnouncementDirection = 'apply' | 'undo' | 'redo';

interface SidebarVisibilityAnnouncement {
  entry: SidebarVisibilityHistoryEntry;
  direction: SidebarVisibilityAnnouncementDirection;
  id: number;
}

const STORAGE_KEY = 'ai-companion:sidebar-visibility:v1';

const DEFAULT_SNAPSHOT: SidebarVisibilitySnapshot = {
  pinnedSections: [],
  hiddenSections: [],
  collapsedSections: []
};

const HISTORY_LIMIT = 20;

const SECTION_ORDER = SIDEBAR_SECTIONS.map((section) => section.id);

function normalizeSections(values: Iterable<unknown>): SidebarSectionId[] {
  const seen = new Set<SidebarSectionId>();
  const normalized: SidebarSectionId[] = [];
  for (const value of values) {
    if (!isSidebarSectionId(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized.sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b));
}

function normalizeSnapshot(input: unknown): SidebarVisibilitySnapshot {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SNAPSHOT };
  }

  const record = input as Partial<SidebarVisibilitySnapshot> & {
    pinnedSections?: unknown;
    hiddenSections?: unknown;
    collapsedSections?: unknown;
  };

  const pinned = Array.isArray(record.pinnedSections)
    ? normalizeSections(record.pinnedSections as SidebarSectionId[])
    : [];
  const hidden = Array.isArray(record.hiddenSections)
    ? normalizeSections(record.hiddenSections as SidebarSectionId[])
    : [];
  const collapsed = Array.isArray(record.collapsedSections)
    ? normalizeSections(record.collapsedSections as SidebarSectionId[])
    : [];

  return { pinnedSections: pinned, hiddenSections: hidden, collapsedSections: collapsed };
}

function toSnapshot(state: SidebarVisibilityState): SidebarVisibilitySnapshot {
  return {
    pinnedSections: [...state.pinnedSections],
    hiddenSections: [...state.hiddenSections],
    collapsedSections: [...state.collapsedSections]
  };
}

function areSnapshotsEqual(
  a: SidebarVisibilitySnapshot,
  b: SidebarVisibilitySnapshot
): boolean {
  return (
    a.pinnedSections.length === b.pinnedSections.length &&
    a.hiddenSections.length === b.hiddenSections.length &&
    a.collapsedSections.length === b.collapsedSections.length &&
    a.pinnedSections.every((sectionId, index) => sectionId === b.pinnedSections[index]) &&
    a.hiddenSections.every((sectionId, index) => sectionId === b.hiddenSections[index]) &&
    a.collapsedSections.every((sectionId, index) => sectionId === b.collapsedSections[index])
  );
}

function getLocalStorageArea(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return undefined;
  }
  return chrome.storage.local;
}

const fallbackStore = new Map<string, SidebarVisibilitySnapshot>();

async function readStoredSnapshot(): Promise<SidebarVisibilitySnapshot> {
  const area = getLocalStorageArea();
  if (!area) {
    const fallback = fallbackStore.get(STORAGE_KEY);
    return fallback ? normalizeSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
  }

  try {
    if (typeof area.get === 'function') {
      const items = await new Promise<Record<string, unknown>>((resolve, reject) => {
        let settled = false;
        const resolveOnce = (value: Record<string, unknown>) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };
        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        try {
          const maybePromise = (area.get as (
            key: string,
            callback: (items: Record<string, unknown>) => void
          ) => unknown)(STORAGE_KEY, (items) => {
            const lastError = (chrome as unknown as { runtime?: { lastError?: unknown } })?.runtime?.lastError;
            if (lastError) {
              rejectOnce(lastError);
              return;
            }
            resolveOnce(items ?? {});
          });

          if (maybePromise && typeof (maybePromise as Promise<Record<string, unknown>>).then === 'function') {
            (maybePromise as Promise<Record<string, unknown>>).then(resolveOnce).catch(rejectOnce);
          }
        } catch (error) {
          rejectOnce(error);
        }
      });

      return normalizeSnapshot(items?.[STORAGE_KEY]);
    }
  } catch (error) {
    console.warn('[sidebarVisibilityStore] failed to read snapshot from storage', error);
  }

  const fallback = fallbackStore.get(STORAGE_KEY);
  return fallback ? normalizeSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
}

async function writeStoredSnapshot(snapshot: SidebarVisibilitySnapshot): Promise<void> {
  fallbackStore.set(STORAGE_KEY, snapshot);

  const area = getLocalStorageArea();
  if (!area) {
    return;
  }

  try {
    const payload = { [STORAGE_KEY]: snapshot } as Record<string, SidebarVisibilitySnapshot>;
    if (typeof area.set === 'function') {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const resolveOnce = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };
        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        try {
          const maybePromise = (area.set as (
            items: Record<string, SidebarVisibilitySnapshot>,
            callback: () => void
          ) => unknown)(payload, () => {
            const lastError = (chrome as unknown as { runtime?: { lastError?: unknown } })?.runtime?.lastError;
            if (lastError) {
              rejectOnce(lastError);
              return;
            }
            resolveOnce();
          });

          if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
            (maybePromise as Promise<void>).then(resolveOnce).catch(rejectOnce);
          }
        } catch (error) {
          rejectOnce(error);
        }
      });
    }
  } catch (error) {
    console.warn('[sidebarVisibilityStore] failed to persist snapshot', error);
  }
}

function updateSectionList(
  list: SidebarSectionId[],
  sectionId: SidebarSectionId,
  include: boolean
): SidebarSectionId[] {
  const set = new Set(list);
  if (include) {
    set.add(sectionId);
  } else {
    set.delete(sectionId);
  }
  return normalizeSections(set);
}

function applySnapshotForSections(
  current: SidebarVisibilitySnapshot,
  patch: SidebarVisibilitySnapshot,
  sections: SidebarSectionId[]
): SidebarVisibilitySnapshot {
  const relevantSections = normalizeSections(sections);
  if (relevantSections.length === 0) {
    return { ...current };
  }

  const sectionSet = new Set(relevantSections);
  const patchPinned = new Set(patch.pinnedSections);
  const patchHidden = new Set(patch.hiddenSections);
  const patchCollapsed = new Set(patch.collapsedSections);

  const mergeList = (
    currentList: SidebarSectionId[],
    patchSet: Set<SidebarSectionId>
  ): SidebarSectionId[] => {
    const result = new Set(currentList);
    for (const sectionId of sectionSet) {
      result.delete(sectionId);
    }
    for (const sectionId of sectionSet) {
      if (patchSet.has(sectionId)) {
        result.add(sectionId);
      }
    }
    return normalizeSections(result);
  };

  return {
    pinnedSections: mergeList(current.pinnedSections, patchPinned),
    hiddenSections: mergeList(current.hiddenSections, patchHidden),
    collapsedSections: mergeList(current.collapsedSections, patchCollapsed)
  };
}

let initializationPromise: Promise<void> | null = null;
let storageListenerRegistered = false;

export const useSidebarVisibilityStore = create<SidebarVisibilityState>((set, get) => ({
  ...DEFAULT_SNAPSHOT,
  hydrated: false,
  canUndo: false,
  canRedo: false,
  history: [],
  future: [],
  announcement: null,
  setSectionPinned: (sectionId, pinned) => {
    const change: SidebarVisibilityChange = { sectionId, pinned };
    if (pinned) {
      change.hidden = false;
    }
    get().applyBulkUpdate([change], {
      kind: pinned ? 'pin' : 'unpin',
      sections: [sectionId]
    });
  },
  setSectionHidden: (sectionId, hidden) => {
    const change: SidebarVisibilityChange = { sectionId, hidden };
    if (hidden) {
      change.pinned = false;
      change.collapsed = true;
    } else {
      change.collapsed = false;
    }
    get().applyBulkUpdate([change], {
      kind: hidden ? 'hide' : 'show',
      sections: [sectionId]
    });
  },
  setSectionCollapsed: (sectionId, collapsed) => {
    set((state) => {
      const collapsedSections = updateSectionList(state.collapsedSections, sectionId, collapsed);
      const nextState = { ...state, collapsedSections };
      if (get().hydrated) {
        void writeStoredSnapshot(toSnapshot(nextState));
      }
      return nextState;
    });
  },
  toggleSectionCollapsed: (sectionId) => {
    const collapsed = get().collapsedSections.includes(sectionId);
    get().setSectionCollapsed(sectionId, !collapsed);
  },
  applyBulkUpdate: (changes, metadata) => {
    set((state) => {
      const currentSnapshot = toSnapshot(state);

      const pinnedSet = new Set(currentSnapshot.pinnedSections);
      const hiddenSet = new Set(currentSnapshot.hiddenSections);
      const collapsedSet = new Set(currentSnapshot.collapsedSections);

      for (const change of changes) {
        if (!isSidebarSectionId(change.sectionId)) {
          continue;
        }

        if (typeof change.pinned === 'boolean') {
          if (change.pinned) {
            pinnedSet.add(change.sectionId);
          } else {
            pinnedSet.delete(change.sectionId);
          }
        }

        if (typeof change.hidden === 'boolean') {
          if (change.hidden) {
            hiddenSet.add(change.sectionId);
          } else {
            hiddenSet.delete(change.sectionId);
          }
        }

        if (typeof change.collapsed === 'boolean') {
          if (change.collapsed) {
            collapsedSet.add(change.sectionId);
          } else {
            collapsedSet.delete(change.sectionId);
          }
        }
      }

      const nextSnapshot: SidebarVisibilitySnapshot = {
        pinnedSections: normalizeSections(pinnedSet),
        hiddenSections: normalizeSections(hiddenSet),
        collapsedSections: normalizeSections(collapsedSet)
      };

      if (areSnapshotsEqual(currentSnapshot, nextSnapshot)) {
        return state;
      }

      const actionId = Date.now();
      const entry: SidebarVisibilityHistoryEntry = {
        before: currentSnapshot,
        after: nextSnapshot,
        metadata: {
          kind: metadata.kind,
          sections: normalizeSections(metadata.sections)
        },
        id: actionId
      };

      const nextHistory =
        state.history.length >= HISTORY_LIMIT
          ? [...state.history.slice(state.history.length - (HISTORY_LIMIT - 1)), entry]
          : [...state.history, entry];

      const nextState = {
        ...state,
        ...nextSnapshot,
        history: nextHistory,
        future: [],
        canUndo: nextHistory.length > 0,
        canRedo: false,
        announcement: {
          entry,
          direction: 'apply',
          id: actionId
        }
      } satisfies SidebarVisibilityState;

      if (state.hydrated) {
        void writeStoredSnapshot(nextSnapshot);
      } else {
        fallbackStore.set(STORAGE_KEY, nextSnapshot);
      }

      return nextState;
    });
  },
  undo: () => {
    set((state) => {
      if (state.history.length === 0) {
        return state;
      }

      const history = [...state.history];
      const entry = history.pop() as SidebarVisibilityHistoryEntry;
      const currentSnapshot = toSnapshot(state);
      const previousSnapshot = applySnapshotForSections(
        currentSnapshot,
        entry.before,
        entry.metadata.sections
      );
      const future = [...state.future, entry];

      const nextState = {
        ...state,
        ...previousSnapshot,
        history,
        future,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        announcement: {
          entry,
          direction: 'undo',
          id: Date.now()
        }
      } satisfies SidebarVisibilityState;

      if (state.hydrated) {
        void writeStoredSnapshot(previousSnapshot);
      } else {
        fallbackStore.set(STORAGE_KEY, previousSnapshot);
      }

      return nextState;
    });
  },
  redo: () => {
    set((state) => {
      if (state.future.length === 0) {
        return state;
      }

      const future = [...state.future];
      const entry = future.pop() as SidebarVisibilityHistoryEntry;
      const currentSnapshot = toSnapshot(state);
      const nextSnapshot = applySnapshotForSections(
        currentSnapshot,
        entry.after,
        entry.metadata.sections
      );
      const history = [...state.history, entry];

      const nextState = {
        ...state,
        ...nextSnapshot,
        history,
        future,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        announcement: {
          entry,
          direction: 'redo',
          id: Date.now()
        }
      } satisfies SidebarVisibilityState;

      if (state.hydrated) {
        void writeStoredSnapshot(nextSnapshot);
      } else {
        fallbackStore.set(STORAGE_KEY, nextSnapshot);
      }

      return nextState;
    });
  },
  acknowledgeAnnouncement: (announcementId) => {
    set((state) => {
      if (state.announcement?.id !== announcementId) {
        return state;
      }
      return { ...state, announcement: null };
    });
  },
  hydrate: (snapshot) => {
    set((state) => ({
      ...state,
      ...snapshot,
      hydrated: true,
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,
      announcement: null
    }));
  }
}));

function registerStorageListener() {
  if (storageListenerRegistered) {
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const change = changes[STORAGE_KEY];
    if (!change) {
      return;
    }

    const nextSnapshot = normalizeSnapshot(change.newValue);
    const currentSnapshot = toSnapshot(useSidebarVisibilityStore.getState());
    if (areSnapshotsEqual(nextSnapshot, currentSnapshot)) {
      return;
    }

    fallbackStore.set(STORAGE_KEY, nextSnapshot);
    useSidebarVisibilityStore.setState((state) => ({
      ...state,
      ...nextSnapshot,
      hydrated: true,
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,
      announcement: null
    }));
  });

  storageListenerRegistered = true;
}

export async function initializeSidebarVisibilityStore(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const snapshot = await readStoredSnapshot();
      fallbackStore.set(STORAGE_KEY, snapshot);
      useSidebarVisibilityStore.setState((state) => ({
        ...state,
        ...snapshot,
        hydrated: true,
        history: [],
        future: [],
        canUndo: false,
        canRedo: false,
        announcement: null
      }));
      registerStorageListener();
    })();
  }

  await initializationPromise;
}

export function __resetSidebarVisibilityStoreForTests() {
  fallbackStore.clear();
  initializationPromise = null;
  storageListenerRegistered = false;
  useSidebarVisibilityStore.setState({
    ...DEFAULT_SNAPSHOT,
    hydrated: false,
    canUndo: false,
    canRedo: false,
    history: [],
    future: [],
    announcement: null
  });
}
