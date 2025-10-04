import React, { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@/ui/components/Tabs';
import '@/styles/global.css';

function ensureShadowHost(): HTMLElement {
  const existing = document.getElementById('ai-companion-shadow-host');
  if (existing) {
    return existing;
  }
  const host = document.createElement('div');
  host.id = 'ai-companion-shadow-host';
  host.style.position = 'fixed';
  host.style.top = '16px';
  host.style.right = '16px';
  host.style.zIndex = '2147483646';
  document.documentElement.appendChild(host);
  return host;
}

function mountReact(rootElement: HTMLElement) {
  if (rootElement.shadowRoot) {
    return rootElement.shadowRoot as ShadowRoot;
  }
  const shadow = rootElement.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }
  `;
  shadow.appendChild(style);
  const container = document.createElement('div');
  shadow.appendChild(container);
  return shadow;
}

function CompanionOverlay() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeToolbar, setActiveToolbar] = useState<'history' | 'prompts' | 'media'>('history');

  const toolbarLabel = useMemo(() => {
    switch (activeToolbar) {
      case 'prompts':
        return 'Prompt toolbox';
      case 'media':
        return 'Voice controls';
      case 'history':
      default:
        return 'Conversation tools';
    }
  }, [activeToolbar]);

  return (
    <div className="pointer-events-auto w-80 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-slate-100 shadow-2xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">AI Companion</p>
          <h2 className="text-base font-semibold">{toolbarLabel}</h2>
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          Patterns
        </button>
      </header>
      <Tabs defaultValue="history" onChange={(value) => setActiveToolbar(value as typeof activeToolbar)}>
        <TabList className="mb-2 flex gap-2">
          <Tab value="history">History</Tab>
          <Tab value="prompts">Prompts</Tab>
          <Tab value="media">Media</Tab>
        </TabList>
        <TabPanels className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
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
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            onClick={() => setModalOpen(false)}
            type="button"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function init() {
  const host = ensureShadowHost();
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
    init();
  });
} else {
  init();
}
