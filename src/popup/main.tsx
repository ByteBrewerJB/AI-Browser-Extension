import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import { Popup } from './Popup';
import '@/styles/global.css';
import { initI18n } from '@/shared/i18n';
import { initializeSettingsStore } from '@/shared/state/settingsStore';

async function bootstrap() {
  await initializeSettingsStore();
  await initI18n();
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Popup root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error('[popup] failed to bootstrap', error);
});



