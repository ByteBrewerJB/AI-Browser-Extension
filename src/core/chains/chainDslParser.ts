export interface ChainTemplateTokenText {
  type: 'text';
  value: string;
}

export interface ChainTemplateTokenVariable {
  type: 'variable';
  name: string;
}

export interface ChainTemplateTokenStepOutput {
  type: 'stepOutput';
  stepId: string;
  property: string;
}

export type ChainTemplateToken =
  | ChainTemplateTokenText
  | ChainTemplateTokenVariable
  | ChainTemplateTokenStepOutput;

export interface StepOutputReference {
  stepId: string;
  property: string;
}

export interface ChainTemplateParseError {
  message: string;
  start: number;
  end: number;
  snippet: string;
}

export interface ChainTemplateParseResult {
  tokens: ChainTemplateToken[];
  variables: string[];
  stepOutputs: StepOutputReference[];
  errors: ChainTemplateParseError[];
  hasErrors: boolean;
}

const variablePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function createError(
  message: string,
  start: number,
  end: number,
  input: string
): ChainTemplateParseError {
  return {
    message,
    start,
    end,
    snippet: input.slice(start, Math.min(end, input.length))
  };
}

export function parseChainTemplate(template: string): ChainTemplateParseResult {
  const tokens: ChainTemplateToken[] = [];
  const variables = new Map<string, number>();
  const stepOutputs = new Map<string, StepOutputReference>();
  const errors: ChainTemplateParseError[] = [];

  let buffer = '';

  function flushBuffer() {
    if (buffer) {
      tokens.push({ type: 'text', value: buffer });
      buffer = '';
    }
  }

  let index = 0;

  while (index < template.length) {
    if (template.startsWith('{{', index)) {
      const start = index;
      const end = template.indexOf('}}', index + 2);

      if (end === -1) {
        errors.push(
          createError('Unclosed variable placeholder', start, template.length, template)
        );
        buffer += template.slice(start);
        break;
      }

      const raw = template.slice(index + 2, end).trim();

      if (!raw) {
        errors.push(createError('Empty variable placeholder', start, end + 2, template));
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      if (!variablePattern.test(raw)) {
        errors.push(
          createError(
            'Invalid variable name; expected letters, numbers, underscores or hyphens',
            start,
            end + 2,
            template
          )
        );
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      flushBuffer();
      tokens.push({ type: 'variable', name: raw });
      if (!variables.has(raw)) {
        variables.set(raw, tokens.length - 1);
      }

      index = end + 2;
      continue;
    }

    if (template.startsWith('[[', index)) {
      const start = index;
      const end = template.indexOf(']]', index + 2);

      if (end === -1) {
        errors.push(
          createError('Unclosed step output reference', start, template.length, template)
        );
        buffer += template.slice(start);
        break;
      }

      const raw = template.slice(index + 2, end).trim();
      const [stepPart, propertyPart, ...rest] = raw.split('.');

      if (!raw || rest.length > 0) {
        errors.push(
          createError('Invalid step output reference syntax', start, end + 2, template)
        );
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      if (!stepPart || !propertyPart) {
        errors.push(
          createError('Step output reference must include step and property', start, end + 2, template)
        );
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      const stepId = stepPart.trim();
      const property = propertyPart.trim();

      if (!identifierPattern.test(stepId)) {
        errors.push(
          createError('Invalid step identifier', start, end + 2, template)
        );
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      if (!identifierPattern.test(property)) {
        errors.push(createError('Invalid step property', start, end + 2, template));
        buffer += template.slice(start, end + 2);
        index = end + 2;
        continue;
      }

      flushBuffer();
      tokens.push({ type: 'stepOutput', stepId, property });

      const key = `${stepId}.${property}`;
      if (!stepOutputs.has(key)) {
        stepOutputs.set(key, { stepId, property });
      }

      index = end + 2;
      continue;
    }

    buffer += template[index];
    index += 1;
  }

  flushBuffer();

  return {
    tokens,
    variables: [...variables.keys()],
    stepOutputs: [...stepOutputs.values()],
    errors,
    hasErrors: errors.length > 0
  };
}

export interface RenderChainTemplateOptions {
  variables?: Record<string, string>;
  stepOutputs?: Record<string, Record<string, string>>;
  onMissingVariable?: (name: string) => string | undefined;
  onMissingStepOutput?: (reference: StepOutputReference) => string | undefined;
}

export function renderChainTemplate(
  template: string | ChainTemplateParseResult,
  options: RenderChainTemplateOptions = {}
): string {
  const parsed = typeof template === 'string' ? parseChainTemplate(template) : template;

  if (parsed.hasErrors) {
    throw new Error('Cannot render chain template with parse errors');
  }

  const parts: string[] = [];
  const variableValues = options.variables ?? {};
  const stepOutputValues = options.stepOutputs ?? {};

  for (const token of parsed.tokens) {
    if (token.type === 'text') {
      parts.push(token.value);
      continue;
    }

    if (token.type === 'variable') {
      const resolved = variableValues[token.name];
      if (resolved !== undefined) {
        parts.push(resolved);
        continue;
      }

      const fallback = options.onMissingVariable?.(token.name);
      if (fallback !== undefined) {
        parts.push(fallback);
        continue;
      }

      throw new Error(`Missing value for variable "${token.name}"`);
    }

    const step = stepOutputValues[token.stepId];
    const resolved = step?.[token.property];

    if (resolved !== undefined) {
      parts.push(resolved);
      continue;
    }

    const fallback = options.onMissingStepOutput?.({ stepId: token.stepId, property: token.property });
    if (fallback !== undefined) {
      parts.push(fallback);
      continue;
    }

    throw new Error(
      `Missing output for step "${token.stepId}" property "${token.property}"`
    );
  }

  return parts.join('');
}
