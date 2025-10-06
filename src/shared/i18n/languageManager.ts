import { initI18n, setLanguage, normalizeLanguage, i18n } from './index';
import { DEFAULT_LANGUAGE } from './languages';
import { useSettingsStore } from '@/shared/state/settingsStore';

export function bindLanguagePreferenceToI18n(): () => void {
  const applyLanguage = (value: string): void => {
    const normalized = normalizeLanguage(value) ?? DEFAULT_LANGUAGE;
    if (!i18n.isInitialized) {
      void initI18n(normalized);
      return;
    }
    void setLanguage(normalized);
  };

  let currentLanguage = normalizeLanguage(useSettingsStore.getState().language) ?? DEFAULT_LANGUAGE;
  applyLanguage(currentLanguage);

  const unsubscribe = useSettingsStore.subscribe((state) => {
    const normalized = normalizeLanguage(state.language) ?? DEFAULT_LANGUAGE;
    if (normalized === currentLanguage) {
      return;
    }
    currentLanguage = normalized;
    applyLanguage(normalized);
  });

  return () => {
    unsubscribe();
  };
}
