import React, { StrictMode, useEffect, useId, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { ensureShadowHost } from './sidebar-host';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import globalStylesUrl from '@/styles/global.css?url';
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
        </header>
        <Tabs defaultValue="history" onChange={(value) => setActiveToolbar(value as typeof activeToolbar)}>
          <TabList className="ai-companion-tabs mb-3 flex gap-2 rounded-lg bg-white/5 p-1">
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="history"
            >
              History
            </Tab>
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="prompts"
            >
              Prompts
            </Tab>
            <Tab
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors aria-selected:bg-emerald-500 aria-selected:text-emerald-950 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              value="media"
            >
              Media
            </Tab>
          </TabList>
          <TabPanels className="ai-companion-tab-panels space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200 shadow-inner">
            <TabPanel value="history">
              <p>
                Save and pin chats directly from the conversation view. Table presets created here sync with the dashboard.
              </p>
            </TabPanel>
            <TabPanel value="prompts">
              <p>
                Build prompt chains inline, attach them to GPT folders, and reuse them across popup and options surfaces.
              </p>
            </TabPanel>
            <TabPanel value="media">
              <p>
                Voice overlays reuse the shared modal + overlay primitives to ensure consistent focus management and styling.
              </p>
            </TabPanel>
          </TabPanels>
        </Tabs>
        <Modal labelledBy="overlay-modal-heading" onClose={() => setModalOpen(false)} open={isModalOpen}>
          <ModalHeader>
            <h3 id="overlay-modal-heading" className="text-lg font-semibold text-slate-100">
              Shared component library
            </h3>
            <p className="text-sm text-slate-300">
              Modals, tabs, and overlays are rendered within a shadow root so styles do not collide with ChatGPT.
            </p>
          </ModalHeader>
          <ModalBody>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-200">
              <li>Keyboard shortcuts remain functional thanks to consistent escape handling.</li>
              <li>All surfaces respect RTL layouts and localized labels from the shared i18n bundle.</li>
              <li>Zustand domain stores hydrate content, popup, and options entries without prop drilling.</li>
            </ul>
          </ModalBody>
          <ModalFooter>
            <button
              className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              Close
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </>
  );
}

function init() {
  ensureShadowHost().then((host) => {
    const shadow = mountReact(host);
    const container = shadow.querySelector('div:last-of-type') as HTMLDivElement | null;
    if (!container) {
      throw new Error('Failed to initialize companion overlay container');
    }
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <CompanionSidebarItem />
      </StrictMode>
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
