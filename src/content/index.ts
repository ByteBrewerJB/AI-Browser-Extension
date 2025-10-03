export {};

const COUNTER_ID = 'ai-companion-word-counter';

function ensureCounter(): HTMLElement {
  let counter = document.getElementById(COUNTER_ID);
  if (!counter) {
    counter = document.createElement('div');
    counter.id = COUNTER_ID;
    counter.style.position = 'fixed';
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

function updateCounter(text: string) {
  const normalized = text.trim();
  const words = normalized ? normalized.split(/\s+/).length : 0;
  const characters = normalized.length;
  const counter = ensureCounter();
  counter.textContent = `Words: ${words} | Characters: ${characters}`;
}

function startInputListeners() {
  document.addEventListener('input', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.tagName === 'TEXTAREA') {
      updateCounter((target as HTMLTextAreaElement).value);
      return;
    }

    if (target.getAttribute('contenteditable') === 'true') {
      updateCounter(target.textContent ?? '');
    }
  });
}

function handleRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'bookmark-chat') {
      console.debug('[ai-companion] bookmark-chat triggered');
      sendResponse({ type: 'bookmark:queued' });
      return true;
    }

    if (message.type === 'download-audio') {
      console.debug('[ai-companion] download audio requested');
      sendResponse({ type: 'audio:pending' });
      return true;
    }

    return undefined;
  });
}

function init() {
  ensureCounter();
  startInputListeners();
  handleRuntimeMessages();
  chrome.runtime.sendMessage({ type: 'ping' }).catch(() => undefined);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
