// ============================================
// NeuroGUARDIAN — Agent Viktor UI v2.0
// Aesthetic: Hybrid Intelligence | Glassmorphism
// ============================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useChatStore, useProductsStore, type ChatMessage } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

import {
  Send,
  Mic,
  Plus,
  TrendingUp,
  Calculator,
  Shield,
  Package,
  Trash2,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  const { products } = useProductsStore();

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.firstName || user?.username || 'Командир';

  useEffect(() => {
    if (!isSynced) loadFromServer();
  }, [isSynced, loadFromServer]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Dynamic Mode for Header
  const designMode = useMemo(() => {
    if (!products || products.length === 0) return 'peace';
    const hasCritical = products.some(p => p.status === 'triggered');
    if (hasCritical) return 'critical';
    return 'peace';
  }, [products]);

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
      hapticFeedback('success');
    } catch {
      removeLoadingMessages();
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '🚨 Критический сбой нейронной сети. Проверьте соединение.',
        timestamp: new Date().toISOString(),
      });
      hapticFeedback('error');
    } finally {
      setProcessing(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col font-display relative overflow-hidden">
      {/* Header (V2.0 Sticky Glass) */}
      <header className="sticky top-0 z-40 glass-nav border-b border-black/5 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full shadow-lg ${designMode === 'critical' ? 'bg-toxic-orange/20' : 'bg-primary/10'}`}
            >
              <ViktorCore size="sm" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-text-main">Виктор</h2>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${isProcessing ? 'bg-primary animate-pulse' : 'bg-peace-green pulse-status'}`}
                ></span>
                <span className="text-[9px] uppercase tracking-widest font-black text-black/40">
                  {isProcessing ? 'Синтез данных...' : 'Neuro-Flash v2.4'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                hapticFeedback('medium');
                if (confirm('Очистить нейронную память (чат)?')) clearMessages();
              }}
              className="p-2 rounded-xl bg-black/5 text-black/40 hover:text-hot-neon transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-6 pb-40 no-scrollbar scroll-smooth"
      >
        <div className="max-w-2xl mx-auto space-y-8">
          <AnimatePresence>
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12 py-8"
              >
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-4">
                    <Sparkles size={12} /> Intelligence through Transparency
                  </div>
                  <h1 className="text-4xl font-black text-text-main tracking-tighter leading-none">
                    Привет, <span className="text-primary">{firstName}</span>.
                  </h1>
                  <p className="text-sm font-medium text-black/50 max-w-[280px] mx-auto">
                    Система мониторинга стабильна. Какие стратегии активируем сегодня?
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StitchActionCard
                    icon={<Shield className="text-peace-green" />}
                    title="Защита 2.0"
                    desc="Умный Стоп-Лосс"
                    onClick={() => handleSendMessage('Виктор, активируй полную защиту товаров')}
                  />
                  <StitchActionCard
                    icon={<TrendingUp className="text-primary" />}
                    title="Аналитика"
                    desc="Индекс прибыльности"
                    onClick={() => handleSendMessage('Виктор, покажи анализ прибыльности')}
                  />
                  <StitchActionCard
                    icon={<Calculator className="text-toxic-orange" />}
                    title="Юнит-Экономика"
                    desc="Аудит тарифов 2026"
                    onClick={() => handleSendMessage('Виктор, проведи аудит юнит-экономики')}
                  />
                  <StitchActionCard
                    icon={<Package className="text-azure" />}
                    title="Разведка"
                    desc="Цены конкурентов"
                    onClick={() => handleSendMessage('Виктор, проверь цены конкурентов')}
                  />
                </div>
              </motion.div>
            )}

            {messages.map(m => (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Role Label */}
                <p
                  className={`text-[10px] font-black uppercase tracking-widest px-2 opacity-30 ${m.role === 'user' ? 'text-right' : 'text-left'}`}
                >
                  {m.role === 'user' ? 'Вы' : 'Виктор'}
                </p>

                {m.isLoading ? (
                  <div className="fused-card px-5 py-4 flex gap-2">
                    <div className="size-1.5 rounded-full bg-primary animate-bounce" />
                    <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                    <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                  </div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`max-w-[85%] px-5 py-4 text-sm font-medium leading-relaxed shadow-sm ring-1 ring-black/5 ${
                      m.role === 'user'
                        ? 'bg-primary text-white rounded-2xl rounded-tr-none'
                        : 'fused-card rounded-2xl rounded-tl-none'
                    }`}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(formatMessage(m.content)),
                      }}
                    />
                  </motion.div>
                )}

                {/* Feedback/Time */}
                <span className="text-[9px] font-bold text-black/20 px-2 mt-1">
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Zone (Fixed Bottom with HUD elements) */}
      <div className="fixed bottom-24 left-0 right-0 z-50 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Quick Chips */}
          {hasMessages && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
              <SuggestionChip
                icon={<Zap size={14} />}
                label="Найти демпинг"
                onClick={() => handleSendMessage('Кто демпингует?')}
              />
              <SuggestionChip
                icon={<Package size={14} />}
                label="Мало остатков"
                onClick={() => handleSendMessage('У каких товаров низкий остаток?')}
              />
              <SuggestionChip
                icon={<Shield size={14} />}
                label="Стратегия 2026"
                onClick={() => handleSendMessage('Какие сейчас риски прибыли?')}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button className="size-12 shrink-0 flex items-center justify-center rounded-full fused-card text-black/40 shadow-sm border border-black/5 active:scale-90 transition-transform">
              <Plus size={24} />
            </button>
            <div className="flex-1 relative">
              <div className="flex items-center w-full min-h-[56px] rounded-2xl fused-card px-4 ring-1 ring-inset ring-black/5 shadow-inner">
                <textarea
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Напишите Виктору..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm py-3 placeholder:text-black/30 resize-none max-h-32 min-h-[48px]"
                  rows={1}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(inputValue);
                    }
                  }}
                />
                <button
                  onClick={() => setIsListening(!isListening)}
                  className={`p-2 transition-colors ${isListening ? 'text-hot-neon animate-pulse' : 'text-black/30'}`}
                >
                  <Mic size={20} />
                </button>
              </div>
            </div>
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isProcessing}
              className="size-12 shrink-0 flex items-center justify-center rounded-full bg-primary text-white shadow-lg active:scale-95 disabled:opacity-30 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StitchActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      className="fused-card p-4 text-left flex flex-col gap-3 group"
    >
      <div className="size-10 rounded-xl bg-black/3 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="text-xs font-black uppercase tracking-tight text-text-main">{title}</h4>
        <p className="text-[10px] font-medium text-black/40">{desc}</p>
      </div>
    </motion.button>
  );
}

function SuggestionChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      className="flex items-center gap-2 px-4 py-2 rounded-full fused-card border border-black/5 text-xs font-black uppercase tracking-tight text-black/60 whitespace-nowrap"
    >
      {icon} {label}
    </motion.button>
  );
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
