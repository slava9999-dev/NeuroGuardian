// ============================================
// NeuroGUARDIAN — Zustand Logs Store
// Event logs state management
// ============================================

import { create } from 'zustand';
import type { LogEntry } from '../types';

interface LogsState {
  // Data
  logs: LogEntry[];
  isLoading: boolean;
  
  // Computed
  unreadCount: number;
  
  // UI state
  isConsoleOpen: boolean;
  
  // Actions
  setLogs: (logs: LogEntry[]) => void;
  addLog: (log: LogEntry) => void;
  markAsRead: (logId: string) => void;
  markAllAsRead: () => void;
  clearLogs: () => void;
  
  // UI actions
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  
  // State actions
  setLoading: (loading: boolean) => void;
}

export const useLogsStore = create<LogsState>()((set) => ({
  // Initial state
  logs: [],
  isLoading: false,
  unreadCount: 0,
  isConsoleOpen: false,
  
  // Data actions
  setLogs: (logs) => {
    const unreadCount = logs.filter((l) => !l.isRead).length;
    set({ logs, unreadCount, isLoading: false });
  },
  
  addLog: (log) => set((state) => {
    const newLogs = [log, ...state.logs].slice(0, 100); // Keep last 100 logs
    const unreadCount = newLogs.filter((l) => !l.isRead).length;
    return { logs: newLogs, unreadCount };
  }),
  
  markAsRead: (logId) => set((state) => {
    const logs = state.logs.map((l) =>
      l.id === logId ? { ...l, isRead: true } : l
    );
    const unreadCount = logs.filter((l) => !l.isRead).length;
    return { logs, unreadCount };
  }),
  
  markAllAsRead: () => set((state) => ({
    logs: state.logs.map((l) => ({ ...l, isRead: true })),
    unreadCount: 0,
  })),
  
  clearLogs: () => set({ logs: [], unreadCount: 0 }),
  
  // UI actions
  toggleConsole: () => set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
  setConsoleOpen: (open) => set({ isConsoleOpen: open }),
  
  // State actions
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Helper to create a log entry
export function createLogEntry(
  type: LogEntry['type'],
  title: string,
  message: string,
  metadata: LogEntry['metadata'] = {}
): Omit<LogEntry, 'id' | 'userId' | 'createdAt'> {
  return {
    type,
    title,
    message,
    metadata,
    isRead: false,
  };
}
