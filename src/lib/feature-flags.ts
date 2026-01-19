import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define available feature flags
export type FeatureFlag = 'MULTI_AGENT_ARCH' | 'NEW_UI_V4' | 'REALTIME_SYNC' | 'SENTINEL_PRO_MODE';

interface FeatureFlagsState {
  flags: Record<FeatureFlag, boolean>;
  setFlag: (flag: FeatureFlag, value: boolean) => void;
  isEnabled: (flag: FeatureFlag) => boolean;
  reset: () => void;
}

// Default values for flags
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  MULTI_AGENT_ARCH: false, // Rollout slowly
  NEW_UI_V4: true, // Already active
  REALTIME_SYNC: false, // Experimental
  SENTINEL_PRO_MODE: false,
};

export const useFeatureFlags = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULT_FLAGS,
      setFlag: (flag, value) =>
        set(state => ({
          flags: { ...state.flags, [flag]: value },
        })),
      isEnabled: flag => get().flags[flag] ?? false,
      reset: () => set({ flags: DEFAULT_FLAGS }),
    }),
    {
      name: 'neuro-feature-flags',
    }
  )
);

// Helper for non-hook usage (e.g. utility functions)
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  const state = useFeatureFlags.getState();
  return state.isEnabled(flag);
};
