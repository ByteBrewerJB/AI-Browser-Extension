export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  folderId?: string;
  wordCount: number;
  charCount: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  provider: 'chatgpt' | 'custom';
  voiceId: string;
  language: string;
}

export interface SettingsSnapshot {
  language: string;
  direction: 'ltr' | 'rtl';
  autoSync: boolean;
  enableVoicePlayback: boolean;
}
