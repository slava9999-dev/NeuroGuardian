// ============================================
// NeuroGUARDIAN — Zustand App Store
// Global application state
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, DefenseMode } from '../types';

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Global protection toggle
  protectionEnabled: boolean;
  defenseMode: DefenseMode;

  // Subscription status
  subscriptionDaysLeft: number | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProtectionEnabled: (enabled: boolean) => Promise<void>;
  setDefenseMode: (mode: DefenseMode) => Promise<void>;
  updateSubscription: (active: boolean, expiresAt: Date | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      protectionEnabled: false,
      defenseMode: 'zero_stock',
      subscriptionDaysLeft: null,

      // Actions
      setUser: user => {
        if (user) {
          // Parse subscriptionExpiresAt as Date if it's a string
          let expiresAt: Date | null = null;
          if (user.subscriptionExpiresAt) {
            expiresAt =
              user.subscriptionExpiresAt instanceof Date
                ? user.subscriptionExpiresAt
                : new Date(user.subscriptionExpiresAt as unknown as string);
          }

          // Calculate days left
          const daysLeft = expiresAt
            ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : (user.subscriptionDaysLeft ?? null);

          console.log('🗂️ Store setUser:', {
            daysLeft,
            expiresAt,
            subscriptionActive: user.subscriptionActive,
          });

          set({
            user: {
              ...user,
              subscriptionExpiresAt: expiresAt,
            },
            isAuthenticated: true,
            protectionEnabled: user.protectionEnabled,
            defenseMode: user.defenseMode,
            subscriptionDaysLeft: daysLeft,
          });
        } else {
          set({
            user: null,
            isAuthenticated: false,
            protectionEnabled: false,
            subscriptionDaysLeft: null,
          });
        }
      },

      setLoading: loading => set({ isLoading: loading }),

      setError: error => set({ error }),

      setProtectionEnabled: async enabled => {
        set({ protectionEnabled: enabled });
        // Sync with server
        try {
          const tg = (window as any).Telegram?.WebApp;
          const initData = tg?.initData || '';
          if (initData) {
            await fetch('/api?action=settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'settings',
                initData,
                protectionEnabled: enabled,
              }),
            });
            console.log('✅ Protection status synced:', enabled);
          }
        } catch (error) {
          console.error('❌ Failed to sync protection status:', error);
        }
      },

      setDefenseMode: async mode => {
        set({ defenseMode: mode });
        // Sync with server
        try {
          const tg = (window as any).Telegram?.WebApp;
          const initData = tg?.initData || '';
          if (initData) {
            await fetch('/api?action=settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'settings',
                initData,
                defenseMode: mode,
              }),
            });
            console.log('✅ Defense mode synced:', mode);
          }
        } catch (error) {
          console.error('❌ Failed to sync defense mode:', error);
        }
      },

      updateSubscription: (active, expiresAt) => {
        const daysLeft = expiresAt
          ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        set(state => ({
          user: state.user
            ? { ...state.user, subscriptionActive: active, subscriptionExpiresAt: expiresAt }
            : null,
          subscriptionDaysLeft: daysLeft,
        }));
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          protectionEnabled: false,
          subscriptionDaysLeft: null,
        });
      },
    }),
    {
      name: 'neuroguardian-app',
      partialize: state => ({
        // Only persist these fields
        protectionEnabled: state.protectionEnabled,
        defenseMode: state.defenseMode,
      }),
    }
  )
);
