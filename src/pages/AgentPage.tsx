// ============================================
// NeuroAgent — Main Agent Page V7.0 (Warm Light)
// Fixed: Chat not cut off, Voice UI added
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useChatStore, type ChatMessage } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  TrendingUp,
  Calculator,
  Shield,
  Package,
  Trash2,
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

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(
    () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Voice recognition handling
  const handleVoiceInput = () => {
    if (!voiceSupported) {
      alert('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    hapticFeedback('medium');
    setIsListening(true);

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(prev => prev + transcript);
      setIsListening(false);
      hapticFeedback('success');
    };

    recognition.onerror = () => {
      setIsListening(false);
      hapticFeedback('error');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

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
        content: '🚨 Ошибка связи с сервером. Попробуйте еще раз.',
        timestamp: new Date().toISOString(),
      });
      hapticFeedback('error');
    } finally {
      setProcessing(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col bg-page" role="main">
      {/* Welcome Screen - No Messages */}
      <AnimatePresence>
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center px-6 pb-32"
          >
            {/* Viktor Hero */}
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-primary/5 blur-[60px] rounded-full scale-150" />
              <ViktorCore size="lg" />
            </div>

            <div className="text-center space-y-3 mb-10">
              <p className="text-xs font-semibold tracking-widest text-primary/60 uppercase">
                Ваш персональный ассистент
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-text-main">
                Привет, {firstName}!
              </h1>
              <p className="text-text-secondary text-sm max-w-[280px] mx-auto leading-relaxed">
                Я — Виктор. Помогу защитить маржу, следить за ценами и делать продажи стабильными.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <QuickActionButton
                icon={<Shield className="w-5 h-5 text-success" />}
                label="Защитить товары"
                onClick={() => handleSendMessage('защити все товары')}
              />
              <QuickActionButton
                icon={<TrendingUp className="w-5 h-5 text-primary" />}
                label="Аналитика продаж"
                onClick={() => handleSendMessage('покажи статистику продаж')}
              />
              <QuickActionButton
                icon={<Calculator className="w-5 h-5 text-warning" />}
                label="Юнит-экономика"
                onClick={() => handleSendMessage('рассчитай юнит-экономику')}
              />
              <QuickActionButton
                icon={<Package className="w-5 h-5 text-info" />}
                label="Проверить цены"
                onClick={() => handleSendMessage('проверь цены конкурентов')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header - Only when messages exist */}
      {hasMessages && (
        <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-lg border-b border-surface-dim px-4 py-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <ViktorCore size="sm" />
              <div>
                <span className="text-sm font-bold text-text-main">Виктор</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isProcessing ? 'bg-primary animate-pulse' : 'bg-success'
                    }`}
                  />
                  <span className="text-xs text-text-muted">
                    {isProcessing ? 'Думает...' : 'Онлайн'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                hapticFeedback('medium');
                if (confirm('Очистить историю чата?')) {
                  clearMessages();
                }
              }}
              className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft transition-colors"
              aria-label="Очистить чат"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Messages Area - FIXED: proper scrolling container */}
      {hasMessages && (
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
          style={{
            paddingBottom: '140px', // Space for input bar
          }}
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.isLoading ? <LoadingBubble /> : <MessageBubble message={m} />}
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>
      )}

      {/* Input Bar - FIXED: always visible at bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-linear-to-t from-background via-background to-transparent pt-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-end gap-2 bg-surface rounded-2xl border border-surface-dim shadow-lg p-2">
            {/* Attachment Button */}
            <button
              className="p-3 text-text-muted hover:text-primary transition-colors rounded-xl hover:bg-primary-dim"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Прикрепить файл"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={isListening ? '🎤 Слушаю...' : 'Напишите сообщение...'}
              className="flex-1 bg-transparent text-text-main px-2 py-3 text-sm focus:outline-none resize-none max-h-32 min-h-[48px] placeholder:text-text-muted"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
              aria-label="Сообщение"
            />

            {/* Voice Button */}
            {voiceSupported && (
              <button
                onClick={handleVoiceInput}
                className={`p-3 rounded-xl transition-all ${
                  isListening
                    ? 'bg-danger text-white animate-pulse'
                    : 'text-text-muted hover:text-primary hover:bg-primary-dim'
                }`}
                aria-label={isListening ? 'Остановить запись' : 'Голосовой ввод'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            {/* Send Button */}
            {inputValue.trim() ? (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => handleSendMessage(inputValue)}
                disabled={isProcessing}
                className="p-3 bg-primary rounded-xl text-white shadow-md hover:bg-primary-hover disabled:opacity-50 transition-all"
                aria-label="Отправить"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            ) : null}
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function LoadingBubble() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-surface-dim max-w-[85%]">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs text-text-muted">Виктор думает...</span>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-surface border border-surface-dim text-text-main rounded-bl-md'
        }`}
      >
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMessage(message.content)) }}
        />
      </div>
      <span className="text-[10px] text-text-muted px-1">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
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
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      className="flex items-center gap-3 px-4 py-4 rounded-xl bg-surface border border-surface-dim text-text-main hover:border-primary hover:shadow-md transition-all text-sm font-medium"
      whileTap={{ scale: 0.97 }}
    >
      {icon}
      <span className="text-left">{label}</span>
    </motion.button>
  );
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
