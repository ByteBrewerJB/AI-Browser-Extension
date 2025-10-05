import type { PromptRecord } from '@/core/models';
import { getPromptChainById, updatePromptChain } from '@/core/storage';
import { db } from '@/core/storage/db';
import { usePromptChainsStore } from '@/shared/state/promptChainsStore';
import { insertTextIntoComposer } from './textareaPrompts';

const STEP_DELAY_MS = 250;

export type PromptChainRunResult =
  | { status: 'completed'; chainId: string; executedAt: string; steps: number }
  | { status: 'busy' }
  | { status: 'not_found' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runPromptChainById(chainId: string): Promise<PromptChainRunResult> {
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

  usePromptChainsStore.getState().startRun(chainId, prompts.length);

  try {
    for (let index = 0; index < prompts.length; index += 1) {
      const prompt = prompts[index];
      const text = index === 0 ? prompt.content : `\n\n${prompt.content}`;
      const inserted = insertTextIntoComposer(text);
      if (!inserted) {
        usePromptChainsStore.getState().failRun('Composer unavailable');
        return { status: 'error', message: 'composer_unavailable' };
      }

      usePromptChainsStore.getState().advanceRun(index + 1);
      if (index < prompts.length - 1) {
        await delay(STEP_DELAY_MS);
      }
    }

    const executedAt = new Date().toISOString();
    await updatePromptChain({ id: chainId, lastExecutedAt: executedAt });
    usePromptChainsStore.getState().completeRun(executedAt);
    return { status: 'completed', chainId, executedAt, steps: prompts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    usePromptChainsStore.getState().failRun(message);
    return { status: 'error', message };
  }
}
