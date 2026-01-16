// ============================================
// NeuroAgent — Main Agent Page V4.0 (Premium)
// Aesthetic: Strategic Command Center | Jarvis-style UI
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useChatStore, type ChatMessage } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

import { Send, Mic, Paperclip, Zap, TrendingUp, Calculator } from 'lucide-react';
import DOMPurify from 'dompurify';

export function AgentPage() {
  const user = useAppStore(state => state.user);
  const messages = useChatStore(state => state.messages);
  const addMessage = useChatStore(state => state.addMessage);
  const removeLoadingMessages = useChatStore(state => state.removeLoadingMessages);
  const clearMessages = useChatStore(state => state.clearMessages);
  const isProcessing = useChatStore(state => state.isProcessing);
  const setProcessing = useChatStore(state => state.setProcessing);
  const loadFromServer = useChatStore(state => state.loadFromServer);
  const isSynced = useChatStore(state => state.isSynced);

  const [inputValue, setInputValue] = useState('');
  const [isListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.firstName || user?.username || 'Сэр';

  useEffect(() => {
    if (!isSynced) loadFromServer();
  }, [isSynced, loadFromServer]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    hapticFeedback('medium');
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    addMessage(userMessage);
    addMessage(loadingMessage);
    setInputValue('');
    setProcessing(true);

    try {
      const history: AgentMessage[] = messages
        .filter(m => m.role !== 'system' && !m.isLoading)
        .slice(-15)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response: AgentResponse = await agentApi.sendMessage(text.trim(), history);
      removeLoadingMessages();
      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        actionRequired: response.actionRequired,
        metadata: response.metadata,
      });
      if (response.showTutorial) {
        // Tutorial trigger logic here if needed
      }
      hapticFeedback('success');
    } catch (_) {
      removeLoadingMessages();
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '🚨 Системная ошибка связи. Перезагрузите интерфейс.',
        timestamp: new Date().toISOString(),
      });
      hapticFeedback('error');
    } finally {
      setProcessing(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-dvh bg-black flex flex-col relative overflow-hidden bg-cyber">
      {/* Background Glows */}
      <div className="bg-glow-spot top-[-10%] left-[-20%] opacity-40 scale-150" />

      {/* Welcome Screen */}
      <AnimatePresence>
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8"
          >
            {/* Victor Avatar Hero */}
            <motion.div
              className="relative mb-12 shadow-2xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <div className="neuro-loader absolute inset-0 opacity-40" />
              <div className="relative p-1 rounded-full border border-indigo-500/30">
                <img
                  src="/agent-avatar.png"
                  alt="Victor AI"
                  className="w-48 h-48 rounded-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700 shadow-2xl"
                />
                <motion.div
                  className="absolute bottom-4 right-4 w-6 h-6 rounded-full bg-lime-400 border-4 border-black shadow-[0_0_15px_#bef264]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </motion.div>

            <motion.div
              className="text-center space-y-4 mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-[10px] font-black tracking-[0.5em] text-indigo-500/60 uppercase">
                System Status: Active
              </h2>
              <h1 className="text-4xl font-black tracking-tighter italic">
                HELLO,{' '}
                <span className="text-indigo-500 underline decoration-indigo-500/30 underline-offset-8">
                  {firstName.toUpperCase()}
                </span>
              </h1>
              <p className="text-zinc-500 text-sm font-medium tracking-tight">
                Управляющий магазинами Виктор готов к работе. Чем займемся сегодня?
              </p>
            </motion.div>

            {/* Quick Actions Bento */}
            <motion.div
              className="grid grid-cols-2 gap-3 w-full max-w-sm"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <QuickActionButton
                icon={<Zap className="w-4 h-4" />}
                label="ЗАЩИТА"
                onClick={() => handleSendMessage('защити товары')}
              />
              <QuickActionButton
                icon={<TrendingUp className="w-4 h-4" />}
                label="ПРОДАЖИ"
                onClick={() => handleSendMessage('статистика продаж')}
              />
              <QuickActionButton
                icon={<Calculator className="w-4 h-4" />}
                label="ЮНИТ-ЭК."
                onClick={() => handleSendMessage('юнит-экономика')}
              />
              <QuickActionButton
                icon={<Zap className="w-4 h-4 text-lime-400" />}
                label="SMM GEN"
                onClick={() => handleSendMessage('создай пост')}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Header */}
      {hasMessages && (
        <header className="fixed top-0 left-0 right-0 z-50 nav-blur border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/agent-avatar.png"
              className="w-10 h-10 rounded-full border border-indigo-500/30 object-cover"
              alt="Victor"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-wider text-white">VICTOR AI</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase">
                  {isProcessing ? 'Processing Data...' : 'Strategic Mode'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              hapticFeedback('medium');
              clearMessages();
            }}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-black text-zinc-400 hover:text-white transition-all uppercase tracking-widest"
          >
            New Briefing
          </button>
        </header>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-5 py-24 space-y-8 scroll-smooth no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.isLoading ? <LoadingDots /> : <MessageUI message={m} />}
          </div>
        ))}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Tech Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/95 to-transparent z-50 safe-area-inset-bottom">
        <div className="max-w-xl mx-auto flex items-end gap-3 glass-panel p-2 border-white/5 rounded-2xl shadow-2xl">
          <button
            className="p-3 text-zinc-500 hover:text-white transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={isListening ? 'SENSING VOICE...' : 'Command Victor...'}
            className="flex-1 bg-transparent text-white px-2 py-3 text-sm focus:outline-none resize-none max-h-32 min-h-[48px] font-medium placeholder:text-zinc-700"
            onKeyDown={e =>
              e.key === 'Enter' &&
              !e.shiftKey &&
              (e.preventDefault(), handleSendMessage(inputValue))
            }
          />
          {inputValue.trim() ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => handleSendMessage(inputValue)}
              className="p-3 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20"
            >
              <Send className="w-5 h-5 fill-current" />
            </motion.button>
          ) : (
            <button
              className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-500 hover:text-white'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}

// Subcomponents for Premium UI
function LoadingDots() {
  return (
    <div className="flex gap-4 items-center px-4 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 max-w-[80%]">
      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
        Analysis in progress
      </span>
    </div>
  );
}

function MessageUI({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      className={`flex flex-col gap-2 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div
        className={`px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed font-medium shadow-sm border ${
          isUser
            ? 'bg-zinc-900 border-white/5 text-white rounded-br-none'
            : 'bg-indigo-500/5 border-indigo-500/10 text-zinc-100 rounded-bl-none'
        }`}
      >
        <span
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMessage(message.content)) }}
        />
      </div>
      <span className="text-[9px] font-black italic text-zinc-600 uppercase tracking-widest">
        {isUser ? 'Commander' : 'Victor V4 Agent'} •{' '}
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </motion.div>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/2 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-black italic tracking-wider uppercase"
      whileTap={{ scale: 0.96 }}
    >
      {icon} <span>{label}</span>
    </motion.button>
  );
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<span class="font-black text-white">$1</span>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
