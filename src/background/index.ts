chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ai-companion-save-audio',
    title: 'Save audio from ChatGPT reply',
    contexts: ['page'],
    documentUrlPatterns: ['https://chat.openai.com/*']
  });

  chrome.contextMenus.create({
    id: 'ai-companion-bookmark-chat',
    title: 'Bookmark this ChatGPT conversation',
    contexts: ['page'],
    documentUrlPatterns: ['https://chat.openai.com/*']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    return;
  }

  if (info.menuItemId === 'ai-companion-bookmark-chat') {
    chrome.tabs.sendMessage(tab.id, { type: 'bookmark-chat' }).catch(() => undefined);
  }

  if (info.menuItemId === 'ai-companion-save-audio') {
    chrome.tabs.sendMessage(tab.id, { type: 'download-audio' }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') {
    sendResponse({ type: 'pong' });
  }
});
