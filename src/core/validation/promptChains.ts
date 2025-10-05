export const PROMPT_CHAIN_VARIABLE_LIMIT = 16;
export const PROMPT_CHAIN_VARIABLE_MAX_LENGTH = 48;
const VARIABLE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export type PromptVariablesSchemaIssueCode =
  | 'not_array'
  | 'invalid_type'
  | 'empty'
  | 'tooLong'
  | 'pattern'
  | 'duplicate'
  | 'tooMany';

export interface PromptVariablesSchemaIssue {
  code: PromptVariablesSchemaIssueCode;
  index?: number;
  value?: string;
}

export class PromptVariablesSchemaError extends Error {
  issues: PromptVariablesSchemaIssue[];

  constructor(issues: PromptVariablesSchemaIssue[]) {
    const [firstIssue] = issues;
    super(firstIssue ? `Prompt variables validation failed: ${firstIssue.code}` : 'Prompt variables validation failed');
    this.name = 'PromptVariablesSchemaError';
    this.issues = issues;
  }
}

export function normalizePromptVariable(value: string) {
  return value.trim();
}

export function getPromptVariableKey(value: string) {
  return value.toLowerCase();
}

export function validatePromptVariable(value: unknown):
  | { success: true; value: string }
  | { success: false; issue: PromptVariablesSchemaIssue } {
  if (typeof value !== 'string') {
    return { success: false, issue: { code: 'invalid_type' } };
  }

  const normalized = normalizePromptVariable(value);
  if (!normalized) {
    return { success: false, issue: { code: 'empty', value: normalized } };
  }

  if (normalized.length > PROMPT_CHAIN_VARIABLE_MAX_LENGTH) {
    return { success: false, issue: { code: 'tooLong', value: normalized } };
  }

  if (!VARIABLE_PATTERN.test(normalized)) {
    return { success: false, issue: { code: 'pattern', value: normalized } };
  }

  return { success: true, value: normalized };
}

function createError(issue: PromptVariablesSchemaIssue) {
  return new PromptVariablesSchemaError([issue]);
}

export const promptVariablesSchema = {
  safeParse(value: unknown):
    | { success: true; data: string[] }
    | { success: false; error: PromptVariablesSchemaError } {
    if (!Array.isArray(value)) {
      return { success: false, error: createError({ code: 'not_array' }) };
    }

    if (value.length > PROMPT_CHAIN_VARIABLE_LIMIT) {
      return { success: false, error: createError({ code: 'tooMany' }) };
    }

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < value.length; index += 1) {
      const raw = value[index];
      const result = validatePromptVariable(raw);
      if (!result.success) {
        return {
          success: false,
          error: createError({ ...result.issue, index })
        };
      }

      const key = getPromptVariableKey(result.value);
      if (seen.has(key)) {
        return { success: false, error: createError({ code: 'duplicate', index, value: result.value }) };
      }

      seen.add(key);
      normalized.push(result.value);

      if (normalized.length > PROMPT_CHAIN_VARIABLE_LIMIT) {
        return { success: false, error: createError({ code: 'tooMany' }) };
      }
    }

    return { success: true, data: normalized };
  },
  parse(value: unknown) {
    const result = this.safeParse(value);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }
};
