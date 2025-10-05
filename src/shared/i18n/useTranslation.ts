import { useCallback, useSyncExternalStore } from 'react';

import { i18n } from './index';

type Translate = typeof i18n.t;

type UseTranslationResult = {
  t: Translate;
  i18n: typeof i18n;
  language: string;
  ready: boolean;
};

function subscribe(listener: () => void) {
  i18n.on('languageChanged', listener);
  return () => {
    i18n.off('languageChanged', listener);
  };
}

function getLanguage() {
  return i18n.language ?? 'en';
}

export function useTranslation(): UseTranslationResult {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);

  const translate = useCallback<Translate>(
    ((...args: Parameters<Translate>) => i18n.t(...args)) as Translate,
    [language]
  );

  return {
    t: translate,
    i18n,
    language,
    ready: true
  };
}
