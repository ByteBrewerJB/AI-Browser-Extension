
import { create } from 'zustand';

import {
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  normalizeLanguage,
  type SupportedLanguage
} from '@/shared/i18n/languages';
import { isThemePreference, type ThemePreference } from '@/shared/theme/themePreference';

type TextDirection = 'ltr' | 'rtl';

interface SettingsSnapshot {
  language: SupportedLanguage;
  direction: TextDirection;
  showSidebar: boolean;
  maxTokens: number;
  promptHint: string;
  dismissedLauncherTips: number;
  dismissedGuideIds: string[];
  theme: ThemePreference;
}

interface SettingsState extends SettingsSnapshot {
  hydrated: boolean;
  setLanguage: (language: string) => void;
  toggleDirection: () => void;
  setShowSidebar: (value: boolean) => void;
  setMaxTokens: (value: number) => void;
  setPromptHint: (value: string) => void;
  incrementDismissedLauncherTips: () => void;
  setGuideDismissed: (guideId: string, dismissed: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

const SETTINGS_STORAGE_KEY = 'ai-companion:settings:v1';

export const DEFAULT_PROMPT_HINT = 'Use // to open saved prompts.';

function createDefaultSnapshot(): SettingsSnapshot {
  return {
    language: detectBrowserLanguage(),
    direction: 'ltr',
    showSidebar: true,
    maxTokens: 4096,
    promptHint: DEFAULT_PROMPT_HINT,
    dismissedLauncherTips: 0,
    dismissedGuideIds: [],
    theme: 'system'
  };
}

const DEFAULT_SNAPSHOT: SettingsSnapshot = createDefaultSnapshot();

const MAX_DISMISSED_GUIDES = 200;

function normalizeGuideIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<string>();
  for (const value of input) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed);
    if (unique.size >= MAX_DISMISSED_GUIDES) {
      break;
    }
  }

  return Array.from(unique).sort();
}

function coerceSnapshot(input: unknown): SettingsSnapshot {
  if (!input || typeof input !== 'object') {
    return createDefaultSnapshot();
  }

  const record = input as Partial<SettingsSnapshot> & { language?: unknown };
  const rawLanguage = record.language;
  const language =
    rawLanguage === undefined
      ? detectBrowserLanguage()
      : normalizeLanguage(rawLanguage) ?? DEFAULT_LANGUAGE;
  const direction: TextDirection = record.direction === 'rtl' ? 'rtl' : 'ltr';
  const showSidebar = typeof record.showSidebar === 'boolean' ? record.showSidebar : DEFAULT_SNAPSHOT.showSidebar;
  const parsedMaxTokens = Number(record.maxTokens);
  const maxTokens = Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0
    ? Math.round(parsedMaxTokens)
    : DEFAULT_SNAPSHOT.maxTokens;
  const promptHint = typeof record.promptHint === 'string' && record.promptHint.trim().length > 0
    ? record.promptHint.trim()
    : DEFAULT_SNAPSHOT.promptHint;
  const dismissedLauncherTips = Number.isFinite(record.dismissedLauncherTips)
    ? Math.max(0, Math.min(99, Math.floor(Number(record.dismissedLauncherTips))))
    : DEFAULT_SNAPSHOT.dismissedLauncherTips;

  const dismissedGuideIds = normalizeGuideIds((record as { dismissedGuideIds?: unknown })?.dismissedGuideIds);
  const themeValue = (record as { theme?: unknown })?.theme;
  const theme = isThemePreference(themeValue) ? themeValue : DEFAULT_SNAPSHOT.theme;

  return { language, direction, showSidebar, maxTokens, promptHint, dismissedLauncherTips, dismissedGuideIds, theme };
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
    return fallback ? coerceSnapshot(fallback) : createDefaultSnapshot();
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
  return fallback ? coerceSnapshot(fallback) : createDefaultSnapshot();
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
    showSidebar: state.showSidebar,
    maxTokens: state.maxTokens,
    promptHint: state.promptHint,
    dismissedLauncherTips: state.dismissedLauncherTips,
    dismissedGuideIds: state.dismissedGuideIds,
    theme: state.theme
  };
}

function areSnapshotsEqual(a: SettingsSnapshot, b: SettingsSnapshot): boolean {
  return (
    a.language === b.language &&
    a.direction === b.direction &&
    a.showSidebar === b.showSidebar &&
    a.maxTokens === b.maxTokens &&
    a.promptHint === b.promptHint &&
    a.dismissedLauncherTips === b.dismissedLauncherTips &&
    a.dismissedGuideIds.length === b.dismissedGuideIds.length &&
    a.dismissedGuideIds.every((value, index) => value === b.dismissedGuideIds[index]) &&
    a.theme === b.theme
  );
}

const fallbackStore = new Map<string, SettingsSnapshot>();
let initializePromise: Promise<void> | null = null;
let unsubscribePersist: (() => void) | null = null;
let storageListenerRegistered = false;
let hydrating = false;
let lastSnapshot: SettingsSnapshot = createDefaultSnapshot();

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SNAPSHOT,
  hydrated: false,
  setLanguage: (language) =>
    set((state) => {
      const normalized = normalizeLanguage(language) ?? state.language;
      if (state.language === normalized) {
        return state;
      }
      return { language: normalized };
    }),
  toggleDirection: () =>
    set((state) => ({ direction: state.direction === 'ltr' ? 'rtl' : 'ltr' })),
  setShowSidebar: (value) => set({ showSidebar: value }),
  setMaxTokens: (value) =>
    set(() => ({ maxTokens: Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_SNAPSHOT.maxTokens })),
  setPromptHint: (value) =>
    set(() => ({ promptHint: value.trim().length > 0 ? value.trim() : DEFAULT_SNAPSHOT.promptHint })),
  incrementDismissedLauncherTips: () =>
    set((state) => ({ dismissedLauncherTips: Math.min(99, state.dismissedLauncherTips + 1) })),
  setGuideDismissed: (guideId, dismissed) =>
    set((state) => {
      const trimmed = typeof guideId === 'string' ? guideId.trim() : '';
      if (!trimmed) {
        return state;
      }

      const nextIds = new Set(state.dismissedGuideIds);
      if (dismissed) {
        if (nextIds.size >= MAX_DISMISSED_GUIDES && !nextIds.has(trimmed)) {
          return state;
        }
        nextIds.add(trimmed);
      } else {
        nextIds.delete(trimmed);
      }

      const normalized = Array.from(nextIds).sort();
      if (
        normalized.length === state.dismissedGuideIds.length &&
        normalized.every((id, index) => state.dismissedGuideIds[index] === id)
      ) {
        return state;
      }

      return { dismissedGuideIds: normalized };
    }),
  setTheme: (theme) =>
    set((state) => ({ theme: isThemePreference(theme) ? theme : state.theme }))
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
    let snapshot = createDefaultSnapshot();
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
  lastSnapshot = createDefaultSnapshot();
  hydrating = false;
  initializePromise = null;
  if (unsubscribePersist) {
    unsubscribePersist();
    unsubscribePersist = null;
  }
  useSettingsStore.setState({ ...createDefaultSnapshot(), hydrated: false });
}
