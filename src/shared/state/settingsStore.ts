import { create } from 'zustand';

type TextDirection = 'ltr' | 'rtl';

interface SettingsState {
  language: string;
  direction: TextDirection;
  setLanguage: (language: string) => void;
  toggleDirection: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  direction: 'ltr',
  setLanguage: (language) => set({ language }),
  toggleDirection: () =>
    set((state) => ({ direction: state.direction === 'ltr' ? 'rtl' : 'ltr' }))
}));
