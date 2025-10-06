import assert from 'node:assert/strict';

import { bindLanguagePreferenceToI18n } from '@/shared/i18n/languageManager';
import { initI18n, i18n } from '@/shared/i18n';
import { useSettingsStore, __resetSettingsStoreForTests } from '@/shared/state/settingsStore';

function waitForLanguage(language: string): Promise<void> {
  if (i18n.language === language) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handler = (nextLanguage: string) => {
      if (nextLanguage === language) {
        i18n.off('languageChanged', handler);
        resolve();
      }
    };
    i18n.on('languageChanged', handler);
  });
}

async function run() {
  __resetSettingsStoreForTests();
  await initI18n('en');

  const unsubscribe = bindLanguagePreferenceToI18n();

  useSettingsStore.getState().setLanguage('nl');
  await waitForLanguage('nl');
  assert.equal(i18n.language, 'nl');

  useSettingsStore.getState().setLanguage('en');
  await waitForLanguage('en');
  assert.equal(i18n.language, 'en');

  unsubscribe();
}

await run();
