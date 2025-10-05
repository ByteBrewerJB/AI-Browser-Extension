const CONVERSATION_ID_PATTERN = /\/(c|chat)\/([\w-]+)/i;

export function getConversationIdFromPath(path: string): string | null {
  const match = path.match(CONVERSATION_ID_PATTERN);
  if (match?.[2]) {
    return match[2];
  }

  if (path === '/' || path === '') {
    return null;
  }

  return `local-${path}`;
}

export function getConversationId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return getConversationIdFromPath(window.location.pathname);
}

export function getConversationTitle(): string {
  const heading = document.querySelector('h1');
  const title = heading?.textContent?.trim();
  if (title) {
    return title;
  }

  if (document.title) {
    return document.title.replace(' - ChatGPT', '').trim();
  }

  return 'ChatGPT conversation';
}

export function collectMessageElements(): HTMLElement[] {
  const selector = '[data-message-author-role]';
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}
