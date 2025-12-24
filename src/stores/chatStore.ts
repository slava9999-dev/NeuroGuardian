// ============================================
// NeuroGUARDIAN — Chat Store
// Persists chat messages across page navigation and server sync
// ============================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { agentApi } from '../lib/agentApi';

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

// Simplified message for API storage
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  isProcessing: boolean;
  isSynced: boolean;

  // Actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  removeLoadingMessages: () => void;
  setProcessing: (processing: boolean) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;

  // Server sync
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

// Debounce helper for saving
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (messages: ChatMessage[]) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    // Filter out loading messages and system messages for storage
    const cleanMessages: StoredMessage[] = messages
      .filter(m => !m.isLoading && m.role !== 'system')
      .map(({ id, role, content, timestamp }) => ({
        id,
        role: role as 'user' | 'assistant',
        content,
        timestamp,
      }));
    await agentApi.saveHistory(cleanMessages);
  }, 2000); // Save after 2 seconds of inactivity
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isProcessing: false,
      isSynced: false,

      addMessage: message => {
        set(state => ({
          messages: [...state.messages, message],
        }));
        // Debounced save to server
        debouncedSave(get().messages);
      },

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

      clearMessages: () => {
        set({ messages: [] });
        // Clear on server too
        agentApi.clearHistory();
      },

      setMessages: messages => set({ messages }),

      // Load history from server
      loadFromServer: async () => {
        try {
          const serverMessages = await agentApi.loadHistory();
          const localMessages = get().messages;

          // If server has messages and local is empty, use server
          if (serverMessages.length > 0 && localMessages.length === 0) {
            const restoredMessages: ChatMessage[] = serverMessages.map(m => ({
              id: m.id || `restored-${Date.now()}-${Math.random()}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: m.timestamp || new Date().toISOString(),
            }));
            set({ messages: restoredMessages, isSynced: true });
            console.log('📥 Chat history loaded from server:', serverMessages.length, 'messages');
          } else {
            set({ isSynced: true });
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
          set({ isSynced: true });
        }
      },

      // Manual save to server
      saveToServer: async () => {
        const messages = get().messages.filter(m => !m.isLoading && m.role !== 'system');
        const storedMessages: StoredMessage[] = messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
        }));
        await agentApi.saveHistory(storedMessages);
      },
    }),
    {
      name: 'neuroagent-chat', // localStorage key
      storage: createJSONStorage(() => localStorage), // Use localStorage for reliable persistence
      partialize: state => ({
        messages: state.messages.filter(m => !m.isLoading), // Don't persist loading messages
      }),
    }
  )
);

// Selector for non-loading messages
export const selectChatHistory = (state: ChatState) =>
  state.messages.filter(m => m.role !== 'system' && !m.isLoading);
