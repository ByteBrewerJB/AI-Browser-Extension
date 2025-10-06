import assert from 'node:assert/strict';

import { useSettingsStore, __resetSettingsStoreForTests } from '@/shared/state/settingsStore';

async function run() {
  __resetSettingsStoreForTests();

  useSettingsStore.getState().setLanguage('nl-NL');
  assert.equal(useSettingsStore.getState().language, 'nl');

  const initialLanguage = useSettingsStore.getState().language;
  useSettingsStore.getState().setLanguage('de-DE');
  assert.equal(useSettingsStore.getState().language, initialLanguage);
}

await run();
