import { create } from 'zustand';

import {
  createFolder,
  deleteFolder,
  createGpt,
  deleteGpt,
  updateGpt,
  createPrompt,
  deletePrompt,
  updatePrompt,
  createPromptChain,
  deletePromptChain,
  updatePromptChain
} from '@/core/storage';
import type { PromptChainRecord } from '@/core/models';

export interface EditingGptState {
  id: string;
  name: string;
  description: string;
  folderId: string;
}

export interface EditingPromptState {
  id: string;
  name: string;
  description: string;
  content: string;
  folderId: string;
  gptId: string;
}

export interface EditingPromptChainState {
  id: string;
  name: string;
  nodeIds: string[];
}

interface PromptsState {
  gptName: string;
  gptDescription: string;
  gptFolderId: string;
  gptFolderName: string;
  editingGpt: EditingGptState | null;
  promptName: string;
  promptDescription: string;
  promptContent: string;
  promptFolderId: string;
  promptGptId: string;
  promptFolderName: string;
  editingPrompt: EditingPromptState | null;
  promptChainName: string;
  promptChainNodeIds: string[];
  editingPromptChain: EditingPromptChainState | null;
  setGptName: (value: string) => void;
  setGptDescription: (value: string) => void;
  setGptFolderId: (value: string) => void;
  setGptFolderName: (value: string) => void;
  setEditingGpt: (editing: EditingGptState | null) => void;
  updateEditingGpt: (updater: (editing: EditingGptState) => EditingGptState) => void;
  createGpt: () => Promise<void>;
  saveEditingGpt: () => Promise<void>;
  removeGpt: (id: string) => Promise<void>;
  createGptFolder: () => Promise<void>;
  deleteGptFolder: (id: string) => Promise<void>;
  setPromptName: (value: string) => void;
  setPromptDescription: (value: string) => void;
  setPromptContent: (value: string) => void;
  setPromptFolderId: (value: string) => void;
  setPromptGptId: (value: string) => void;
  setPromptFolderName: (value: string) => void;
  setEditingPrompt: (editing: EditingPromptState | null) => void;
  updateEditingPrompt: (updater: (editing: EditingPromptState) => EditingPromptState) => void;
  createPrompt: () => Promise<void>;
  saveEditingPrompt: () => Promise<void>;
  removePrompt: (id: string) => Promise<void>;
  createPromptFolder: () => Promise<void>;
  deletePromptFolder: (id: string) => Promise<void>;
  setPromptChainName: (value: string) => void;
  addPromptToChain: (promptId: string) => void;
  removePromptFromChain: (promptId: string) => void;
  movePromptInChain: (promptId: string, direction: 'up' | 'down') => void;
  loadPromptChain: (chain: PromptChainRecord) => void;
  resetPromptChainForm: () => void;
  savePromptChain: () => Promise<void>;
  removePromptChain: (id: string) => Promise<void>;
}

export const usePromptsStore = create<PromptsState>((set, get) => ({
  gptName: '',
  gptDescription: '',
  gptFolderId: '',
  gptFolderName: '',
  editingGpt: null,
  promptName: '',
  promptDescription: '',
  promptContent: '',
  promptFolderId: '',
  promptGptId: '',
  promptFolderName: '',
  editingPrompt: null,
  promptChainName: '',
  promptChainNodeIds: [],
  editingPromptChain: null,
  setGptName: (value) => set({ gptName: value }),
  setGptDescription: (value) => set({ gptDescription: value }),
  setGptFolderId: (value) => set({ gptFolderId: value }),
  setGptFolderName: (value) => set({ gptFolderName: value }),
  setEditingGpt: (editing) => set({ editingGpt: editing }),
  updateEditingGpt: (updater) =>
    set((state) => (state.editingGpt ? { editingGpt: updater(state.editingGpt) } : state)),
  createGpt: async () => {
    const { gptName, gptDescription, gptFolderId } = get();
    if (!gptName.trim()) {
      return;
    }
    try {
      await createGpt({
        name: gptName,
        description: gptDescription,
        folderId: gptFolderId || undefined
      });
      set({ gptName: '', gptDescription: '', gptFolderId: '' });
    } catch (error) {
      console.error('[promptsStore] failed to create GPT', error);
      throw error;
    }
  },
  saveEditingGpt: async () => {
    const editing = get().editingGpt;
    if (!editing) {
      return;
    }
    try {
      await updateGpt({
        id: editing.id,
        name: editing.name,
        description: editing.description,
        folderId: editing.folderId || null
      });
      set({ editingGpt: null });
    } catch (error) {
      console.error('[promptsStore] failed to update GPT', error);
      throw error;
    }
  },
  removeGpt: async (id: string) => {
    try {
      await deleteGpt(id);
      const { editingGpt } = get();
      if (editingGpt?.id === id) {
        set({ editingGpt: null });
      }
    } catch (error) {
      console.error('[promptsStore] failed to delete GPT', error);
      throw error;
    }
  },
  createGptFolder: async () => {
    const { gptFolderName } = get();
    const trimmed = gptFolderName.trim();
    if (!trimmed) {
      return;
    }
    try {
      await createFolder({
        name: trimmed,
        kind: 'gpt'
      });
      set({ gptFolderName: '' });
    } catch (error) {
      console.error('[promptsStore] failed to create GPT folder', error);
      throw error;
    }
  },
  deleteGptFolder: async (id: string) => {
    try {
      await deleteFolder(id);
    } catch (error) {
      console.error('[promptsStore] failed to delete GPT folder', error);
      throw error;
    }
  },
  setPromptName: (value) => set({ promptName: value }),
  setPromptDescription: (value) => set({ promptDescription: value }),
  setPromptContent: (value) => set({ promptContent: value }),
  setPromptFolderId: (value) => set({ promptFolderId: value }),
  setPromptGptId: (value) => set({ promptGptId: value }),
  setPromptFolderName: (value) => set({ promptFolderName: value }),
  setEditingPrompt: (editing) => set({ editingPrompt: editing }),
  updateEditingPrompt: (updater) =>
    set((state) => (state.editingPrompt ? { editingPrompt: updater(state.editingPrompt) } : state)),
  createPrompt: async () => {
    const { promptName, promptDescription, promptContent, promptFolderId, promptGptId } = get();
    if (!promptName.trim() || !promptContent.trim()) {
      return;
    }
    try {
      await createPrompt({
        name: promptName,
        description: promptDescription,
        content: promptContent,
        folderId: promptFolderId || undefined,
        gptId: promptGptId || undefined
      });
      set({ promptName: '', promptDescription: '', promptContent: '', promptFolderId: '', promptGptId: '' });
    } catch (error) {
      console.error('[promptsStore] failed to create prompt', error);
      throw error;
    }
  },
  saveEditingPrompt: async () => {
    const editing = get().editingPrompt;
    if (!editing) {
      return;
    }
    try {
      await updatePrompt({
        id: editing.id,
        name: editing.name,
        description: editing.description,
        content: editing.content,
        folderId: editing.folderId || null,
        gptId: editing.gptId || null
      });
      set({ editingPrompt: null });
    } catch (error) {
      console.error('[promptsStore] failed to update prompt', error);
      throw error;
    }
  },
  removePrompt: async (id: string) => {
    try {
      await deletePrompt(id);
      const { editingPrompt } = get();
      if (editingPrompt?.id === id) {
        set({ editingPrompt: null });
      }
    } catch (error) {
      console.error('[promptsStore] failed to delete prompt', error);
      throw error;
    }
  },
  createPromptFolder: async () => {
    const { promptFolderName } = get();
    const trimmed = promptFolderName.trim();
    if (!trimmed) {
      return;
    }
    try {
      await createFolder({
        name: trimmed,
        kind: 'prompt'
      });
      set({ promptFolderName: '' });
    } catch (error) {
      console.error('[promptsStore] failed to create prompt folder', error);
      throw error;
    }
  },
  deletePromptFolder: async (id: string) => {
    try {
      await deleteFolder(id);
    } catch (error) {
      console.error('[promptsStore] failed to delete prompt folder', error);
      throw error;
    }
  },
  setPromptChainName: (value) => set({ promptChainName: value }),
  addPromptToChain: (promptId) =>
    set((state) =>
      state.promptChainNodeIds.includes(promptId)
        ? state
        : { promptChainNodeIds: [...state.promptChainNodeIds, promptId] }
    ),
  removePromptFromChain: (promptId) =>
    set((state) => ({ promptChainNodeIds: state.promptChainNodeIds.filter((id) => id !== promptId) })),
  movePromptInChain: (promptId, direction) =>
    set((state) => {
      const index = state.promptChainNodeIds.indexOf(promptId);
      if (index === -1) {
        return state;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.promptChainNodeIds.length) {
        return state;
      }
      const next = [...state.promptChainNodeIds];
      next.splice(index, 1);
      next.splice(targetIndex, 0, promptId);
      return { promptChainNodeIds: next };
    }),
  loadPromptChain: (chain) =>
    set({
      editingPromptChain: { id: chain.id, name: chain.name, nodeIds: [...chain.nodeIds] },
      promptChainName: chain.name,
      promptChainNodeIds: [...chain.nodeIds]
    }),
  resetPromptChainForm: () =>
    set({ editingPromptChain: null, promptChainName: '', promptChainNodeIds: [] }),
  savePromptChain: async () => {
    const { editingPromptChain, promptChainName, promptChainNodeIds } = get();
    if (!promptChainName.trim()) {
      return;
    }
    try {
      if (editingPromptChain) {
        await updatePromptChain({
          id: editingPromptChain.id,
          name: promptChainName,
          nodeIds: promptChainNodeIds
        });
      } else {
        await createPromptChain({
          name: promptChainName,
          nodeIds: promptChainNodeIds
        });
      }
      set({ editingPromptChain: null, promptChainName: '', promptChainNodeIds: [] });
    } catch (error) {
      console.error('[promptsStore] failed to save prompt chain', error);
      throw error;
    }
  },
  removePromptChain: async (id: string) => {
    try {
      await deletePromptChain(id);
      const { editingPromptChain } = get();
      if (editingPromptChain?.id === id) {
        set({ editingPromptChain: null, promptChainName: '', promptChainNodeIds: [] });
      }
    } catch (error) {
      console.error('[promptsStore] failed to delete prompt chain', error);
      throw error;
    }
  }
}));
