import assert from 'node:assert/strict';

import { findInlineTrigger } from '@/content/inlineLauncherTriggers';

type TestCase = [name: string, execute: () => void];

const tests: TestCase[] = [
  [
    'matches prompt trigger at start of message',
    () => {
      const match = findInlineTrigger('//', 2);
      assert.deepEqual(match, { target: 'prompts', start: 0, end: 2, query: '' });
    }
  ],
  [
    'trims whitespace when deriving prompt query',
    () => {
      const match = findInlineTrigger('  // plan  ', 10);
      assert.deepEqual(match, { target: 'prompts', start: 2, end: 10, query: 'plan' });
    }
  ],
  [
    'ignores triggers embedded inside other tokens',
    () => {
      const match = findInlineTrigger('http://example', 14);
      assert.equal(match, null);
    }
  ],
  [
    'matches chain trigger with trailing query text',
    () => {
      const match = findInlineTrigger('..follow-up email', 17);
      assert.deepEqual(match, { target: 'chains', start: 0, end: 17, query: 'follow-up email' });
    }
  ],
  [
    'rejects trigger spans that include new lines',
    () => {
      const match = findInlineTrigger('//plan\nnext', 7);
      assert.equal(match, null);
    }
  ]
];

function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
    try {
      execute();
      console.log(`\u2713 ${name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`\u2717 ${name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

run();
