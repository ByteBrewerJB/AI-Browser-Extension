export const SUPPORTED_LANGUAGES = ['en', 'nl'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  if (typeof value !== 'string') {
    return false;
  }
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function normalizeLanguage(value: unknown): SupportedLanguage | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('nl')) {
    return 'nl';
  }

  if (trimmed.startsWith('en')) {
    return 'en';
  }

  if (isSupportedLanguage(trimmed)) {
    return trimmed;
  }

  return null;
}

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const navigatorWithLanguages = navigator as Navigator & { languages?: string[] };
  const candidates: string[] = [];

  if (Array.isArray(navigatorWithLanguages.languages)) {
    candidates.push(
      ...navigatorWithLanguages.languages.filter((value): value is string => typeof value === 'string')
    );
  }

  if (typeof navigator.language === 'string') {
    candidates.push(navigator.language);
  }

  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_LANGUAGE;
}
