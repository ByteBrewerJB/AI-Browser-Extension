import { create } from 'zustand';

export type Bubble = 'history' | 'pinned' | 'prompts' | 'media';

export interface FolderShortcut {
  id: string;
  name: string;
  depth: number;
  favorite: boolean;
}

export interface FolderShortcut {
  id: string;
  name: string;
  depth: number;
  favorite: boolean;
}

export interface BubbleLauncherState {
  activeBubble: Bubble | null;
  conversationFolderShortcuts: FolderShortcut[];
  setActiveBubble: (bubble: Bubble | null) => void;
  setConversationFolderShortcuts: (shortcuts: FolderShortcut[]) => void;
  toggleBubble: (bubble: Bubble) => void;
}

export const useBubbleLauncherStore = create<BubbleLauncherState>((set) => ({
  activeBubble: null,
  conversationFolderShortcuts: [],
  setActiveBubble: (bubble) => set({ activeBubble: bubble }),
  setConversationFolderShortcuts: (shortcuts) => set({ conversationFolderShortcuts: shortcuts }),
  toggleBubble: (bubble) =>
    set((state) => ({
      activeBubble: state.activeBubble === bubble ? null : bubble,
    })),
}));