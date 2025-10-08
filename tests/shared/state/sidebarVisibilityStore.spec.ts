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
  assert.equal(store.getState().canUndo, true);
  assert.equal(store.getState().canRedo, false);
  const initialAnnouncement = store.getState().announcement;
  assert.ok(initialAnnouncement);
  assert.equal(initialAnnouncement?.entry.metadata.kind, 'pin');
  assert.equal(initialAnnouncement?.direction, 'apply');

  if (initialAnnouncement) {
    store.getState().acknowledgeAnnouncement(initialAnnouncement.id);
  }
  assert.equal(store.getState().announcement, null);

  store.getState().setSectionHidden('history.recent', true);
  assert.ok(store.getState().hiddenSections.includes('history.recent'));
  assert.ok(store.getState().collapsedSections.includes('history.recent'));
  assert.ok(!store.getState().pinnedSections.includes('history.recent'));

  store.getState().setSectionCollapsed('history.bookmarks', true);
  assert.ok(store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().toggleSectionCollapsed('history.bookmarks');
  assert.ok(!store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().setSectionPinned('history.pinned', false);
  assert.equal(store.getState().pinnedSections.length, 0);

  store.getState().setSectionPinned('history.recent', true);
  assert.ok(store.getState().pinnedSections.includes('history.recent'));

  store.getState().undo();
  assert.ok(!store.getState().pinnedSections.includes('history.recent'));
  assert.equal(store.getState().canRedo, true);
  assert.equal(store.getState().announcement?.direction, 'undo');

  store.getState().redo();
  assert.ok(store.getState().pinnedSections.includes('history.recent'));
  assert.equal(store.getState().announcement?.direction, 'redo');

  store.getState().setSectionHidden('history.recent', true);
  assert.ok(store.getState().hiddenSections.includes('history.recent'));
  assert.ok(store.getState().collapsedSections.includes('history.recent'));

  store.getState().setSectionCollapsed('history.bookmarks', true);
  assert.ok(store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().undo();
  assert.ok(store.getState().pinnedSections.includes('history.recent'));
  assert.ok(!store.getState().hiddenSections.includes('history.recent'));
  assert.ok(!store.getState().collapsedSections.includes('history.recent'));
  assert.ok(store.getState().collapsedSections.includes('history.bookmarks'));

  store.getState().redo();
  assert.ok(store.getState().hiddenSections.includes('history.recent'));
  assert.ok(store.getState().collapsedSections.includes('history.recent'));
  assert.ok(store.getState().collapsedSections.includes('history.bookmarks'));
}

await run();
