import { createAuthManager } from './auth';
import { createExportJobHandler } from './jobs/exportHandler';
import { createJobScheduler } from './jobs/scheduler';
import { initializeMessaging } from './messaging';
import { sendTabMessage } from '@/shared/messaging/router';

const authManager = createAuthManager();
const jobScheduler = createJobScheduler({
  onError(job, error) {
    console.error('[ai-companion] job failed', job.id, error);
  }
});

authManager.initialize().catch((error) => {
  console.warn('[ai-companion] failed to initialize auth manager', error);
});

jobScheduler.registerHandler('export', createExportJobHandler());

jobScheduler.start();

initializeMessaging({ auth: authManager, scheduler: jobScheduler });

function setupContextMenus() {
  chrome.contextMenus.create({
    id: 'ai-companion-save-audio',
    title: 'Save audio from ChatGPT reply',
    contexts: ['page'],
    documentUrlPatterns: ['https://chat.openai.com/*', 'https://chatgpt.com/*']
  });

  chrome.contextMenus.create({
    id: 'ai-companion-bookmark-chat',
    title: 'Bookmark this ChatGPT conversation',
    contexts: ['page'],
    documentUrlPatterns: ['https://chat.openai.com/*', 'https://chatgpt.com/*']
  });
}

function handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (!tab?.id) {
    return;
  }

  if (info.menuItemId === 'ai-companion-bookmark-chat') {
    sendTabMessage(tab.id, 'content/bookmark', {}).catch((error) => {
      console.error('[ai-companion] failed to send bookmark request', error);
    });
  }

  if (info.menuItemId === 'ai-companion-save-audio') {
    sendTabMessage(tab.id, 'content/audio-download', {}).catch((error) => {
      console.error('[ai-companion] failed to send audio request', error);
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});
