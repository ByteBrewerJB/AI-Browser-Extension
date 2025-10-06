import assert from 'node:assert/strict';

import {
  parseChainTemplate,
  renderChainTemplate
} from '../../src/core/chains/chainDslParser';

type AsyncTest = [name: string, execute: () => Promise<void>];

const tests: AsyncTest[] = [
  [
    'parses variables and step outputs from chain template',
    async () => {
      const template = `Research on {{topic}} using [[gather.output]]. Next: [[summarise.notes]]`;

      const parsed = parseChainTemplate(template);

      assert.equal(parsed.hasErrors, false);
      assert.deepEqual(parsed.variables, ['topic']);
      assert.deepEqual(parsed.stepOutputs, [
        { stepId: 'gather', property: 'output' },
        { stepId: 'summarise', property: 'notes' }
      ]);
      assert.equal(parsed.tokens.length, 6);
    }
  ],
  [
    'reports syntax issues but preserves original text segments',
    async () => {
      const template = `Hello {{}} [[invalid]] [[ok.output]] {{user-name}}`;

      const parsed = parseChainTemplate(template);

      assert.equal(parsed.hasErrors, true);
      assert.equal(parsed.errors.length >= 2, true);
      const firstText = parsed.tokens.find((token) => token.type === 'text');
      assert.equal(firstText?.type, 'text');
      assert.ok(firstText && 'value' in firstText && firstText.value.includes('Hello'));
      assert.deepEqual(parsed.variables, ['user-name']);
      assert.deepEqual(parsed.stepOutputs, [{ stepId: 'ok', property: 'output' }]);
    }
  ],
  [
    'renders template with provided context and falls back via hooks',
    async () => {
      const template = '[[first.output]] → {{audience}} → [[second.summary]]';
      const parsed = parseChainTemplate(template);

      const rendered = renderChainTemplate(parsed, {
        variables: { audience: 'Designers' },
        stepOutputs: {
          first: { output: 'Research doc' }
        },
        onMissingStepOutput: ({ stepId }) => (stepId === 'second' ? 'Pending' : undefined)
      });

      assert.equal(rendered, 'Research doc → Designers → Pending');
    }
  ]
];

async function run() {
  let hasFailure = false;

  for (const [name, execute] of tests) {
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
