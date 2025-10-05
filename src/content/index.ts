import { addMessages, upsertConversation } from '@/core/storage';
import type { MessageRecord } from '@/core/models';
import type { RuntimeMessageMap } from '@/shared/messaging/contracts';
import { createRuntimeMessageRouter, sendRuntimeMessage } from '@/shared/messaging/router';
import { initializeSettingsStore } from '@/shared/state/settingsStore';
import { collectMessageElements, getConversationId, getConversationTitle } from './chatDom';
import { mountPromptLauncher } from './textareaPrompts';

void initializeSettingsStore();

const processedMessageIds = new Set<string>();
let scanTimeout: number | null = null;
let currentConversationId: string | null = null;

const messageRouter = createRuntimeMessageRouter<RuntimeMessageMap>();

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
