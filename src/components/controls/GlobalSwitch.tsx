// ============================================
// NeuroGUARDIAN — GlobalSwitch Component
// Main protection toggle with animation
// ============================================

import { useAppStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';

interface GlobalSwitchProps {
  compact?: boolean;
}

export function GlobalSwitch({ compact = false }: GlobalSwitchProps) {
  const { protectionEnabled, setProtectionEnabled, user } = useAppStore();

  const isDisabled = !user?.subscriptionActive;

  const handleToggle = () => {
    if (isDisabled) return;

    hapticFeedback(protectionEnabled ? 'warning' : 'success');
    setProtectionEnabled(!protectionEnabled);
  };

  // Compact version for headers
  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isDisabled}
        className={`
          relative px-3 py-1.5 rounded-full flex items-center gap-1.5
          transition-all duration-300 text-xs font-medium
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          ${
            protectionEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-stone-700/50 text-stone-400 border border-stone-600/50'
          }
        `}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          {protectionEnabled && <path d="m9 12 2 2 4-4" />}
        </svg>
        <span>{protectionEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
        {protectionEnabled && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>
    );
  }

  // Full version
  return (
    <div className="glass-panel p-6 rounded-2xl">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Защита маржи</h2>
          <p className="text-sm text-stone-400">
            {protectionEnabled ? 'Система активна — мониторинг 24/7' : 'Система отключена'}
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
          transition-all duration-500 ease-out flex items-center px-6
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            protectionEnabled
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
              : 'bg-gradient-to-r from-stone-700 to-stone-600'
          }
        `}
      >
        {/* Shield icon */}
        <div className="mr-4">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-white transition-transform duration-300 ${protectionEnabled ? 'scale-110' : ''}`}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {protectionEnabled && <path d="m9 12 2 2 4-4" />}
          </svg>
        </div>

        {/* Status text */}
        <div className="flex-1 text-right">
          <div className="text-xl font-bold text-white tracking-wider">
            {protectionEnabled ? 'ЗАЩИТА АКТИВНА' : 'ЗАЩИТА ОТКЛЮЧЕНА'}
          </div>
          <div className="text-sm text-white/70">
            {protectionEnabled ? 'Выключить мониторинг' : 'Включить защиту'}
          </div>
        </div>

        {/* Pulse effect via CSS class only if armed */}
        {protectionEnabled && (
          <div className="absolute inset-0 bg-emerald-400/20 animate-pulse pointer-events-none" />
        )}
      </button>

      {/* Subscription warning */}
      {isDisabled && (
        <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl">
          <p className="text-sm text-amber-400 text-center">
            ⚠️ Активируйте подписку для включения защиты
          </p>
        </div>
      )}
    </div>
  );
}
