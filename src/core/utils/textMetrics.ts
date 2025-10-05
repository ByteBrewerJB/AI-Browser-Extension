export interface TextMetrics {
  wordCount: number;
  charCount: number;
}

type WordCounter = (text: string) => number;
type SegmentLike = { isWordLike?: boolean };
type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
) => { segment(input: string): Iterable<SegmentLike> };

const FALLBACK_WORD_REGEX = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;

let cachedWordCounter: WordCounter | null = null;

function createSegmenterWordCounter(): WordCounter | null {
  if (typeof Intl === 'undefined') {
    return null;
  }

  try {
    const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterCtor }).Segmenter;
    if (typeof Segmenter !== 'function') {
      return null;
    }

    const segmenter = new Segmenter(undefined, { granularity: 'word' });
    return (text: string) => {
      let count = 0;
      for (const segment of segmenter.segment(text) as Iterable<SegmentLike>) {
        if (segment.isWordLike) {
          count += 1;
        }
      }
      return count;
    };
  } catch {
    return null;
  }
}

function createUnicodeRegexWordCounter(): WordCounter | null {
  try {
    const unicodeRegex = new RegExp("\\p{L}+[\\p{L}\\p{Mn}\\p{Pd}\\']*", 'gu');
    return (text: string) => {
      const matches = text.match(unicodeRegex);
      return matches ? matches.length : 0;
    };
  } catch {
    return null;
  }
}

function createFallbackWordCounter(): WordCounter {
  return (text: string) => {
    const matches = text.match(FALLBACK_WORD_REGEX);
    return matches ? matches.length : 0;
  };
}

function getWordCounter(): WordCounter {
  if (cachedWordCounter) {
    return cachedWordCounter;
  }

  cachedWordCounter =
    createSegmenterWordCounter() ??
    createUnicodeRegexWordCounter() ??
    createFallbackWordCounter();

  return cachedWordCounter;
}

function countWords(text: string) {
  return getWordCounter()(text);
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
