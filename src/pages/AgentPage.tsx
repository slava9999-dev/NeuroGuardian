// ============================================
// NeuroAgent — Main Agent Page
// Clean, minimalist AI assistant interface
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useChatStore, type ChatMessage } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { agentApi, type AgentMessage, type AgentResponse } from '../lib/agentApi';

export function AgentPage() {
  const user = useAppStore(state => state.user);

  // Use chat store for persistent messages
  const messages = useChatStore(state => state.messages);
  const addMessage = useChatStore(state => state.addMessage);
  const removeLoadingMessages = useChatStore(state => state.removeLoadingMessages);
  const isProcessing = useChatStore(state => state.isProcessing);
  const setProcessing = useChatStore(state => state.setProcessing);

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.firstName || user?.username || 'друг';

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle File Input
  const handleFileClick = () => {
    hapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      hapticFeedback('medium');
      setInputValue(prev => (prev ? `${prev}\n[Файл: ${file.name}]` : `[Файл: ${file.name}]`));
    }
  };

  // Handle Voice Input (Simulation for demo)
  const handleVoiceClick = () => {
    hapticFeedback('medium');
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    // Simulate listening delay and result
    setTimeout(() => {
      setIsListening(false);
      setInputValue('Какие товары сейчас в просадке?');
      hapticFeedback('success');
    }, 2000);
  };

  // Send message to AI
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    hapticFeedback('light');
    setIsListening(false); // Stop listening if sending

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add loading message
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
      // Call AI API - send last 15 messages for context
      const history: AgentMessage[] = messages
        .filter(m => m.role !== 'system' && !m.isLoading)
        .slice(-15)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response: AgentResponse = await agentApi.sendMessage(text.trim(), history);

      // Remove loading message and add response
      removeLoadingMessages();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        actionRequired: response.actionRequired,
        metadata: response.metadata,
      };
      addMessage(assistantMessage);

      hapticFeedback('success');
    } catch (error) {
      console.error('Agent error:', error);

      removeLoadingMessages();
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMessage);

      hapticFeedback('error');
    } finally {
      setProcessing(false);
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
      timestamp: new Date().toISOString(),
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    addMessage(userResponse);
    addMessage(loadingMessage);
    setProcessing(true);

    try {
      const response = await agentApi.confirmAction(
        message.actionRequired.operation,
        confirmed,
        message.actionRequired.details
      );

      removeLoadingMessages();
      const resultMessage: ChatMessage = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      addMessage(resultMessage);
    } catch {
      removeLoadingMessages();
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Не удалось выполнить операцию',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setProcessing(false);
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
    <div className="min-h-screen bg-stone-900 flex flex-col relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-900 to-stone-800 pointer-events-none" />

      {/* Welcome Screen - Only shown when no messages */}
      <AnimatePresence>
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            className="flex-1 flex flex-col items-center justify-center px-6 relative z-10"
          >
            {/* Agent Avatar - Centerpiece */}
            <motion.div
              className="relative mb-10"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
            >
              {/* Subtle pulsing glow */}
              <motion.div
                className="absolute inset-0 rounded-full bg-violet-500/20 blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              <div className="relative">
                <img
                  src="/agent-avatar.png"
                  alt="NeuroAgent"
                  className="w-40 h-40 rounded-full object-cover border-2 border-stone-800 shadow-2xl"
                />

                {/* Online indicator */}
                <motion.div
                  className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-500 border-4 border-stone-900"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </motion.div>

            {/* Clean Typography */}
            <motion.div
              className="text-center space-y-4 max-w-xs mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-3xl font-light text-white">
                Привет,{' '}
                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                  {firstName}
                </span>
              </h1>

              <p className="text-stone-400 font-light text-lg leading-relaxed">
                Я на связи. Спроси меня о чём угодно — я помогу.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Interface - Shown when messages exist */}
      {hasMessages && (
        <>
          {/* Minimalist Header */}
          <header className="sticky top-0 z-20 bg-stone-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/agent-avatar.png"
                  alt="NeuroAgent"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-stone-800"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-stone-900" />
              </div>
              <div className="flex-1">
                <h1 className="text-sm font-semibold text-white tracking-wide">NeuroAgent</h1>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                  {isProcessing ? 'Печатает...' : 'Online'}
                </p>
              </div>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <AnimatePresence mode="popLayout">
              {messages.map(message => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
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
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </>
      )}

      {/* Input Area - Cleaner, modern Design */}
      <div
        className={`
        ${hasMessages ? 'sticky bottom-0 pb-6 pt-2' : 'fixed bottom-10 left-0 right-0'} 
        px-4 z-30 transition-all duration-500
      `}
      >
        <div className="max-w-xl mx-auto backdrop-blur-xl bg-stone-800/90 rounded-[2rem] border border-white/10 shadow-2xl p-1.5 flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

          {/* File Attachment Button */}
          <button
            className="p-3.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={handleFileClick}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Text Input */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isListening ? 'Слушаю...' : 'Сообщение...'}
            disabled={isProcessing}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-stone-500 px-2 py-3.5 focus:outline-none resize-none max-h-32 min-h-[48px]"
            style={{ height: 'auto' }}
          />

          {inputValue.trim() ? (
            /* Send Button */
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => handleSendMessage(inputValue)}
              className="p-3.5 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-500 transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </motion.button>
          ) : (
            /* Voice Input Button */
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleVoiceClick}
              className={`p-3.5 rounded-full transition-colors ${
                isListening
                  ? 'bg-red-500/20 text-red-500 animate-pulse'
                  : 'text-stone-400 hover:text-white hover:bg-white/10'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isListening ? (
                  <>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M4 12a8 8 0 0 0 16 0" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading animation component
function LoadingBubble() {
  return (
    <div className="flex items-end gap-2 max-w-[85%]">
      <img
        src="/agent-avatar.png"
        alt="Agent"
        className="w-6 h-6 rounded-full object-cover opacity-50 mb-1"
      />
      <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-stone-800/80 border border-stone-700/50">
        <div className="flex gap-1.5 grayscale">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-stone-500"
              animate={{
                y: [0, -3, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
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
    <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <img
          src="/agent-avatar.png"
          alt="Agent"
          className="w-6 h-6 rounded-full object-cover mb-1 border border-stone-700/50"
        />
      )}
      <div
        className={`px-5 py-3.5 rounded-2xl shadow-sm backdrop-blur-sm ${
          isUser
            ? 'rounded-br-sm bg-violet-600 text-white'
            : 'rounded-bl-sm bg-stone-800/90 border border-stone-700/50 text-stone-200'
        }`}
      >
        {/* Message content */}
        <div
          className="text-[15px] leading-relaxed whitespace-pre-wrap font-sans"
          dangerouslySetInnerHTML={{
            __html: formatMessage(message.content),
          }}
        />

        {/* Confirmation buttons */}
        {message.actionRequired && onConfirm && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs text-amber-400 mb-3 font-medium flex items-center gap-1.5">
              <span>⚠️</span> {message.actionRequired.confirmationMessage}
            </p>
            <div className="flex gap-3">
              <motion.button
                onClick={() => onConfirm(true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                Подтвердить
              </motion.button>
              <motion.button
                onClick={() => onConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                Отмена
              </motion.button>
            </div>
          </div>
        )}

        {/* Info Metadata */}
        {message.metadata && !isUser && (
          <div className="mt-2 text-[10px] text-stone-500 flex items-center justify-between">
            {message.metadata.executionTime && <span>{message.metadata.executionTime}ms</span>}
            <span className="opacity-50">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Refined message formatting
function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-white">$1</span>')
    .replace(/\*(.*?)\*/g, '<span class="italic text-stone-300">$1</span>')
    .replace(
      /`(.*?)`/g,
      '<code class="px-1.5 py-0.5 rounded-md bg-black/30 font-mono text-[0.9em] text-violet-200 border border-white/5">$1</code>'
    )
    .replace(/\n\n/g, '<br/><br/>') // Better spacing compared to single br
    .replace(/\n/g, '<br/>');
}
