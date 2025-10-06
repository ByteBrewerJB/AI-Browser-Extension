import type { ChainTemplateParseResult } from '@/core/chains/chainDslParser';

export interface ChainRunPlanStep {
  promptId: string;
  template: string;
  parse: ChainTemplateParseResult;
  resolvedContent: string;
}

export interface ChainRunPlan {
  chainId: string;
  variables: Record<string, string>;
  steps: ChainRunPlanStep[];
}
