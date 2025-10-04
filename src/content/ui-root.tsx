import React, { StrictMode, useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { ensureShadowHost } from './sidebar-host';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import globalStylesUrl from '@/styles/global.css?url';

function ensureShadowRoot(host: HTMLElement): ShadowRoot {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  if (!shadow.querySelector('link[data-ai-companion="global-styles"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = globalStylesUrl;
    link.setAttribute('data-ai-companion', 'global-styles');
    shadow.appendChild(link);
  }

  if (!shadow.querySelector('style[data-ai-companion="reset"]')) {
    const style = document.createElement('style');
    style.setAttribute('data-ai-companion', 'reset');
    style.textContent = `
:host {
  all: initial;
  display: contents;
}
:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}
`;
    shadow.appendChild(style);
  }

  return shadow;
}

function mountReact(host: HTMLElement): HTMLDivElement {
  const shadow = ensureShadowRoot(host);
  host.textContent = '';

  let container = shadow.querySelector<HTMLDivElement>('div[data-ai-companion="root"]');
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-ai-companion', 'root');
    container.className = 'ai-companion-root';
    shadow.appendChild(container);
  }

  return container;
}

const toolbarOrder = ['history', 'prompts', 'media'] as const;
type ToolbarKey = (typeof toolbarOrder)[number];

function CompanionSidebarItem(): ReactElement {
  const { t } = useTranslation();
  const modalHeadingId = useId();
  const [activeToolbar, setActiveToolbar] = useState<ToolbarKey>('history');
  const [isModalOpen, setModalOpen] = useState(false);

  const toolbarLabel = useMemo(
    () => t(`content.sidebar.toolbars.${activeToolbar}` as const),
    [activeToolbar, t]
  );

  const modalPoints = useMemo(() => {
    const points = t('content.sidebar.modal.points', { returnObjects: true });
    return Array.isArray(points) ? (points as string[]) : [];
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
      <Tabs
        defaultValue={toolbarOrder[0]}
        onChange={(value) => {
          if (toolbarOrder.includes(value as ToolbarKey)) {
            setActiveToolbar(value as ToolbarKey);
          }
        }}
      >
        <TabList className="mb-2 flex gap-2">
          {toolbarOrder.map((key) => (
            <Tab key={key} value={key}>
              {t(`content.sidebar.tabs.${key}`)}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
          {toolbarOrder.map((key) => (
            <TabPanel key={key} value={key}>
              <p>{t(`content.sidebar.tabDescriptions.${key}`)}</p>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
      <Modal labelledBy={modalHeadingId} onClose={() => setModalOpen(false)} open={isModalOpen}>
        <ModalHeader className="space-y-2">
          <h3 id={modalHeadingId} className="text-lg font-semibold text-slate-100">
            {t('content.sidebar.modal.title')}
          </h3>
          <p className="text-sm text-slate-300">{t('content.sidebar.modal.description')}</p>
        </ModalHeader>
        <ModalBody>
          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-200">
            {modalPoints.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
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

function init() {
  ensureShadowHost().then((host) => {
    const container = mountReact(host);
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
