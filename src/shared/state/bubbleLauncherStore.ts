import { create } from 'zustand';

export type Bubble = 'history' | 'bookmarks' | 'prompts' | 'settings';

export interface BubbleLauncherState {
  activeBubble: Bubble | null;
  setActiveBubble: (bubble: Bubble | null) => void;
  toggleBubble: (bubble: Bubble) => void;
}

export const useBubbleLauncherStore = create<BubbleLauncherState>((set) => ({
  activeBubble: null,
  setActiveBubble: (bubble) => set({ activeBubble: bubble }),
  toggleBubble: (bubble) =>
    set((state) => ({
      activeBubble: state.activeBubble === bubble ? null : bubble,
    })),
}));