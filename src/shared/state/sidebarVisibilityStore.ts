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
  setSectionPinned: (sectionId: SidebarSectionId, pinned: boolean) => void;
  setSectionHidden: (sectionId: SidebarSectionId, hidden: boolean) => void;
  setSectionCollapsed: (sectionId: SidebarSectionId, collapsed: boolean) => void;
  toggleSectionCollapsed: (sectionId: SidebarSectionId) => void;
  hydrate: (snapshot: SidebarVisibilitySnapshot) => void;
}

const STORAGE_KEY = 'ai-companion:sidebar-visibility:v1';

const DEFAULT_SNAPSHOT: SidebarVisibilitySnapshot = {
  pinnedSections: [],
  hiddenSections: [],
  collapsedSections: []
};

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

let initializationPromise: Promise<void> | null = null;
let storageListenerRegistered = false;

export const useSidebarVisibilityStore = create<SidebarVisibilityState>((set, get) => ({
  ...DEFAULT_SNAPSHOT,
  hydrated: false,
  setSectionPinned: (sectionId, pinned) => {
    set((state) => {
      const pinnedSections = updateSectionList(state.pinnedSections, sectionId, pinned);
      const nextState = { ...state, pinnedSections };
      if (get().hydrated) {
        void writeStoredSnapshot(toSnapshot(nextState));
      }
      return nextState;
    });
  },
  setSectionHidden: (sectionId, hidden) => {
    set((state) => {
      const hiddenSections = updateSectionList(state.hiddenSections, sectionId, hidden);
      const nextState = { ...state, hiddenSections };
      if (get().hydrated) {
        void writeStoredSnapshot(toSnapshot(nextState));
      }
      return nextState;
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
  hydrate: (snapshot) => {
    set({ ...snapshot, hydrated: true });
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
    useSidebarVisibilityStore.setState({ ...nextSnapshot, hydrated: true });
  });

  storageListenerRegistered = true;
}

export async function initializeSidebarVisibilityStore(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const snapshot = await readStoredSnapshot();
      fallbackStore.set(STORAGE_KEY, snapshot);
      useSidebarVisibilityStore.setState({ ...snapshot, hydrated: true });
      registerStorageListener();
    })();
  }

  await initializationPromise;
}

export function __resetSidebarVisibilityStoreForTests() {
  fallbackStore.clear();
  initializationPromise = null;
  storageListenerRegistered = false;
  useSidebarVisibilityStore.setState({ ...DEFAULT_SNAPSHOT, hydrated: false });
}
