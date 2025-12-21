// ============================================
// NeuroAgent — Main Agent Page
// Full-screen AI assistant experience
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

// Message types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
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

// Quick action suggestions
const QUICK_ACTIONS = [
  { icon: '📊', text: 'Статистика', fullText: 'Покажи статистику магазина' },
  { icon: '🛡️', text: 'Защита', fullText: 'Статус защиты товаров' },
  { icon: '💰', text: 'Цены', fullText: 'Покажи товары с ценами' },
  { icon: '❓', text: 'Помощь', fullText: 'Что ты умеешь?' },
];

export function AgentPage() {
  const user = useAppStore(state => state.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.firstName || user?.username || 'Продавец';

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message to AI
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    hapticFeedback('light');

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Call AI API
      const history: AgentMessage[] = messages
        .filter(m => m.role !== 'system' && !m.isLoading)
        .slice(-10)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response: AgentResponse = await agentApi.sendMessage(text.trim(), history);

      // Replace loading message with response
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          actionRequired: response.actionRequired,
          metadata: response.metadata,
        };
        return [...withoutLoading, assistantMessage];
      });

      hapticFeedback('success');
    } catch (error) {
      console.error('Agent error:', error);

      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '❌ Произошла ошибка. Попробуйте ещё раз.',
          timestamp: new Date(),
        };
        return [...withoutLoading, errorMessage];
      });

      hapticFeedback('error');
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  // Handle confirmation
  const handleConfirmation = async (messageId: string, confirmed: boolean) => {
    hapticFeedback(confirmed ? 'medium' : 'light');

    const message = messages.find(m => m.id === messageId);
    if (!message?.actionRequired) return;

    const userResponse: ChatMessage = {
      id: `confirm-${Date.now()}`,
      role: 'user',
      content: confirmed ? '✅ Да, подтверждаю' : '❌ Нет, отменить',
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userResponse, loadingMessage]);
    setIsProcessing(true);

    try {
      const response = await agentApi.confirmAction(
        message.actionRequired.operation,
        confirmed,
        message.actionRequired.details
      );

      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        const resultMessage: ChatMessage = {
          id: `result-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        };
        return [...withoutLoading, resultMessage];
      });
    } catch {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [
          ...withoutLoading,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: '❌ Не удалось выполнить операцию',
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  // Check if chat has started
  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-900 to-stone-800 flex flex-col pb-20">
      {/* Welcome Screen - Only shown when no messages */}
      <AnimatePresence>
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            className="flex-1 flex flex-col items-center justify-center px-6 py-8"
          >
            {/* Agent Avatar - Large */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 blur-2xl opacity-40"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />

              <img
                src="/agent-avatar.png"
                alt="NeuroAgent"
                className="relative w-32 h-32 rounded-full object-cover border-4 border-violet-400/30 shadow-2xl shadow-violet-500/20"
              />

              {/* Online indicator */}
              <motion.div
                className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-emerald-400 border-3 border-stone-900"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            {/* Greeting */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl font-bold text-white mb-2">Привет, {firstName}! 👋</h1>
              <p className="text-lg text-violet-300 font-medium mb-4">Я — ваш личный агент</p>
              <p className="text-stone-400 leading-relaxed max-w-xs mx-auto">
                Помогу управлять магазином на
                <br />
                <span className="text-purple-400 font-medium">Wildberries</span> и{' '}
                <span className="text-blue-400 font-medium">Ozon</span>
              </p>
            </motion.div>

            {/* Capabilities */}
            <motion.div
              className="w-full max-w-sm space-y-2 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[
                { icon: '📊', text: 'Статистика продаж и аналитика' },
                { icon: '🛡️', text: 'Защита маржи от акций' },
                { icon: '💰', text: 'Управление ценами' },
                { icon: '⚙️', text: 'Настройка API и приложения' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-stone-800/50 border border-stone-700/50"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-stone-300 text-sm">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-xs text-stone-500 text-center mb-3">Начните с вопроса:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_ACTIONS.map((action, i) => (
                  <motion.button
                    key={i}
                    onClick={() => handleSendMessage(action.fullText)}
                    className="px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-all flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Interface - Shown when messages exist */}
      {hasMessages && (
        <>
          {/* Mini Header */}
          <header className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/agent-avatar.png"
                  alt="NeuroAgent"
                  className="w-9 h-9 rounded-full object-cover border border-violet-500/50"
                />
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-stone-900"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div className="flex-1">
                <h1 className="text-sm font-bold text-white">NeuroAgent</h1>
                <p className="text-xs text-stone-400">{isProcessing ? 'Думаю...' : 'Онлайн'}</p>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map(message => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.isLoading ? (
                    <LoadingBubble />
                  ) : (
                    <MessageBubble
                      message={message}
                      onConfirm={
                        message.actionRequired
                          ? confirmed => handleConfirmation(message.id, confirmed)
                          : undefined
                      }
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </>
      )}

      {/* Input - Always at bottom */}
      <div
        className={`${hasMessages ? 'sticky bottom-20' : 'fixed bottom-20 left-0 right-0'} px-4 py-3 bg-stone-900/95 backdrop-blur-md border-t border-stone-800`}
      >
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Напишите мне что угодно..."
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-full bg-stone-800 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
          />
          <motion.button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isProcessing}
            className="p-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// Loading animation component
function LoadingBubble() {
  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <img
        src="/agent-avatar.png"
        alt="Agent"
        className="w-8 h-8 rounded-full object-cover border border-violet-400/50"
      />
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-stone-800 border border-stone-700/50">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-violet-400"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Message bubble component
interface MessageBubbleProps {
  message: ChatMessage;
  onConfirm?: (confirmed: boolean) => void;
}

function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <img
          src="/agent-avatar.png"
          alt="Agent"
          className="w-8 h-8 rounded-full object-cover border border-violet-400/50 flex-shrink-0"
        />
      )}
      <div
        className={`px-4 py-3 rounded-2xl ${
          isUser
            ? 'rounded-tr-sm bg-gradient-to-r from-violet-500 to-purple-600 text-white'
            : 'rounded-tl-sm bg-stone-800 border border-stone-700/50 text-stone-200'
        }`}
      >
        {/* Message content */}
        <div
          className="text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: formatMessage(message.content),
          }}
        />

        {/* Confirmation buttons */}
        {message.actionRequired && onConfirm && (
          <div className="mt-3 pt-3 border-t border-stone-700/50">
            <p className="text-xs text-amber-400 mb-2">
              ⚠️ {message.actionRequired.confirmationMessage}
            </p>
            <div className="flex gap-2">
              <motion.button
                onClick={() => onConfirm(true)}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-sm font-medium"
                whileTap={{ scale: 0.98 }}
              >
                ✅ Да
              </motion.button>
              <motion.button
                onClick={() => onConfirm(false)}
                className="flex-1 py-2 px-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-medium"
                whileTap={{ scale: 0.98 }}
              >
                ❌ Нет
              </motion.button>
            </div>
          </div>
        )}

        {/* Metadata */}
        {message.metadata && (
          <div className="mt-2 pt-2 border-t border-stone-700/30 text-xs text-stone-500 flex items-center gap-2">
            {message.metadata.executionTime && <span>⏱️ {message.metadata.executionTime}ms</span>}
            {message.metadata.toolsUsed && message.metadata.toolsUsed.length > 0 && (
              <span>🔧 {message.metadata.toolsUsed.join(', ')}</span>
            )}
          </div>
        )}
      </div>
      <span className="text-[10px] text-stone-600 self-end mt-1">
        {message.timestamp.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// Simple message formatting
function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(
      /`(.*?)`/g,
      '<code class="px-1 py-0.5 rounded bg-stone-700 text-violet-300 text-xs">$1</code>'
    )
    .replace(/\n/g, '<br/>');
}

export default AgentPage;
