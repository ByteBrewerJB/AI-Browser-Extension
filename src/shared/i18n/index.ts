import i18n from 'i18next';

import en from './locales/en/common.json' with { type: 'json' };
import nl from './locales/nl/common.json' with { type: 'json' };

let initialized = false;

export async function initI18n(): Promise<typeof i18n> {
  const languageCode =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : 'en';
  const targetLanguage = languageCode.startsWith('nl') ? 'nl' : 'en';

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
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

  initialized = true;
  return i18n;
}

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng);
}

export function getCurrentLanguage() {
  return i18n.language;
}

export { i18n };

