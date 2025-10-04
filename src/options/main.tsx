import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { Options } from './Options';
import '@/styles/global.css';
import { i18n, initI18n } from '@/shared/i18n';
import { initializeSettingsStore } from '@/shared/state/settingsStore';

async function bootstrap() {
  await initializeSettingsStore();
  await initI18n();
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Options root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <Options />
      </I18nextProvider>
    </StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error('[options] failed to bootstrap', error);
});
