import type { PromptRecord } from '@/core/models';
import { parseChainTemplate, renderChainTemplate } from '@/core/chains/chainDslParser';
import { getPromptChainById, updatePromptChain } from '@/core/storage';
import { db } from '@/core/storage/db';
import { usePromptChainsStore } from '@/shared/state/promptChainsStore';
import type { ChainRunPlan } from '@/shared/types/promptChains';
import { insertTextIntoComposer } from './textareaPrompts';

const STEP_DELAY_MS = 250;

export type PromptChainRunResult =
  | { status: 'completed'; chainId: string; executedAt: string; steps: number }
  | { status: 'cancelled'; chainId: string; steps: number }
  | { status: 'busy' }
  | { status: 'not_found' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runPromptChainById(
  chainId: string,
  plan?: ChainRunPlan
): Promise<PromptChainRunResult> {
  const runtime = usePromptChainsStore.getState();
  if (runtime.status === 'running') {
    return { status: 'busy' };
  }

  const chain = await getPromptChainById(chainId);
  if (!chain) {
    return { status: 'not_found' };
  }

  if (chain.nodeIds.length === 0) {
    return { status: 'empty' };
  }

  const records = await db.prompts.bulkGet(chain.nodeIds);
  const prompts = chain.nodeIds
    .map((_, index) => records[index])
    .filter((record): record is PromptRecord => Boolean(record));

  if (prompts.length === 0) {
    return { status: 'empty' };
  }

  if (prompts.length !== chain.nodeIds.length) {
    console.warn('[ai-companion] some prompt chain steps are missing prompts and will be skipped');
  }

  const preparedSteps = plan?.steps ?? [];
  const preparedMap = new Map(preparedSteps.map((step) => [step.promptId, step]));
  const variables = plan?.variables ?? {};

  const resolvedPrompts = prompts.map((prompt) => {
    const prepared = preparedMap.get(prompt.id);
    if (prepared) {
      return prepared.resolvedContent;
    }

    const parsed = parseChainTemplate(prompt.content);
    if (parsed.hasErrors) {
      return prompt.content;
    }

    try {
      return renderChainTemplate(parsed, {
        variables,
        onMissingVariable: (name) => variables[name] ?? `{{${name}}}`,
        onMissingStepOutput: ({ stepId, property }) => `[[${stepId}.${property}]]`
      });
    } catch (error) {
      console.error('[ai-companion] failed to resolve chain prompt content', error);
      return prompt.content;
    }
  });

  usePromptChainsStore.getState().startRun(chainId, resolvedPrompts.length);

  try {
    for (let index = 0; index < resolvedPrompts.length; index += 1) {
      const beforeStep = usePromptChainsStore.getState();
      if (beforeStep.status === 'cancelled' && beforeStep.activeChainId === chainId) {
        return { status: 'cancelled', chainId, steps: beforeStep.completedSteps };
      }

      const prompt = resolvedPrompts[index];
      const text = index === 0 ? prompt : `\n\n${prompt}`;
      const inserted = insertTextIntoComposer(text);
      if (!inserted) {
        usePromptChainsStore.getState().failRun('Composer unavailable');
        return { status: 'error', message: 'composer_unavailable' };
      }

      usePromptChainsStore.getState().advanceRun(index + 1);

      const afterStep = usePromptChainsStore.getState();
      if (afterStep.status === 'cancelled' && afterStep.activeChainId === chainId) {
        return { status: 'cancelled', chainId, steps: afterStep.completedSteps };
      }

      if (index < resolvedPrompts.length - 1) {
        await delay(STEP_DELAY_MS);
      }
    }

    const afterLoop = usePromptChainsStore.getState();
    if (afterLoop.status === 'cancelled' && afterLoop.activeChainId === chainId) {
      return { status: 'cancelled', chainId, steps: afterLoop.completedSteps };
    }

    const executedAt = new Date().toISOString();
    await updatePromptChain({ id: chainId, lastExecutedAt: executedAt });
    usePromptChainsStore.getState().completeRun(executedAt);
    return { status: 'completed', chainId, executedAt, steps: resolvedPrompts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    usePromptChainsStore.getState().failRun(message);
    return { status: 'error', message };
  }
}
