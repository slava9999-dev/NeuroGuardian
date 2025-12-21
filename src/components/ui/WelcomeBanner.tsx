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
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 border border-violet-500/30 mb-6"
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent"
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
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 blur-md opacity-50" />

          <img
            src="/agent-avatar.png"
            alt="NeuroAgent"
            className="relative w-16 h-16 rounded-full object-cover border-2 border-violet-400/50 shadow-lg shadow-violet-500/30"
          />

          {/* Online indicator */}
          <motion.div
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-stone-900"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Greeting text */}
        <div className="flex-1 min-w-0">
          <motion.h2
            className="text-lg font-bold text-white mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Привет, {firstName}! 👋
          </motion.h2>
          <motion.p
            className="text-sm text-stone-300 leading-snug"
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2 hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25"
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
      className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 transition-all w-full text-left"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <img
        src="/agent-avatar.png"
        alt="NeuroAgent"
        className="w-10 h-10 rounded-full object-cover border border-violet-400/50"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-300">
          {message || 'Запутались? Спросите меня — я помогу!'}
        </p>
      </div>
      <span className="text-violet-400 text-xl">→</span>
    </motion.button>
  );
}

export default WelcomeBanner;
