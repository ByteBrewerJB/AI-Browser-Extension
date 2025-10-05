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
  description?: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  gptId?: string;
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
  favorite?: boolean;
}

export interface BookmarkRecord {
  id: string;
  conversationId: string;
  messageId?: string | null;
  createdAt: string;
  note?: string;
  messagePreview?: string;
}

export type ConversationPinnedFilter = 'all' | 'pinned' | 'unpinned';

export type ConversationArchivedFilter = 'all' | 'archived' | 'active';

export type ConversationSortField = 'updatedAt' | 'title' | 'messageCount' | 'wordCount' | 'charCount';

export type ConversationSortDirection = 'asc' | 'desc';

export interface ConversationTableConfig {
  folderId: string | 'all';
  pinned: ConversationPinnedFilter;
  archived: ConversationArchivedFilter;
  sortField: ConversationSortField;
  sortDirection: ConversationSortDirection;
}

export interface ConversationTablePreset {
  id: string;
  name: string;
  config: ConversationTableConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  id: string;
  language?: string;
  direction?: 'ltr' | 'rtl';
  autoSync?: boolean;
  enableVoicePlayback?: boolean;
  conversationPresets?: ConversationTablePreset[];
  updatedAt: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  runAt: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxAttempts: number;
  lastRunAt?: string;
  lastError?: string;
  completedAt?: string;
}

export type JobSnapshot = Omit<JobRecord, 'payload'>;



