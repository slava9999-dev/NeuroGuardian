// ============================================
// NeuroGUARDIAN — Settings Page
// User settings and preferences
// ============================================

import { useState } from 'react';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import type { DefenseMode } from '../types';

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { user, defenseMode, setDefenseMode } = useAppStore();
  const [, setIsSaving] = useState(false);
  
  const handleDefenseModeChange = async (mode: DefenseMode) => {
    hapticFeedback('light');
    setDefenseMode(mode);
    
    setIsSaving(true);
    try {
      // TODO: Sync with backend
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectApi = async (marketplace: 'WB' | 'Ozon') => {
    hapticFeedback('warning');
    // TODO: Implement API disconnect
    alert(`Отключение ${marketplace} API будет реализовано`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Настройки</h1>
      </header>

      {/* User info */}
      {user && (
        <section className="glass-panel p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-stone-900 font-bold text-xl">
              {user.firstName.charAt(0)}
            </div>
            <div>
              <h2 className="font-semibold text-white">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-stone-400">
                {user.username ? `@${user.username}` : 'Telegram User'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Defense Mode */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Режим защиты
        </h3>
        
        <div className="space-y-3">
          <button
            onClick={() => handleDefenseModeChange('zero_stock')}
            className={`
              w-full glass-panel p-4 flex items-start gap-4 transition-all
              ${defenseMode === 'zero_stock' ? 'ring-2 ring-amber-500' : ''}
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${defenseMode === 'zero_stock' ? 'bg-amber-500/20' : 'bg-stone-800'}
            `}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={defenseMode === 'zero_stock' ? 'text-amber-400' : 'text-stone-400'}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="7" y1="8" x2="17" y2="8" />
              </svg>
            </div>
            <div className="text-left">
              <h4 className="font-medium text-white">Обнуление стока</h4>
              <p className="text-sm text-stone-400">
                При срабатывании остаток товара обнуляется. Товар снимается с продажи.
              </p>
            </div>
          </button>

          <button
            onClick={() => handleDefenseModeChange('price_correction')}
            className={`
              w-full glass-panel p-4 flex items-start gap-4 transition-all
              ${defenseMode === 'price_correction' ? 'ring-2 ring-amber-500' : ''}
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${defenseMode === 'price_correction' ? 'bg-amber-500/20' : 'bg-stone-800'}
            `}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={defenseMode === 'price_correction' ? 'text-amber-400' : 'text-stone-400'}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="text-left">
              <h4 className="font-medium text-white">Коррекция цены</h4>
              <p className="text-sm text-stone-400">
                Цена автоматически возвращается к установленному минимуму.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Connected APIs */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Подключённые API
        </h3>
        
        <div className="space-y-3">
          {/* WB */}
          <div className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-400">WB</span>
              </div>
              <div>
                <h4 className="font-medium text-white">Wildberries</h4>
                <p className="text-sm text-stone-400">
                  {user?.wbKeyRef ? '✅ Подключён' : '❌ Не подключён'}
                </p>
              </div>
            </div>
            {user?.wbKeyRef && (
              <button
                onClick={() => handleDisconnectApi('WB')}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Отключить
              </button>
            )}
          </div>

          {/* Ozon */}
          <div className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-400">O₃</span>
              </div>
              <div>
                <h4 className="font-medium text-white">Ozon</h4>
                <p className="text-sm text-stone-400">
                  {user?.ozonKeyRef ? '✅ Подключён' : '❌ Не подключён'}
                </p>
              </div>
            </div>
            {user?.ozonKeyRef && (
              <button
                onClick={() => handleDisconnectApi('Ozon')}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Отключить
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Subscription */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Подписка
        </h3>
        
        <div className={`
          glass-panel p-4
          ${user?.subscriptionActive ? 'border-emerald-500/30' : 'border-red-500/30'}
        `}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">
              {user?.subscriptionPlan === 'trial' ? 'Пробный период' :
               user?.subscriptionPlan === 'basic' ? 'Basic' :
               user?.subscriptionPlan === 'pro' ? 'Pro' : 'Нет подписки'}
            </span>
            <span className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${user?.subscriptionActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
            `}>
              {user?.subscriptionActive ? 'Активна' : 'Неактивна'}
            </span>
          </div>
          
          {user?.subscriptionExpiresAt && (
            <p className="text-sm text-stone-400">
              Действует до: {new Date(user.subscriptionExpiresAt).toLocaleDateString('ru-RU')}
            </p>
          )}
          
          {!user?.subscriptionActive && (
            <button className="btn-primary w-full mt-4">
              Оформить подписку
            </button>
          )}
        </div>
      </section>

      {/* App info */}
      <section className="text-center text-stone-500 text-sm">
        <p>NeuroGUARDIAN v1.0.0</p>
        <p>Margin Defense System</p>
      </section>
    </div>
  );
}
