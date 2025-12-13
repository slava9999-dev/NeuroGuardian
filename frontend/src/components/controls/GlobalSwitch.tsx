// ============================================
// NeuroGUARDIAN — GlobalSwitch Component
// Main protection toggle with animation
// ============================================

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';

export function GlobalSwitch() {
  const { protectionEnabled, setProtectionEnabled, user } = useAppStore();
  
  const isDisabled = !user?.subscriptionActive;
  
  const handleToggle = () => {
    if (isDisabled) return;
    
    hapticFeedback(protectionEnabled ? 'warning' : 'success');
    setProtectionEnabled(!protectionEnabled);
  };
  
  return (
    <div className="glass-panel p-6 rounded-2xl">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Защита маржи</h2>
          <p className="text-sm text-stone-400">
            {protectionEnabled 
              ? 'Система активна — мониторинг 24/7'
              : 'Система отключена'
            }
          </p>
        </div>
        
        {/* Status indicator */}
        <div className={`status-dot ${protectionEnabled ? 'status-safe' : 'status-warning'}`} />
      </div>
      
      {/* Main Toggle */}
      <button
        onClick={handleToggle}
        disabled={isDisabled}
        className={`
          relative w-full h-24 rounded-2xl overflow-hidden
          transition-all duration-500 ease-out
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${protectionEnabled 
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' 
            : 'bg-gradient-to-r from-stone-700 to-stone-600'
          }
        `}
      >
        {/* Animated background pattern */}
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            backgroundPosition: protectionEnabled ? ['0% 0%', '100% 100%'] : '0% 0%',
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '30px 30px',
          }}
        />
        
        {/* Shield icon */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <motion.svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
            animate={{
              scale: protectionEnabled ? [1, 1.1, 1] : 1,
            }}
            transition={{
              duration: 2,
              repeat: protectionEnabled ? Infinity : 0,
              repeatType: 'loop',
            }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <AnimatePresence mode="wait">
              {protectionEnabled && (
                <motion.path
                  key="check"
                  d="m9 12 2 2 4-4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </AnimatePresence>
          </motion.svg>
        </div>
        
        {/* Status text */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={protectionEnabled ? 'armed' : 'disarmed'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-2xl font-bold text-white tracking-wider">
                {protectionEnabled ? 'ARMED' : 'DISARMED'}
              </div>
              <div className="text-sm text-white/70">
                {protectionEnabled ? 'Нажмите для отключения' : 'Нажмите для активации'}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Pulse animation when armed */}
        {protectionEnabled && (
          <motion.div
            className="absolute inset-0 bg-emerald-400 rounded-2xl"
            animate={{
              opacity: [0, 0.2, 0],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        )}
      </button>
      
      {/* Subscription warning */}
      {isDisabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl"
        >
          <p className="text-sm text-amber-400 text-center">
            ⚠️ Активируйте подписку для включения защиты
          </p>
        </motion.div>
      )}
    </div>
  );
}
