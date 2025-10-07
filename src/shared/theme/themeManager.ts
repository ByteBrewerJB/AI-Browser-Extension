import { useSettingsStore } from '@/shared/state/settingsStore';
import { resolveTheme, type ThemePreference } from './themePreference';

type MediaQueryChangeHandler = () => void;

type MediaCleanup = () => void;

function getMediaQuery(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(query);
}

function addMediaListener(media: MediaQueryList | null, handler: MediaQueryChangeHandler): MediaCleanup {
  if (!media) {
    return () => undefined;
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }

  if (typeof media.addListener === 'function') {
    media.addListener(handler);
    return () => media.removeListener(handler);
  }

  return () => undefined;
}

function applyResolvedTheme(theme: ReturnType<typeof resolveTheme>) {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  if ('dataset' in root && root.dataset) {
    root.dataset.theme = theme;
    return;
  }
  root.setAttribute('data-theme', theme);
}

export function applyThemePreference(preference: ThemePreference): MediaCleanup {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  const prefersDark = getMediaQuery('(prefers-color-scheme: dark)');
  const prefersHighContrast = getMediaQuery('(prefers-contrast: more)');

  const updateTheme = () => {
    applyResolvedTheme(
      resolveTheme(preference, {
        prefersDark: prefersDark?.matches ?? false,
        prefersHighContrast: prefersHighContrast?.matches ?? false
      })
    );
  };

  updateTheme();

  if (preference !== 'system') {
    return () => undefined;
  }

  const cleanups: MediaCleanup[] = [];
  cleanups.push(addMediaListener(prefersDark, updateTheme));
  cleanups.push(addMediaListener(prefersHighContrast, updateTheme));

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

export function bindThemePreferenceToDocument(): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let disposeMedia = applyThemePreference(useSettingsStore.getState().theme);

  const unsubscribe = useSettingsStore.subscribe((state) => {
    disposeMedia();
    disposeMedia = applyThemePreference(state.theme);
  });

  return () => {
    unsubscribe();
    disposeMedia();
  };
}
