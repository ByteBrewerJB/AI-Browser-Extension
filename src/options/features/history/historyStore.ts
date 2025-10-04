import { create } from 'zustand';

import type { ConversationTableConfig, ConversationTablePreset } from '@/core/models';
import { createFolder, deleteFolder, togglePinned } from '@/core/storage';
import { createConversationTablePreset, deleteConversationTablePreset } from '@/core/storage/settings';

interface HistoryState {
  conversationConfig: ConversationTableConfig;
  presetName: string;
  conversationFolderName: string;
  updateConversationConfig: (partial: Partial<ConversationTableConfig>) => void;
  setPresetName: (value: string) => void;
  setConversationFolderName: (value: string) => void;
  applyPreset: (preset: ConversationTablePreset) => void;
  savePreset: () => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  createConversationFolder: () => Promise<void>;
  deleteConversationFolder: (id: string) => Promise<void>;
  togglePin: (conversationId: string) => Promise<void>;
}

const initialConfig: ConversationTableConfig = {
  folderId: 'all',
  pinned: 'all',
  archived: 'active',
  sortField: 'updatedAt',
  sortDirection: 'desc'
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  conversationConfig: initialConfig,
  presetName: '',
  conversationFolderName: '',
  updateConversationConfig: (partial) =>
    set((state) => ({ conversationConfig: { ...state.conversationConfig, ...partial } })),
  setPresetName: (value) => set({ presetName: value }),
  setConversationFolderName: (value) => set({ conversationFolderName: value }),
  applyPreset: (preset) => set({ conversationConfig: { ...preset.config } }),
  savePreset: async () => {
    const { presetName, conversationConfig } = get();
    const trimmed = presetName.trim();
    if (!trimmed) {
      return;
    }
    try {
      await createConversationTablePreset({
        name: trimmed,
        config: conversationConfig
      });
      set({ presetName: '' });
    } catch (error) {
      console.error('[historyStore] failed to save preset', error);
      throw error;
    }
  },
  deletePreset: async (id: string) => {
    try {
      await deleteConversationTablePreset(id);
    } catch (error) {
      console.error('[historyStore] failed to delete preset', error);
      throw error;
    }
  },
  createConversationFolder: async () => {
    const { conversationFolderName } = get();
    const trimmed = conversationFolderName.trim();
    if (!trimmed) {
      return;
    }
    try {
      await createFolder({
        name: trimmed,
        kind: 'conversation'
      });
      set({ conversationFolderName: '' });
    } catch (error) {
      console.error('[historyStore] failed to create folder', error);
      throw error;
    }
  },
  deleteConversationFolder: async (id: string) => {
    try {
      await deleteFolder(id);
    } catch (error) {
      console.error('[historyStore] failed to delete folder', error);
      throw error;
    }
  },
  togglePin: async (conversationId: string) => {
    try {
      await togglePinned(conversationId);
    } catch (error) {
      console.error('[historyStore] failed to toggle pin', error);
      throw error;
    }
  }
}));
