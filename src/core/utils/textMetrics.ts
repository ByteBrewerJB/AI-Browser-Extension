export interface TextMetrics {
  wordCount: number;
  charCount: number;
}

const WORD_REGEX = /\p{L}+[\p{L}\p{Mn}\p{Pd}\']*/gu;

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
