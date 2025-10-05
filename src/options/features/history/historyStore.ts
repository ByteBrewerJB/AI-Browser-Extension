import { create } from 'zustand';

import type { ConversationTableConfig, ConversationTablePreset } from '@/core/models';
import { archiveConversations, createFolder, deleteConversations, deleteFolder, toggleFavoriteFolder, togglePinned } from '@/core/storage';
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
  toggleConversationFolderFavorite: (id: string) => Promise<void>;
  togglePin: (conversationId: string) => Promise<void>;
  selectedConversationIds: string[];
  toggleSelection: (conversationId: string) => void;
  setSelectedConversationIds: (ids: string[]) => void;
  clearSelection: () => void;
  archiveSelected: (archived: boolean) => Promise<void>;
  deleteSelected: () => Promise<void>;
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
  selectedConversationIds: [],
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
  toggleConversationFolderFavorite: async (id: string) => {
    try {
      await toggleFavoriteFolder(id);
    } catch (error) {
      console.error('[historyStore] failed to toggle folder favorite', error);
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
  },
  toggleSelection: (conversationId: string) =>
    set((state) => {
      const exists = state.selectedConversationIds.includes(conversationId);
      const next = exists
        ? state.selectedConversationIds.filter((id) => id !== conversationId)
        : [...state.selectedConversationIds, conversationId];
      return { selectedConversationIds: next };
    }),
  setSelectedConversationIds: (ids: string[]) => set({ selectedConversationIds: Array.from(new Set(ids)) }),
  clearSelection: () => set({ selectedConversationIds: [] }),
  archiveSelected: async (archived: boolean) => {
    const ids = get().selectedConversationIds;
    if (ids.length === 0) {
      return;
    }
    try {
      await archiveConversations(ids, archived);
      set({ selectedConversationIds: [] });
    } catch (error) {
      console.error('[historyStore] failed to archive conversations', error);
      throw error;
    }
  },
  deleteSelected: async () => {
    const ids = get().selectedConversationIds;
    if (ids.length === 0) {
      return;
    }
    try {
      await deleteConversations(ids);
      set({ selectedConversationIds: [] });
    } catch (error) {
      console.error('[historyStore] failed to delete conversations', error);
      throw error;
    }
  }
}));



