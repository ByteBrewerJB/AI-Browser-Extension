export function createBookmarkPreview(source: string | null | undefined, maxLength = 200): string | undefined {
  if (typeof source !== 'string') {
    return undefined;
  }

  const normalized = source.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}
