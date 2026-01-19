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
              : 'bg-slate-100 text-slate-500 border border-slate-200'
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
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Защита маржи</h2>
          <p className="text-sm text-slate-500">
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
              ? 'bg-linear-to-r from-emerald-600 to-emerald-500'
              : 'bg-linear-to-r from-slate-100 to-slate-50 border border-slate-200'
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
            className={`transition-transform duration-300 ${protectionEnabled ? 'text-white scale-110' : 'text-slate-600'}`}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {protectionEnabled && <path d="m9 12 2 2 4-4" />}
          </svg>
        </div>

        {/* Status text */}
        <div className="flex-1 text-right">
          <div
            className={`text-xl font-bold tracking-wider ${protectionEnabled ? 'text-white' : 'text-slate-700'}`}
          >
            {protectionEnabled ? 'ЗАЩИТА АКТИВНА' : 'ЗАЩИТА ОТКЛЮЧЕНА'}
          </div>
          <div className={`text-sm ${protectionEnabled ? 'text-white/80' : 'text-slate-500'}`}>
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
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-600 text-center">
            ⚠️ Активируйте подписку для включения защиты
          </p>
        </div>
      )}
    </div>
  );
}
