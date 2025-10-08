import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import { Options } from './Options';
import '@/styles/global.css';
import { initI18n } from '@/shared/i18n';
import { bindLanguagePreferenceToI18n } from '@/shared/i18n/languageManager';
import { bindThemePreferenceToDocument } from '@/shared/theme/themeManager';
import { initializeEncryptionNotifications } from '@/shared/state/encryptionNotificationsStore';
import { initializeSettingsStore, useSettingsStore } from '@/shared/state/settingsStore';
import { initializeSidebarVisibilityStore } from '@/shared/state/sidebarVisibilityStore';

async function bootstrap() {
  await Promise.all([initializeSettingsStore(), initializeSidebarVisibilityStore()]);

  const detachTheme = bindThemePreferenceToDocument();
  const initialLanguage = useSettingsStore.getState().language;
  await initI18n(initialLanguage);
  const detachLanguage = bindLanguagePreferenceToI18n();

  window.addEventListener(
    'unload',
    () => {
      detachTheme();
      detachLanguage();
    },
    { once: true }
  );

  initializeEncryptionNotifications();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Options root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <Options />
    </StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error('[options] failed to bootstrap', error);
});
