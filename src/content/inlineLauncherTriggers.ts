export type InlineLauncherTarget = 'prompts' | 'chains';

interface InlineTriggerConfig {
  pattern: string;
  target: InlineLauncherTarget;
}

const INLINE_TRIGGER_CONFIGS: readonly InlineTriggerConfig[] = [
  { pattern: '//', target: 'prompts' },
  { pattern: '..', target: 'chains' }
] as const;

export interface InlineTriggerMatch {
  target: InlineLauncherTarget;
  start: number;
  end: number;
  query: string;
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

export function findInlineTrigger(text: string, caretIndex: number): InlineTriggerMatch | null {
  if (caretIndex < 0) {
    return null;
  }

  const boundedCaret = Math.min(Math.max(caretIndex, 0), text.length);
  const prefix = text.slice(0, boundedCaret);

  for (const config of INLINE_TRIGGER_CONFIGS) {
    const triggerIndex = prefix.lastIndexOf(config.pattern);
    if (triggerIndex === -1) {
      continue;
    }

    const beforeIndex = triggerIndex - 1;
    if (beforeIndex >= 0 && !isWhitespace(prefix[beforeIndex] ?? '')) {
      continue;
    }

    const query = prefix.slice(triggerIndex + config.pattern.length);
    if (query.includes('\n')) {
      continue;
    }

    return {
      target: config.target,
      start: triggerIndex,
      end: boundedCaret,
      query: query.trim()
    } satisfies InlineTriggerMatch;
  }

  return null;
}

