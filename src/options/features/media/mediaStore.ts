import { create } from 'zustand';

import type { MediaItemFilter } from '@/core/models';

interface MediaState {
  autoDownloadEnabled: boolean;
  advancedVoiceMode: boolean;
  selectedVoice: string;
  syncDraftsEnabled: boolean;
  previewOpen: boolean;
  modalOpen: boolean;
  mediaFilter: MediaItemFilter;
  setAutoDownloadEnabled: (value: boolean) => void;
  setAdvancedVoiceMode: (value: boolean) => void;
  setSelectedVoice: (voice: string) => void;
  setSyncDraftsEnabled: (value: boolean) => void;
  setPreviewOpen: (value: boolean) => void;
  setModalOpen: (value: boolean) => void;
  setMediaFilter: (filter: MediaItemFilter) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  autoDownloadEnabled: true,
  advancedVoiceMode: false,
  selectedVoice: 'alloy',
  syncDraftsEnabled: true,
  previewOpen: false,
  modalOpen: false,
  mediaFilter: 'all',
  setAutoDownloadEnabled: (value) => set({ autoDownloadEnabled: value }),
  setAdvancedVoiceMode: (value) => set({ advancedVoiceMode: value }),
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  setSyncDraftsEnabled: (value) => set({ syncDraftsEnabled: value }),
  setPreviewOpen: (value) => set({ previewOpen: value }),
  setModalOpen: (value) => set({ modalOpen: value }),
  setMediaFilter: (filter) => set({ mediaFilter: filter })
}));
