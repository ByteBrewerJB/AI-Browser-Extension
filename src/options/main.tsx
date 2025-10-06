import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import { Options } from './Options';
import '@/styles/global.css';
import { initI18n } from '@/shared/i18n';
import { bindThemePreferenceToDocument } from '@/shared/theme/themeManager';
import { initializeEncryptionNotifications } from '@/shared/state/encryptionNotificationsStore';
import { initializeSettingsStore } from '@/shared/state/settingsStore';

async function bootstrap() {
  await initializeSettingsStore();
  const detachTheme = bindThemePreferenceToDocument();
  window.addEventListener('unload', detachTheme, { once: true });
  await initI18n();
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
