import { addMessages, db, upsertConversation } from '@/core/storage';
import type { MessageRecord } from '@/core/models';
import type { RuntimeMessageMap } from '@/shared/messaging/contracts';
import { createRuntimeMessageRouter, sendRuntimeMessage } from '@/shared/messaging/router';
import { initializeSettingsStore } from '@/shared/state/settingsStore';
import { collectMessageElements, getConversationId, getConversationTitle } from './chatDom';
import { mountPromptLauncher } from './textareaPrompts';

void initializeSettingsStore();


    counter.style.bottom = '16px';
    counter.style.right = '16px';
    counter.style.padding = '8px 12px';
    counter.style.borderRadius = '999px';
    counter.style.background = 'rgba(15, 23, 42, 0.9)';
    counter.style.color = '#f8fafc';
    counter.style.fontSize = '12px';
    counter.style.fontFamily = 'Inter, system-ui';
    counter.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.35)';
    counter.style.zIndex = '2147483647';
    counter.style.pointerEvents = 'none';
    counter.textContent = 'Words: 0 | Characters: 0';
    document.body.appendChild(counter);
  }
  return counter;
}

function setCounter(words: number, chars: number, label = 'Words') {
  const counter = ensureCounter();
  counter.textContent = `${label}: ${words} | Characters: ${chars}`;
}

function getConversationId(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/(c|chat)\/(\w[\w-]+)/i);
  if (match?.[2]) {
    return match[2];
  }
  if (path === '/' || path === '') {
    // No conversation selected yet
    return null;
  }
  return `local-${path}`;
}

function getConversationTitle(): string {
  const title = document.querySelector('h1')?.textContent?.trim();
  if (title) return title;
  if (document.title) return document.title.replace(' - ChatGPT', '').trim();
  return 'ChatGPT conversation';
}

function extractMessage(element: Element): MessageRecord | null {
  const role = element.getAttribute('data-message-author-role') as MessageRecord['role'] | null;
  if (!role) {
    return null;
  }

  const id = element.getAttribute('data-message-id') ?? crypto.randomUUID();
  if (processedMessageIds.has(id)) {
    return null;
  }

  const content = element.textContent?.trim() ?? '';
  if (!content) {
    return null;
  }

  const timestamp = element.getAttribute('data-message-timestamp') ?? new Date().toISOString();
  processedMessageIds.add(id);

  return {
    id,
    conversationId: currentConversationId!,
    role,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
    wordCount: 0,
    charCount: 0
  };
}

function collectMessageElements(): Element[] {
  const selector = '[data-message-author-role]';
  return Array.from(document.querySelectorAll(selector));
}

async function scanConversation() {
  if (!currentConversationId) {
    return;
  }

  await upsertConversation({
    id: currentConversationId,
    title: getConversationTitle()
  });

  const elements = collectMessageElements();
  const messages = elements
    .map((element) => extractMessage(element))
    .filter((message): message is MessageRecord => Boolean(message));

  if (messages.length === 0) {
    await refreshConversationMetrics();
    return;
  }

  await addMessages(
    messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    }))
  );

  await refreshConversationMetrics();
}

async function refreshConversationMetrics() {
  if (!currentConversationId) return;
  const conversation = await db.conversations.get(currentConversationId);
  if (conversation) {
    setCounter(conversation.wordCount, conversation.charCount, 'Conversation');
  }
}

function scheduleScan() {
  if (scanTimeout !== null) {
    return;
  }
  scanTimeout = window.setTimeout(() => {
    scanTimeout = null;
    scanConversation().catch((error) => console.error('[ai-companion] failed to scan conversation', error));
  }, 250);
}

function handleMutations() {
  scheduleScan();
}

function setupObserver() {
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { childList: true, subtree: true });
}

function resetStateForConversation(newConversationId: string | null) {
  if (newConversationId === currentConversationId) {
    return;
  }
  currentConversationId = newConversationId;
  processedMessageIds.clear();
  if (!newConversationId) {
    setCounter(0, 0);
  }
}

function observeLocationChanges() {
  let previousPath = window.location.pathname;
  const check = () => {
    const path = window.location.pathname;
    if (path !== previousPath) {
      previousPath = path;
      resetStateForConversation(getConversationId());
      scheduleScan();
    }
  };
  setInterval(check, 500);
}

function startInputListeners() {
  document.addEventListener('input', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.tagName === 'TEXTAREA') {
      const value = (target as HTMLTextAreaElement).value;
      setCounter(value.trim().split(/\s+/).filter(Boolean).length, value.trim().length, 'Draft');
      return;
    }

    if (target.getAttribute('contenteditable') === 'true') {
      const text = target.textContent ?? '';
      const trimmed = text.trim();
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      setCounter(words, trimmed.length, 'Draft');
    }
  });
}

function registerMessageHandlers() {
  messageRouter.register('content/bookmark', async () => {
    console.debug('[ai-companion] bookmark-chat triggered');
    return { status: 'queued' } as const;
  });

  messageRouter.register('content/audio-download', async () => {
    console.debug('[ai-companion] download audio requested');
    return { status: 'pending' } as const;
  });

  messageRouter.attach();
}

async function init() {
  ensureCounter();
  startInputListeners();
  registerMessageHandlers();
  void mountPromptLauncher();
  setupObserver();
  observeLocationChanges();
  resetStateForConversation(getConversationId());
  await scanConversation();
  sendRuntimeMessage('runtime/ping', { surface: 'content' }).catch((error) =>
    console.error('[ai-companion] failed to send message', error)
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error('[ai-companion] init failed', error));
  });
} else {
  init().catch((error) => console.error('[ai-companion] init failed', error));
}






