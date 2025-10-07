import { createAuthManager } from './auth';
import { createExportJobHandler } from './jobs/exportHandler';
import { createSyncEncryptionService } from './crypto/syncEncryption';
import { createEventLoggerJobHandler } from './jobs/eventLogger';
import { createJobScheduler } from './jobs/scheduler';
import { initializeMessaging } from './messaging';
import { createEncryptionStatusNotifier } from './monitoring/encryptionNotifier';
import { createNetworkMonitor } from './monitoring/networkMonitor';
import { sendTabMessage } from '@/shared/messaging/router';

const authManager = createAuthManager();
const jobScheduler = createJobScheduler({
  onError(job, error) {
    console.error('[ai-companion] job failed', job.id, error);
  }
});
const syncEncryption = createSyncEncryptionService();
const networkMonitor = createNetworkMonitor({
  allowedHosts: ['chat.openai.com', 'chatgpt.com'],
  onIncident(incident) {
    console.warn('[ai-companion] network monitor detected incident', incident);
  }
});

networkMonitor.install();

createEncryptionStatusNotifier(syncEncryption, {
  onChange(change) {
    console.info('[ai-companion] sync encryption status changed', change.reason, change.status);
  }
});

authManager.initialize().catch((error) => {
  console.warn('[ai-companion] failed to initialize auth manager', error);
});

jobScheduler.registerHandler('export', createExportJobHandler());
jobScheduler.registerHandler('event', createEventLoggerJobHandler());

jobScheduler.start();

initializeMessaging({ auth: authManager, scheduler: jobScheduler, encryption: syncEncryption, monitor: networkMonitor });

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
