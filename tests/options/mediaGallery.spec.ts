import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { MediaItemRecord } from '../../src/core/models';
import { listMediaItems, resetDatabase, seedMediaItems } from '../../src/core/storage';
import { VirtualMediaGrid } from '../../src/options/features/media/MediaGallery';

async function gatherMediaItems(limit: number) {
  const items: MediaItemRecord[] = [];
  let cursor: number | null = null;

  do {
    const { items: page, nextCursor } = await listMediaItems({ limit, cursor });
    items.push(...page);
    cursor = nextCursor;
  } while (cursor !== null);

  return items;
}

async function runMediaGalleryPerfCheck() {
  await resetDatabase();
  await seedMediaItems(1000);

  const items = await gatherMediaItems(200);

  assert.ok(items.length >= 1000, `expected at least 1000 items, received ${items.length}`);

  const start = performance.now();
  const markup = renderToStaticMarkup(
    createElement(VirtualMediaGrid, {
      forcedColumnCount: 4,
      initialViewport: { width: 720, height: 480 },
      isLoading: false,
      items,
      loadingLabel: 'Loading more…'
    })
  );
  const duration = performance.now() - start;

  const renderedTiles = (markup.match(/role="listitem"/g) ?? []).length;

  console.log(
    `[perf] media gallery rendered ${renderedTiles} tiles from ${items.length} records in ${duration.toFixed(2)}ms`
  );

  assert.ok(renderedTiles <= 120, `expected virtual grid to render <=120 tiles, got ${renderedTiles}`);
  assert.ok(duration < 300, `expected render <300ms, got ${duration.toFixed(2)}ms`);
}

try {
  await runMediaGalleryPerfCheck();
} catch (error) {
  console.error('[tests] media gallery perf check failed', error);
  process.exitCode = 1;
}
