import assert from 'node:assert/strict';

import {
  initializeSidebarVisibilityStore,
  useSidebarVisibilityStore,
  __resetSidebarVisibilityStoreForTests
} from '@/shared/state/sidebarVisibilityStore';

async function run() {
  __resetSidebarVisibilityStoreForTests();
  await initializeSidebarVisibilityStore();

  const store = useSidebarVisibilityStore;

  assert.deepEqual(store.getState().pinnedSections, []);
  assert.deepEqual(store.getState().hiddenSections, []);
  assert.deepEqual(store.getState().collapsedSections, []);

  store.getState().setSectionPinned('history.pinned', true);
  assert.deepEqual(store.getState().pinnedSections, ['history.pinned']);

  store.getState().setSectionHidden('history.recent', true);
  assert.ok(store.getState().hiddenSections.includes('history.recent'));

  store.getState().setSectionCollapsed('history.bookmarks', true);
  assert.ok(store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().toggleSectionCollapsed('history.bookmarks');
  assert.ok(!store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().setSectionPinned('history.pinned', false);
  assert.equal(store.getState().pinnedSections.length, 0);
}

await run();
