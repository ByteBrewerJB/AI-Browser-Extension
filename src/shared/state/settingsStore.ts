
import { create } from 'zustand';

type TextDirection = 'ltr' | 'rtl';

interface SettingsSnapshot {
  language: string;
  direction: TextDirection;
  showSidebar: boolean;
}

interface SettingsState extends SettingsSnapshot {
  hydrated: boolean;
  setLanguage: (language: string) => void;
  toggleDirection: () => void;
  setShowSidebar: (value: boolean) => void;
}

const SETTINGS_STORAGE_KEY = 'ai-companion:settings:v1';

const DEFAULT_SNAPSHOT: SettingsSnapshot = {
  language: 'en',
  direction: 'ltr',
  showSidebar: false
};

function coerceSnapshot(input: unknown): SettingsSnapshot {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SNAPSHOT };
  }

  const record = input as Partial<SettingsSnapshot>;
  const language = typeof record.language === 'string' ? record.language : DEFAULT_SNAPSHOT.language;
  const direction: TextDirection = record.direction === 'rtl' ? 'rtl' : 'ltr';
  const showSidebar =
    typeof record.showSidebar === 'boolean' ? record.showSidebar : DEFAULT_SNAPSHOT.showSidebar;

  return { language, direction, showSidebar };
}

function getLocalStorageArea(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return undefined;
  }
  return chrome.storage.local;
}

async function readStoredSnapshot(): Promise<SettingsSnapshot> {
  const area = getLocalStorageArea();
  if (!area) {
    const fallback = fallbackStore.get(SETTINGS_STORAGE_KEY);
    return fallback ? coerceSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
  }

  try {
    if (typeof area.get === 'function') {
      if (area.get.length === 1) {
        const result = await (area.get as (keys: string) => Promise<Record<string, unknown>>)(SETTINGS_STORAGE_KEY);
        return coerceSnapshot(result?.[SETTINGS_STORAGE_KEY]);
      }

      return await new Promise<SettingsSnapshot>((resolve, reject) => {
        try {
          (area.get as (keys: string, callback: (items: Record<string, unknown>) => void) => void)(
            SETTINGS_STORAGE_KEY,
            (items) => {
              const lastError = (chrome as unknown as { runtime?: { lastError?: unknown } })?.runtime?.lastError;
              if (lastError) {
                reject(lastError);
                return;
              }
              resolve(coerceSnapshot(items?.[SETTINGS_STORAGE_KEY]));
            }
          );
        } catch (error) {
          reject(error);
        }
      });
    }
  } catch (error) {
    console.warn('[settingsStore] failed to read settings from storage', error);
  }

  const fallback = fallbackStore.get(SETTINGS_STORAGE_KEY);
  return fallback ? coerceSnapshot(fallback) : { ...DEFAULT_SNAPSHOT };
}

async function writeStoredSnapshot(snapshot: SettingsSnapshot): Promise<void> {
  fallbackStore.set(SETTINGS_STORAGE_KEY, snapshot);

  const area = getLocalStorageArea();
  if (!area) {
    return;
  }

  try {
    const payload = { [SETTINGS_STORAGE_KEY]: snapshot } as Record<string, SettingsSnapshot>;
    if (typeof area.set === 'function') {
      if (area.set.length === 1) {
        await (area.set as (items: Record<string, SettingsSnapshot>) => Promise<void>)(payload);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        try {
          (area.set as (items: Record<string, SettingsSnapshot>, callback: () => void) => void)(payload, () => {
            const lastError = (chrome as unknown as { runtime?: { lastError?: unknown } })?.runtime?.lastError;
            if (lastError) {
              reject(lastError);
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
  } catch (error) {
    console.warn('[settingsStore] failed to persist settings', error);
  }
}

function toSnapshot(state: SettingsState): SettingsSnapshot {
  return {
    language: state.language,
    direction: state.direction,
    showSidebar: state.showSidebar
  };
}

function areSnapshotsEqual(a: SettingsSnapshot, b: SettingsSnapshot): boolean {
  return a.language === b.language && a.direction === b.direction && a.showSidebar === b.showSidebar;
}

const fallbackStore = new Map<string, SettingsSnapshot>();
let initializePromise: Promise<void> | null = null;
let unsubscribePersist: (() => void) | null = null;
let storageListenerRegistered = false;
let hydrating = false;
let lastSnapshot: SettingsSnapshot = { ...DEFAULT_SNAPSHOT };

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SNAPSHOT,
  hydrated: false,
  setLanguage: (language) => set({ language }),
  toggleDirection: () =>
    set((state) => ({ direction: state.direction === 'ltr' ? 'rtl' : 'ltr' })),
  setShowSidebar: (value) => set({ showSidebar: value })
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

    const change = changes[SETTINGS_STORAGE_KEY];
    if (!change) {
      return;
    }

    const snapshot = coerceSnapshot(change.newValue);
    if (areSnapshotsEqual(snapshot, lastSnapshot)) {
      return;
    }

    hydrating = true;
    useSettingsStore.setState({ ...snapshot, hydrated: true });
    lastSnapshot = snapshot;
    hydrating = false;
  });

  storageListenerRegistered = true;
}

export async function initializeSettingsStore(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    let snapshot = { ...DEFAULT_SNAPSHOT };
    try {
      snapshot = await readStoredSnapshot();
    } catch (error) {
      console.warn('[settingsStore] falling back to default settings', error);
    }

    hydrating = true;
    useSettingsStore.setState({ ...snapshot, hydrated: true });
    lastSnapshot = snapshot;
    hydrating = false;

    if (!unsubscribePersist) {
      unsubscribePersist = useSettingsStore.subscribe((state) => {
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

export function __resetSettingsStoreForTests() {
  fallbackStore.clear();
  lastSnapshot = { ...DEFAULT_SNAPSHOT };
  hydrating = false;
  initializePromise = null;
  if (unsubscribePersist) {
    unsubscribePersist();
    unsubscribePersist = null;
  }
  useSettingsStore.setState({ ...DEFAULT_SNAPSHOT, hydrated: false });
}
