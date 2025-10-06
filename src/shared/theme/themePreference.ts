export type ThemePreference = 'system' | 'light' | 'dark' | 'high-contrast';
export type ResolvedTheme = 'light' | 'dark' | 'high-contrast';

interface ResolveThemeOptions {
  prefersDark?: boolean;
  prefersHighContrast?: boolean;
}

const VALID_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark', 'high-contrast'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return VALID_PREFERENCES.includes(value as ThemePreference);
}

export function resolveTheme(
  preference: ThemePreference,
  options: ResolveThemeOptions = {}
): ResolvedTheme {
  if (preference === 'system') {
    if (options.prefersHighContrast) {
      return 'high-contrast';
    }
    return options.prefersDark ? 'dark' : 'light';
  }

  if (preference === 'high-contrast') {
    return 'high-contrast';
  }

  return preference;
}
