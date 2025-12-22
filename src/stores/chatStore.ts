// ============================================
// NeuroGUARDIAN — Chat Store
// Persists chat messages across page navigation
// ============================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string for serialization
  isLoading?: boolean;
  actionRequired?: {
    type: 'confirmation';
    operation: string;
    details: Record<string, unknown>;
    confirmationMessage: string;
  };
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsUsed?: string[];
  };
}

interface ChatState {
  messages: ChatMessage[];
  isProcessing: boolean;

  // Actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  removeLoadingMessages: () => void;
  setProcessing: (processing: boolean) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    set => ({
      messages: [],
      isProcessing: false,

      addMessage: message =>
        set(state => ({
          messages: [...state.messages, message],
        })),

      updateMessage: (id, updates) =>
        set(state => ({
          messages: state.messages.map(m => (m.id === id ? { ...m, ...updates } : m)),
        })),

      removeMessage: id =>
        set(state => ({
          messages: state.messages.filter(m => m.id !== id),
        })),

      removeLoadingMessages: () =>
        set(state => ({
          messages: state.messages.filter(m => !m.isLoading),
        })),

      setProcessing: processing => set({ isProcessing: processing }),

      clearMessages: () => set({ messages: [] }),

      setMessages: messages => set({ messages }),
    }),
    {
      name: 'neuroagent-chat', // localStorage key
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage so it persists during session
      partialize: state => ({
        messages: state.messages.filter(m => !m.isLoading), // Don't persist loading messages
      }),
    }
  )
);

// Selector for non-loading messages
export const selectChatHistory = (state: ChatState) =>
  state.messages.filter(m => m.role !== 'system' && !m.isLoading);
