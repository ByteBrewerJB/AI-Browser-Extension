import assert from 'node:assert/strict';

import {
  __resetPromptChainStoreForTests,
  createPromptChain,
  listPromptChains,
  reorderPromptChainNodes,
  updatePromptChain
} from '../src/core/storage/promptChains';

type AsyncTest = [name: string, execute: () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'creates prompt chains with sanitized node order',
    async () => {
      const created = await createPromptChain({
        name: ' Research flow ',
        nodeIds: [' alpha ', '', 'beta', 'alpha', 'gamma '],
        variables: [' topic ', 'persona', 'topic']
      });

      assert.equal(created.name, 'Research flow');
      assert.deepEqual(created.nodeIds, ['alpha', 'beta', 'gamma']);
      assert.deepEqual(created.variables, ['topic', 'persona']);
      assert.equal(created.lastExecutedAt, null);

      const stored = await listPromptChains();
      assert.equal(stored.length, 1);
      assert.deepEqual(stored[0].nodeIds, ['alpha', 'beta', 'gamma']);
      assert.deepEqual(stored[0].variables, ['topic', 'persona']);
    }
  ],
  [
    'updates prompt chains with trimmed names and nodes',
    async () => {
      const created = await createPromptChain({ name: 'Initial chain', nodeIds: ['one', 'two'] });

      await updatePromptChain({
        id: created.id,
        name: '  Updated chain  ',
        nodeIds: [' two ', 'three', 'two']
      });

      const chains = await listPromptChains();
      assert.equal(chains.length, 1);
      assert.equal(chains[0].name, 'Updated chain');
      assert.deepEqual(chains[0].nodeIds, ['two', 'three']);
    }
  ],
  [
    'orders prompt chains by last executed then updated timestamps',
    async () => {
      const first = await createPromptChain({ name: 'First', nodeIds: [] });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await createPromptChain({ name: 'Second', nodeIds: [] });

      await updatePromptChain({ id: first.id, nodeIds: ['revisit'] });
      await updatePromptChain({ id: second.id, lastExecutedAt: new Date().toISOString() });

      const chains = await listPromptChains();
      assert.deepEqual(
        chains.map((chain) => chain.id),
        [second.id, first.id]
      );
    }
  ],
  [
    'updates variables and last executed timestamp',
    async () => {
      const created = await createPromptChain({ name: 'Chain', nodeIds: ['one'] });

      const timestamp = new Date().toISOString();
      await updatePromptChain({
        id: created.id,
        variables: ['first', 'second', 'first'],
        lastExecutedAt: timestamp
      });

      const [chain] = await listPromptChains();
      assert.deepEqual(chain.variables, ['first', 'second']);
      assert.equal(chain.lastExecutedAt, timestamp);
    }
  ],
  [
    'reorders nodes within a chain',
    async () => {
      const created = await createPromptChain({ name: 'Reorder test', nodeIds: ['one', 'two', 'three'] });

      await reorderPromptChainNodes(created.id, 0, 2);

      const chains = await listPromptChains();
      assert.deepEqual(chains[0].nodeIds, ['two', 'three', 'one']);
    }
  ]
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    await __resetPromptChainStoreForTests();
    try {
      await execute();
      console.log(`✓ ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`✖ ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await run();
