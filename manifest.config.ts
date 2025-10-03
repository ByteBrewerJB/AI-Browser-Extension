import { defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'AI ChatGPT Companion',
  description: 'Enhance ChatGPT with audio tools, rich chat archives, and productivity workflows.',
  version: '0.1.0',
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'assets/icons/icon16.png',
      '32': 'assets/icons/icon32.png'
    }
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  icons: {
    '16': 'assets/icons/icon16.png',
    '32': 'assets/icons/icon32.png',
    '48': 'assets/icons/icon48.png',
    '128': 'assets/icons/icon128.png'
  },
  permissions: [
    'storage',
    'tabs',
    'scripting',
    'downloads',
    'contextMenus'
  ],
  host_permissions: ['https://chat.openai.com/*'],
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['https://chat.openai.com/*']
    }
  ],
  content_scripts: [
    {
      matches: ['https://chat.openai.com/*'],
      js: ['src/content/index.ts']
    }
  ]
});

export default manifest;
