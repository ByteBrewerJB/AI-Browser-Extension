import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MediaOverlay } from '../../src/ui/components/MediaOverlay';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../src/ui/components/Modal';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '../../src/ui/components/Tabs';

interface Example {
  name: string;
  render: () => string;
  expectations: (markup: string) => void;
}

// Ensure SSR fallback paths are exercised without polluting other suites.
const originalWindow = (globalThis as any).window;
const originalDocument = (globalThis as any).document;
(globalThis as any).window = undefined;
(globalThis as any).document = undefined;

const examples: Example[] = [
  {
    name: 'tabs-default',
    render: () =>
      renderToStaticMarkup(
        <Tabs defaultValue="one">
          <TabList>
            <Tab value="one">First tab</Tab>
            <Tab value="two">Second tab</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="one">
              <p>First tab content</p>
            </TabPanel>
            <TabPanel value="two">
              <p>Second tab content</p>
            </TabPanel>
          </TabPanels>
        </Tabs>
      ),
    expectations: (markup) => {
      assert.ok(markup.includes('First tab content'), 'renders first tab panel');
      assert.ok(markup.includes('tab-one'), 'renders stable tab ids');
    }
  },
  {
    name: 'modal-open',
    render: () =>
      renderToStaticMarkup(
        <Modal labelledBy="modal-heading" onClose={() => {}} open>
          <ModalHeader>
            <h2 id="modal-heading">Sample modal</h2>
          </ModalHeader>
          <ModalBody>
            <p>Modal body rendered in fallback SSR mode.</p>
          </ModalBody>
          <ModalFooter>
            <button type="button">Close</button>
          </ModalFooter>
        </Modal>
      ),
    expectations: (markup) => {
      assert.ok(markup.includes('Sample modal'), 'renders modal header');
      assert.ok(markup.includes('role="dialog"'), 'exposes dialog role in markup');
    }
  },
  {
    name: 'media-overlay-open',
    render: () =>
      renderToStaticMarkup(
        <MediaOverlay labelledBy="overlay-heading" onClose={() => {}} open>
          <header>
            <h2 id="overlay-heading">Overlay preview</h2>
          </header>
        </MediaOverlay>
      ),
    expectations: (markup) => {
      assert.ok(markup.includes('Overlay preview'), 'renders overlay content');
      assert.ok(markup.includes('role="presentation"'), 'sets presentation role');
    }
  }
];

try {
  for (const example of examples) {
    const markup = example.render();
    console.log(`ℹ️ ${example.name} markup`);
    console.log(markup);
    example.expectations(markup);
  }
} finally {
  (globalThis as any).window = originalWindow;
  (globalThis as any).document = originalDocument;
}
