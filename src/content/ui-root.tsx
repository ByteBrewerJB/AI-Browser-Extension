import React, { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { ensureShadowHost } from './sidebar-host';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import globalStylesUrl from '@/styles/global.css?url';
import { initI18n } from '@/shared/i18n';

function mountReact(rootElement: HTMLElement) {
  if (rootElement.shadowRoot) {
    return rootElement.shadowRoot as ShadowRoot;
  }
  const shadow = rootElement.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; display: block; width: 100%; }
    :host([data-ai-companion-collapsed="true"]) {
      position: fixed;
      top: 16px;
      right: 16px;
      width: min(20rem, calc(100vw - 32px));
      max-width: calc(100vw - 32px);
      z-index: 2147483646;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }
  `;
  shadow.appendChild(style);
  const globalStyles = document.createElement('link');
  globalStyles.rel = 'stylesheet';
  globalStyles.href = globalStylesUrl;
  shadow.appendChild(globalStyles);
  const container = document.createElement('div');
  shadow.appendChild(container);
  return shadow;
}

function CompanionOverlay() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeToolbar, setActiveToolbar] = useState<'history' | 'prompts' | 'media'>('history');
  const { t } = useTranslation();

  const toolbarLabel = useMemo(() => {
    return t(`content.sidebar.toolbars.${activeToolbar}`);
  }, [activeToolbar, t]);

  const modalPoints = useMemo(() => {
    return t('content.sidebar.modal.points', { returnObjects: true }) as string[];
  }, [t]);

  return (
    <div className="pointer-events-auto w-full rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-slate-100 shadow-xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
            {t('content.sidebar.title')}
          </p>
          <h2 className="text-base font-semibold">{toolbarLabel}</h2>
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
          aria-label={t('content.sidebar.patternButtonAria')}
          onClick={() => setModalOpen(true)}
          type="button"
        >
          {t('content.sidebar.patternButton')}
        </button>
      </header>
      <Tabs defaultValue="history" onChange={(value) => setActiveToolbar(value as typeof activeToolbar)}>
        <TabList className="mb-2 flex gap-2">
          <Tab value="history">{t('content.sidebar.tabs.history')}</Tab>
          <Tab value="prompts">{t('content.sidebar.tabs.prompts')}</Tab>
          <Tab value="media">{t('content.sidebar.tabs.media')}</Tab>
        </TabList>
        <TabPanels className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
          <TabPanel value="history">
            <p>{t('content.sidebar.tabDescriptions.history')}</p>
          </TabPanel>
          <TabPanel value="prompts">
            <p>{t('content.sidebar.tabDescriptions.prompts')}</p>
          </TabPanel>
          <TabPanel value="media">
            <p>{t('content.sidebar.tabDescriptions.media')}</p>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Modal labelledBy="overlay-modal-heading" onClose={() => setModalOpen(false)} open={isModalOpen}>
        <ModalHeader>
          <h3 id="overlay-modal-heading" className="text-lg font-semibold text-slate-100">
            {t('content.sidebar.modal.title')}
          </h3>
          <p className="text-sm text-slate-300">{t('content.sidebar.modal.description')}</p>
        </ModalHeader>
        <ModalBody>
          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-200">
            {modalPoints.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </ModalBody>
        <ModalFooter>
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            aria-label={t('content.sidebar.modal.closeAria')}
            onClick={() => setModalOpen(false)}
            type="button"
          >
            {t('content.sidebar.modal.close')}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

async function init() {
  const host = await ensureShadowHost();
  await initI18n();
  const shadow = mountReact(host);
  const container = shadow.querySelector('div:last-of-type') as HTMLDivElement | null;
  if (!container) {
    throw new Error('Failed to initialize companion overlay container');
  }
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <CompanionOverlay />
    </StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
