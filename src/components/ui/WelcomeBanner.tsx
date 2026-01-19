// ============================================
// NeuroAgent — Welcome Banner Component
// Personalized greeting for the user
// ============================================

import { motion } from 'framer-motion';
import { useAppStore } from '../../stores';

interface WelcomeBannerProps {
  onAskAgent?: () => void;
}

export function WelcomeBanner({ onAskAgent }: WelcomeBannerProps) {
  const user = useAppStore(state => state.user);
  const firstName = user?.firstName || user?.username || 'Продавец';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 via-purple-100 to-fuchsia-100 border border-indigo-200 mb-6"
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-300/30 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative p-5 flex items-center gap-4">
        {/* Agent Avatar */}
        <motion.div
          className="relative flex-shrink-0"
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400/40 to-purple-400/40 blur-md opacity-60" />

          <img
            src="/agent-avatar.png"
            alt="NeuroAgent"
            className="relative w-16 h-16 rounded-full object-cover border-2 border-indigo-200 shadow-lg shadow-indigo-200"
          />

          {/* Online indicator */}
          <motion.div
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Greeting text */}
        <div className="flex-1 min-w-0">
          <motion.h2
            className="text-lg font-bold text-slate-900 mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Привет, {firstName}! 👋
          </motion.h2>
          <motion.p
            className="text-sm text-slate-500 leading-snug"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Я — твой личный агент для Wildberries и Ozon. Готов помочь с любыми задачами!
          </motion.p>
        </div>
      </div>

      {/* Action button */}
      {onAskAgent && (
        <div className="relative px-5 pb-4">
          <motion.button
            onClick={onAskAgent}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium flex items-center justify-center gap-2 hover:from-indigo-400 hover:to-purple-400 transition-all shadow-lg shadow-indigo-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-lg">💬</span>
            Написать агенту
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// Compact version for other pages
export function AgentHint({ message, onAskAgent }: { message?: string; onAskAgent?: () => void }) {
  return (
    <motion.button
      onClick={onAskAgent}
      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 transition-all w-full text-left"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <img
        src="/agent-avatar.png"
        alt="NeuroAgent"
        className="w-10 h-10 rounded-full object-cover border border-indigo-200"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500">
          {message || 'Запутались? Спросите меня — я помогу!'}
        </p>
      </div>
      <span className="text-indigo-400 text-xl">→</span>
    </motion.button>
  );
}

export default WelcomeBanner;
