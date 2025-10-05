import { create } from 'zustand';

export type Bubble = 'history' | 'prompts' | 'media' | 'actions' | 'guides';

export interface FolderShortcut {
  id: string;
  name: string;
  depth: number;
  favorite: boolean;
}

interface BubbleLauncherSnapshot {
  conversationFolderShortcuts: FolderShortcut[];
}

export interface BubbleLauncherState extends BubbleLauncherSnapshot {
  activeBubble: Bubble | null;
  hydrated: boolean;
  setActiveBubble: (bubble: Bubble | null) => void;
  setConversationFolderShortcuts: (shortcuts: FolderShortcut[]) => void;
  toggleBubble: (bubble: Bubble) => void;
}

const BUBBLE_LAUNCHER_STORAGE_KEY = 'ai-companion:bubble-launcher:v1';

const DEFAULT_SNAPSHOT: BubbleLauncherSnapshot = {
  conversationFolderShortcuts: []
};

function coerceFolderShortcut(input: unknown): FolderShortcut | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Partial<FolderShortcut>;
  const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : null;
  const name = typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : null;
  const depth = Number.isFinite(record.depth) && Number(record.depth) >= 0 ? Math.floor(Number(record.depth)) : null;
  const favorite = typeof record.favorite === 'boolean' ? record.favorite : false;

  if (!id || !name || depth === null) {
    return null;
  }

  return { id, name, depth, favorite } satisfies FolderShortcut;
}

function coerceSnapshot(input: unknown): BubbleLauncherSnapshot {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SNAPSHOT };
  }

  const record = input as Partial<BubbleLauncherSnapshot>;
  const shortcuts = Array.isArray(record.conversationFolderShortcuts)
    ? record.conversationFolderShortcuts
        .map((shortcut) => coerceFolderShortcut(shortcut))
        .filter((shortcut): shortcut is FolderShortcut => Boolean(shortcut))
    : [];

  return { conversationFolderShortcuts: shortcuts } satisfies BubbleLauncherSnapshot;
}

function cloneShortcuts(shortcuts: FolderShortcut[]): FolderShortcut[] {
  return shortcuts.map((shortcut) => ({ ...shortcut }));
}

function areShortcutListsEqual(a: FolderShortcut[], b: FolderShortcut[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id ||
      left.name !== right.name ||
      left.depth !== right.depth ||
      left.favorite !== right.favorite
    ) {
      return false;
    }
  }

  return true;
}

function getLocalStorageArea(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return undefined;
  }
  return chrome.storage.local;
}

async function readStoredSnapshot(): Promise<BubbleLauncherSnapshot> {
  const area = getLocalStorageArea();
  if (!area) {
    const fallback = fallbackStore.get(BUBBLE_LAUNCHER_STORAGE_KEY);
    return fallback ? coerceSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
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
          ) => unknown)(BUBBLE_LAUNCHER_STORAGE_KEY, (items) => {
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

      return coerceSnapshot(items?.[BUBBLE_LAUNCHER_STORAGE_KEY]);
    }
  } catch (error) {
    console.warn('[bubbleLauncherStore] failed to read snapshot from storage', error);
  }

  const fallback = fallbackStore.get(BUBBLE_LAUNCHER_STORAGE_KEY);
  return fallback ? coerceSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
}

async function writeStoredSnapshot(snapshot: BubbleLauncherSnapshot): Promise<void> {
  fallbackStore.set(BUBBLE_LAUNCHER_STORAGE_KEY, snapshot);

  const area = getLocalStorageArea();
  if (!area) {
    return;
  }

  try {
    const payload = { [BUBBLE_LAUNCHER_STORAGE_KEY]: snapshot } as Record<string, BubbleLauncherSnapshot>;
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
            items: Record<string, BubbleLauncherSnapshot>,
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
    console.warn('[bubbleLauncherStore] failed to persist snapshot', error);
  }
}

function toSnapshot(state: BubbleLauncherState): BubbleLauncherSnapshot {
  return {
    conversationFolderShortcuts: cloneShortcuts(state.conversationFolderShortcuts)
  } satisfies BubbleLauncherSnapshot;
}

function areSnapshotsEqual(a: BubbleLauncherSnapshot, b: BubbleLauncherSnapshot): boolean {
  return areShortcutListsEqual(a.conversationFolderShortcuts, b.conversationFolderShortcuts);
}

const fallbackStore = new Map<string, BubbleLauncherSnapshot>();
let initializePromise: Promise<void> | null = null;
let unsubscribePersist: (() => void) | null = null;
let storageListenerRegistered = false;
let storageChangeListener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null = null;
let hydrating = false;
let lastSnapshot: BubbleLauncherSnapshot = { ...DEFAULT_SNAPSHOT };

export const useBubbleLauncherStore = create<BubbleLauncherState>((set, get) => ({
  activeBubble: null,
  hydrated: false,
  conversationFolderShortcuts: [],
  setActiveBubble: (bubble) => set({ activeBubble: bubble }),
  setConversationFolderShortcuts: (shortcuts) => {
    const current = get().conversationFolderShortcuts;
    if (areShortcutListsEqual(current, shortcuts)) {
      return;
    }
    set({ conversationFolderShortcuts: cloneShortcuts(shortcuts) });
  },
  toggleBubble: (bubble) =>
    set((state) => ({
      activeBubble: state.activeBubble === bubble ? null : bubble,
    })),
}));

function registerStorageListener() {
  if (storageListenerRegistered) {
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return;
  }

  storageChangeListener = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    const change = changes[BUBBLE_LAUNCHER_STORAGE_KEY];
    if (!change) {
      return;
    }

    const snapshot = coerceSnapshot(change.newValue);
    fallbackStore.set(BUBBLE_LAUNCHER_STORAGE_KEY, snapshot);

    hydrating = true;
    useBubbleLauncherStore.setState((state) => ({
      ...state,
      conversationFolderShortcuts: cloneShortcuts(snapshot.conversationFolderShortcuts),
      hydrated: true
    }));
    lastSnapshot = snapshot;
    hydrating = false;
  };

  chrome.storage.onChanged.addListener(storageChangeListener);

  storageListenerRegistered = true;
}

export async function initializeBubbleLauncherStore(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    let snapshot = { ...DEFAULT_SNAPSHOT };
    try {
      snapshot = await readStoredSnapshot();
    } catch (error) {
      console.warn('[bubbleLauncherStore] falling back to default snapshot', error);
    }

    hydrating = true;
    useBubbleLauncherStore.setState((state) => ({
      ...state,
      conversationFolderShortcuts: cloneShortcuts(snapshot.conversationFolderShortcuts),
      hydrated: true
    }));
    lastSnapshot = snapshot;
    hydrating = false;

    if (!unsubscribePersist) {
      unsubscribePersist = useBubbleLauncherStore.subscribe((state) => {
        if (hydrating) {
          return;
        }
        const nextSnapshot = toSnapshot(state);
        if (areSnapshotsEqual(nextSnapshot, lastSnapshot)) {
          return;
        }
        lastSnapshot = nextSnapshot;
        void writeStoredSnapshot(nextSnapshot);
      });
    }

    registerStorageListener();
  })();

  return initializePromise;
}

export function __resetBubbleLauncherStoreForTests() {
  fallbackStore.clear();
  lastSnapshot = { ...DEFAULT_SNAPSHOT };
  hydrating = false;
  initializePromise = null;
  if (unsubscribePersist) {
    unsubscribePersist();
    unsubscribePersist = null;
  }
  storageListenerRegistered = false;
  if (storageChangeListener && typeof chrome !== 'undefined' && chrome.storage?.onChanged?.removeListener) {
    chrome.storage.onChanged.removeListener(storageChangeListener);
  }
  storageChangeListener = null;
  useBubbleLauncherStore.setState({
    activeBubble: null,
    hydrated: false,
    conversationFolderShortcuts: []
  });
}
