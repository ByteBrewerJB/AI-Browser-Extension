export interface TextMetrics {
  wordCount: number;
  charCount: number;
}

const UNICODE_WORD_PATTERN = "\\p{L}+[\\p{L}\\p{Mn}\\p{Pd}\\']*";

function createWordRegex(): RegExp {
  try {
    return new RegExp(UNICODE_WORD_PATTERN, 'gu');
  } catch {
    // Fallback for environments without Unicode property escape support.
    return /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
  }
}

const WORD_REGEX = createWordRegex();

function countWords(text: string) {
  const matches = text.match(WORD_REGEX);
  return matches ? matches.length : 0;
}

export function computeTextMetrics(text: string): TextMetrics {
  const normalized = text.trim();
  if (!normalized) {
    return { wordCount: 0, charCount: 0 };
  }
  return {
    wordCount: countWords(normalized),
    charCount: normalized.length
  };
}

export function sumTextMetrics(metrics: TextMetrics[]): TextMetrics {
  return metrics.reduce(
    (acc, current) => ({
      wordCount: acc.wordCount + current.wordCount,
      charCount: acc.charCount + current.charCount
    }),
    { wordCount: 0, charCount: 0 }
  );
}
