export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  pinned: boolean;
  wordCount: number;
  charCount: number;
  archived?: boolean;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  charCount: number;
  metadata?: Record<string, unknown>;
}

export interface GPTRecord {
  id: string;
  name: string;
  description?: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRecord {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
}

export interface PromptChainRecord {
  id: string;
  name: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  kind: 'conversation' | 'prompt' | 'gpt';
}

export interface BookmarkRecord {
  id: string;
  conversationId: string;
  messageId?: string | null;
  createdAt: string;
  note?: string;
}

export interface SettingsRecord {
  id: string;
  language: string;
  direction: 'ltr' | 'rtl';
  autoSync: boolean;
  enableVoicePlayback: boolean;
  updatedAt: string;
}


