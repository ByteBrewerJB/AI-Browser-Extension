import { create } from 'zustand';

export type PromptChainRunStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled';

interface PromptChainsRuntimeState {
  activeChainId: string | null;
  status: PromptChainRunStatus;
  totalSteps: number;
  completedSteps: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface PromptChainsRuntimeActions {
  startRun: (chainId: string, totalSteps: number) => void;
  advanceRun: (completedSteps: number) => void;
  completeRun: (completedAt?: string) => void;
  failRun: (message: string) => void;
  cancelRun: () => void;
  reset: () => void;
}

export type PromptChainsStore = PromptChainsRuntimeState & PromptChainsRuntimeActions;

const initialState: PromptChainsRuntimeState = {
  activeChainId: null,
  status: 'idle',
  totalSteps: 0,
  completedSteps: 0,
  error: null,
  startedAt: null,
  completedAt: null
};

export const usePromptChainsStore = create<PromptChainsStore>((set) => ({
  ...initialState,
  startRun: (chainId, totalSteps) =>
    set({
      activeChainId: chainId,
      status: 'running',
      totalSteps: Math.max(0, totalSteps),
      completedSteps: 0,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    }),
  advanceRun: (completedSteps) =>
    set((state) => {
      if (state.status !== 'running') {
        return {};
      }
      const total = state.totalSteps > 0 ? state.totalSteps : completedSteps;
      const clamped = Math.min(Math.max(completedSteps, 0), total);
      return {
        completedSteps: clamped,
        totalSteps: total
      };
    }),
  completeRun: (completedAt) =>
    set((state) => {
      if (!state.activeChainId) {
        return {};
      }
      const timestamp = completedAt ?? new Date().toISOString();
      const total = state.totalSteps > 0 ? state.totalSteps : state.completedSteps;
      return {
        status: 'completed',
        completedSteps: total,
        completedAt: timestamp,
        error: null
      };
    }),
  failRun: (message) =>
    set((state) => ({
      status: 'error',
      error: message,
      completedAt: new Date().toISOString(),
      completedSteps: state.completedSteps
    })),
  cancelRun: () =>
    set((state) => {
      if (state.status !== 'running') {
        return {};
      }
      return {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        error: null
      };
    }),
  reset: () => set(initialState)
}));
