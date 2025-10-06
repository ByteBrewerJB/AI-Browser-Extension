import i18n from 'i18next';

import en from './locales/en/common.json' with { type: 'json' };
import nl from './locales/nl/common.json' with { type: 'json' };
import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  detectBrowserLanguage,
  type SupportedLanguage
} from './languages';

let initialized = false;

export async function initI18n(preferredLanguage?: string): Promise<typeof i18n> {
  const targetLanguage = normalizeLanguage(preferredLanguage) ?? detectBrowserLanguage();

  if (initialized) {
    if (i18n.language !== targetLanguage) {
      await i18n.changeLanguage(targetLanguage);
    }
    return i18n;
  }

  await i18n.init({
    resources: {
      en: { translation: en },
      nl: { translation: nl }
    },
    lng: targetLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false
    }
  });

  initialized = true;
  return i18n;
}

export function setLanguage(lng: string | SupportedLanguage) {
  const normalized = normalizeLanguage(lng) ?? DEFAULT_LANGUAGE;
  return i18n.changeLanguage(normalized);
}

export function getCurrentLanguage() {
  return (i18n.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
}

export { i18n };
export { DEFAULT_LANGUAGE, normalizeLanguage };
export type { SupportedLanguage };
