// ============================================
// NeuroAgent — Main Agent Page V4.0 (Premium)
// Aesthetic: Strategic Command Center | Jarvis-style UI
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useChatStore, type ChatMessage } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

import { Send, Mic, Paperclip, TrendingUp, Calculator, Shield, Package } from 'lucide-react';
import DOMPurify from 'dompurify';
import { ViktorCore } from '../components/ui/ViktorCore';

export function AgentPage() {
  const user = useAppStore(state => state.user);
  const messages = useChatStore(state => state.messages);
  const addMessage = useChatStore(state => state.addMessage);
  const removeLoadingMessages = useChatStore(state => state.removeLoadingMessages);
  const clearMessages = useChatStore(state => state.clearMessages);
  const setProcessing = useChatStore(state => state.setProcessing);
  const loadFromServer = useChatStore(state => state.loadFromServer);
  const isSynced = useChatStore(state => state.isSynced);
  const isProcessing = useChatStore(state => state.isProcessing);

  const [inputValue, setInputValue] = useState('');
  const [isListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.firstName || user?.username || 'Командир';

  useEffect(() => {
    if (!isSynced) loadFromServer();
  }, [isSynced, loadFromServer]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]); // Added messagesEndRef to dependencies

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
    } catch {
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
    <div className="h-full flex flex-col relative">
      {/* Welcome Screen */}
      <AnimatePresence>
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8"
          >
            {/* Viktor Hero */}
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full" />
              <ViktorCore size="lg" />
            </div>

            <div className="text-center space-y-4 mb-12">
              <h2 className="text-[10px] font-black tracking-[0.5em] text-primary/40 uppercase">
                ЯДРО СИСТЕМЫ: АКТИВНО
              </h2>
              <h1 className="text-4xl font-black tracking-tighter italic uppercase text-slate-900">
                ПРИВЕТ, {firstName}
              </h1>
              <p className="text-slate-500 text-sm font-medium tracking-tight max-w-[300px] mx-auto">
                Я — Виктор. Помогаю защищать маржу, следить за ценами и делать продажи стабильными.
              </p>
            </div>

            {/* Quick Actions Bento */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <QuickActionButton
                icon={<Shield className="w-4 h-4 text-success" />}
                label="ЗАЩИТИТЬ"
                onClick={() => handleSendMessage('защити товары')}
              />
              <QuickActionButton
                icon={<TrendingUp className="w-4 h-4 text-primary" />}
                label="АНАЛИТИКА"
                onClick={() => handleSendMessage('статистика продаж')}
              />
              <QuickActionButton
                icon={<Calculator className="w-4 h-4 text-slate-500" />}
                label="ЭКОНОМИКА"
                onClick={() => handleSendMessage('рассчитай юнит-экономику')}
              />
              <QuickActionButton
                icon={<Package className="w-4 h-4 text-warning" />}
                label="КОНКУРЕНТЫ"
                onClick={() => handleSendMessage('сравни цены с конкурентами')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Header */}
      {hasMessages && (
        <header className="fixed top-0 left-0 right-0 z-50 nav-glass p-4 py-3 flex items-center justify-between border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <ViktorCore size="sm" />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-wider text-slate-900">ВИКТОР</span>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-primary animate-pulse' : 'bg-success shadow-[0_0_8px_var(--color-success)]'}`}
                />
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  {isProcessing ? 'Формирую ответ...' : 'Онлайн'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              hapticFeedback('medium');
              clearMessages();
            }}
            className="px-4 py-2 rounded-xl bg-white/70 border border-slate-200 text-[10px] font-black text-slate-500 hover:text-slate-900 transition-all uppercase tracking-widest"
          >
            СБРОС ЧАТА
          </button>
        </header>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-5 py-24 space-y-8 no-scrollbar scroll-smooth">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.isLoading ? <LoadingDots /> : <MessageUI message={m} />}
          </div>
        ))}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-background via-background/90 to-transparent z-50 safe-area-inset-bottom">
        <div className="max-w-xl mx-auto flex items-end gap-3 bg-white/80 p-2 border border-slate-200 rounded-3xl shadow-xl">
          <button
            className="p-3 text-slate-500 hover:text-slate-900 transition-all"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Загрузить файл"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={isListening ? 'СЛУШАЮ...' : 'Напишите Виктору. Например: "проверь цены"'}
            className="flex-1 bg-transparent text-slate-900 px-2 py-3.5 text-sm focus:outline-none resize-none max-h-32 min-h-[48px] font-medium placeholder:text-slate-400"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
          />
          {inputValue.trim() ? (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => handleSendMessage(inputValue)}
              className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/30 hover:brightness-110"
              aria-label="Отправить"
            >
              <Send className="w-5 h-5 fill-current" />
            </motion.button>
          ) : (
            <button
              className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-danger text-white animate-pulse' : 'text-slate-500 hover:text-slate-900'}`}
              aria-label="Голосовой ввод"
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

// Subcomponents
function LoadingDots() {
  return (
    <div className="flex gap-4 items-center px-5 py-3.5 rounded-2xl bg-white border border-primary/20 max-w-[85%]">
      <div className="flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-100" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-200" />
      </div>
      <span className="text-[10px] font-black text-primary/70 uppercase tracking-widest">
        Виктор анализирует...
      </span>
    </div>
  );
}

function MessageUI({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      className={`flex flex-col gap-2.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div
        className={`px-5 py-3.5 rounded-[22px] text-[15px] leading-relaxed font-medium shadow-xl border ${
          isUser
            ? 'bg-primary text-white border-transparent rounded-br-none shadow-[0_8px_20px_var(--color-primary-dim)]'
            : 'bg-white border-slate-200 text-slate-800 rounded-bl-none'
        }`}
      >
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMessage(message.content)) }}
        />
      </div>
      <div className="flex items-center gap-2 px-1">
        <span className="text-[9px] font-black italic text-slate-400 uppercase tracking-widest">
          {isUser ? 'ПОЛЬЗОВАТЕЛЬ' : 'ВИКТОР'} •{' '}
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all text-[11px] font-black uppercase tracking-wider"
      whileTap={{ scale: 0.96 }}
    >
      {icon} <span>{label}</span>
    </motion.button>
  );
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<span class="font-black text-slate-900">$1</span>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
