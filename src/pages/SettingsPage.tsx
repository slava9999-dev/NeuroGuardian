// ============================================
// NeuroGUARDIAN — Settings Page V4.0 (Premium)
// Aesthetic: System Control Panel | Digital Identity
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Shield,
  CreditCard,
  RefreshCcw,
  Store,
  CheckCircle2,
  MinusCircle,
  Crown,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import {
  settingsApi,
  marketplaceAccountsApi,
  productsApi,
  type MarketplaceAccount,
} from '../lib/api';
import { SecurityBadge } from '../components/ui/SecurityBadge';
import type { DefenseMode } from '../types';

export function SettingsPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}) {
  const { user, defenseMode, setUser, setVoiceEnabled } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus] = useState<string | null>(null);

  // Multi-account state
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<MarketplaceAccount>>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await marketplaceAccountsApi.getAccounts();
      if (res.success) setAccounts(res.accounts);
    } catch (e) {
      console.error('Load Accounts Error:', e);
    }
  };

  const handleSaveAccount = async () => {
    if (!editingAccount.name || !editingAccount.marketplace) return;
    setIsSaving(true);
    try {
      const payload = {
        id: editingAccount.id,
        name: editingAccount.name,
        marketplace: editingAccount.marketplace,
        wbApiKey: editingAccount.wb_token,
        ozonClientId: editingAccount.ozon_client_id,
        ozonApiKey: editingAccount.ozon_api_key,
        isActive: editingAccount.is_active,
      };
      const res = await marketplaceAccountsApi.saveAccount(payload);
      if (res.success) {
        hapticFeedback('success');
        setShowAccountModal(false);
        loadAccounts();
      }
    } catch {
      alert('System Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefenseModeChange = (mode: DefenseMode) => {
    hapticFeedback('medium');
    useAppStore.getState().setDefenseMode(mode);
    settingsApi.updateSettings({ defenseMode: mode });
  };

  return (
    <div className="min-h-full text-white px-5 py-6 pb-32 relative overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-10 nav-blur sticky top-0 z-50 p-2 -mx-2 rounded-full border border-white/5">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-[10px] font-black tracking-[0.4em] text-zinc-500 uppercase">
          Настройки Системы
        </span>
        <div className="w-10" />
      </header>

      {/* Sync Status Banner */}
      <AnimatePresence>
        {syncStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold tracking-widest uppercase flex items-center gap-3"
          >
            <RefreshCcw className="w-4 h-4 animate-spin" /> {syncStatus}
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Identity */}
      <section className="premium-card mb-8 border-indigo-500/20">
        <div className="flex items-center gap-5">
          <div className="relative">
            <img
              src="/agent-avatar.png"
              className="w-16 h-16 rounded-full border-2 border-violet-500/50 object-cover"
              alt="User"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-4 border-black" />
          </div>
          <div>
            <h2 className="text-xl font-black italic tracking-tighter uppercase">
              {user?.firstName || 'Commander'}
            </h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
              {user?.username ? `@${user.username}` : 'Стратегический Оператор'}
            </p>
          </div>
        </div>
      </section>

      {/* Marketplace Hub */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
            Подключенные Аккаунты
          </h3>
          <button
            onClick={() => {
              setEditingAccount({ marketplace: 'wb', is_active: true });
              setShowAccountModal(true);
            }}
            className="flex items-center gap-2 text-[10px] font-black text-emerald-400 hover:text-white transition-all uppercase tracking-widest"
          >
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>

        <div className="space-y-3">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="premium-card flex items-center justify-between py-4 group hover:bg-white/2"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border ${acc.marketplace === 'wb' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black italic tracking-tight">
                    {acc.name.toUpperCase()}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${acc.is_active ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}
                    />
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">
                      {acc.marketplace} • {acc.is_active ? 'Активен' : 'Отключен'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingAccount(acc);
                    setShowAccountModal(true);
                  }}
                  className="p-2.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button className="p-2.5 rounded-lg bg-red-500/5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && !isSaving && (
            <div className="py-6 px-4 bg-white/2 border border-dashed border-white/10 rounded-2xl text-center">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                Нет подключенных аккаунтов
              </p>
              <button
                onClick={() => {
                  setEditingAccount({ marketplace: 'wb', is_active: true });
                  setShowAccountModal(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-primary transition-all"
              >
                <Plus className="w-4 h-4" /> Добавить API Ключ
              </button>
            </div>
          )}
          {accounts.length > 0 && (
            <button
              disabled={isSyncing}
              onClick={async () => {
                hapticFeedback('medium');
                setIsSyncing(true);
                try {
                  // Sync both marketplaces for all active accounts
                  await productsApi.syncProducts('WB');
                  await productsApi.syncProducts('Ozon');
                  hapticFeedback('success');
                  alert('Синхронизация завершена успешно!');
                } catch {
                  hapticFeedback('error');
                  alert('Ошибка синхронизации. Проверьте API ключи.');
                } finally {
                  setIsSyncing(false);
                }
              }}
              className="w-full py-4 mt-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-primary hover:text-black transition-all disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />{' '}
              {isSyncing ? 'СИНХРОНИЗАЦИЯ...' : 'Синхронизировать Каталоги'}
            </button>
          )}
        </div>
      </section>

      {/* Viktor Voice Control */}
      <section className="mb-10">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 px-1">
          Персона Виктора
        </h3>
        <div className="premium-card border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl transition-all ${user?.voiceEnabled ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-zinc-500/10 text-zinc-500'}`}
              >
                {user?.voiceEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-black italic tracking-tight uppercase transition-colors">
                  Голосовые Ответы
                </h4>
                <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5 max-w-[180px]">
                  Виктор будет отвечать аудио-сообщениями в Telegram
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const newValue = !user?.voiceEnabled;
                hapticFeedback(newValue ? 'success' : 'light');
                setVoiceEnabled(newValue);
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${user?.voiceEnabled ? 'bg-emerald-500' : 'bg-zinc-800'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md ${user?.voiceEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Sentinel Security Panel */}
      <section className="mb-10">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 px-1">
          Алгоритмы Защиты Sentinel
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            onClick={() => handleDefenseModeChange('price_correction')}
            className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-3 ${defenseMode === 'price_correction' ? 'bg-violet-500/10 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.1)]' : 'bg-white/2 border-white/5 opacity-60'}`}
          >
            <RefreshCcw
              className={`w-6 h-6 ${defenseMode === 'price_correction' ? 'text-violet-400' : 'text-zinc-600'}`}
            />
            <div>
              <h4 className="text-xs font-black tracking-tight uppercase">Коррекция</h4>
              <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 leading-tight">
                Мгновенный возврат к Стоп-Лоссу
              </p>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            onClick={() => handleDefenseModeChange('zero_stock')}
            className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-3 ${defenseMode === 'zero_stock' ? 'bg-red-500/5 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : 'bg-white/2 border-white/5 opacity-60'}`}
          >
            <MinusCircle
              className={`w-6 h-6 ${defenseMode === 'zero_stock' ? 'text-red-500' : 'text-zinc-600'}`}
            />
            <div>
              <h4 className="text-xs font-black tracking-tight uppercase">Заморозка</h4>
              <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 leading-tight">
                Обнуление остатков при демпинге
              </p>
            </div>
          </motion.button>
        </div>

        {/* Advanced Sliders */}
        <div className="premium-card border-white/5">
          <header className="flex items-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Буферы Безопасности
            </span>
          </header>

          <div className="space-y-6 text-left">
            <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  БУФЕР ЦЕНЫ
                </span>
                <span className="text-[8px] text-zinc-600 font-bold uppercase">
                  Допуск для СПП и акций
                </span>
              </div>
              <span className="font-mono text-xl font-bold text-violet-400">
                {user?.priceBufferPercent ?? 5}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={user?.priceBufferPercent ?? 5}
              onChange={e => {
                hapticFeedback('light');
                setUser({ ...user!, priceBufferPercent: Number(e.target.value) });
              }}
              onMouseUp={() =>
                settingsApi.updateSettings({ priceBufferPercent: user?.priceBufferPercent })
              }
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />

            <p className="text-[9px] text-zinc-500 font-medium leading-relaxed italic border-l-2 border-violet-500/30 pl-3">
              Интеллектуальный буфер Sentinel предотвращает ложные срабатывания при временных
              колебаниях скидок маркетплейса.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription & Security */}
      <section className="space-y-4">
        <SecurityBadge />
        <div className="premium-card flex flex-col gap-5 border-success/20 bg-linear-to-br from-success/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/10 text-success">
                <Crown className="w-5 h-5 shadow-[0_0_10px_var(--color-success)]" />
              </div>
              <div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">
                  Ваш Тариф
                </span>
                <span className="text-sm font-black italic uppercase text-white">
                  {user?.subscriptionPlan || 'FREE'} PLAN
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-success text-black font-black tracking-widest uppercase">
                АКТИВЕН
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate?.('subscription')}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            УПРАВЛЕНИЕ ПОДПИСКОЙ <CreditCard className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Modal - Account Edit (Premium Styled) */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-xl p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md premium-card p-8 border-primary/30 bg-surface relative"
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/10 rounded-full sm:hidden" />

              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">
                  {editingAccount.id ? 'Настройка Аккаунта' : 'Новое Подключение'}
                </h3>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label="Закрыть"
                >
                  <Plus className="w-5 h-5 rotate-45 text-zinc-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">
                    Название Профиля
                  </label>
                  <input
                    type="text"
                    value={editingAccount.name || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="w-full bg-white/2 border border-white/5 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-colors"
                    placeholder="Напр: Основной Склад"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">
                    Платформа
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['wb', 'ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setEditingAccount({ ...editingAccount, marketplace: m })}
                        className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${editingAccount.marketplace === m ? 'bg-primary border-primary/50 text-black shadow-[0_10px_20px_var(--color-primary-dim)]' : 'bg-white/2 border-white/5 text-zinc-500'}`}
                      >
                        {m === 'wb' ? 'Wildberries' : 'Ozon'}
                      </button>
                    ))}
                  </div>
                </div>

                {editingAccount.marketplace === 'ozon' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">
                      Ozon Client ID
                    </label>
                    <input
                      type="text"
                      value={editingAccount.ozon_client_id || ''}
                      onChange={e =>
                        setEditingAccount({ ...editingAccount, ozon_client_id: e.target.value })
                      }
                      className="w-full bg-white/2 border border-white/5 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-colors"
                      placeholder="Напр: 12345678"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">
                    {editingAccount.marketplace === 'ozon'
                      ? 'Ozon API Key'
                      : 'Секретный Токен (WB)'}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={
                        editingAccount.marketplace === 'ozon'
                          ? editingAccount.ozon_api_key || ''
                          : editingAccount.wb_token || ''
                      }
                      onChange={e =>
                        setEditingAccount({
                          ...editingAccount,
                          [editingAccount.marketplace === 'ozon' ? 'ozon_api_key' : 'wb_token']:
                            e.target.value,
                        })
                      }
                      className="w-full bg-white/2 border border-white/5 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-success/40 transition-colors"
                      placeholder="••••••••••••••••"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Shield className="w-4 h-4 text-zinc-700" />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveAccount}
                disabled={isSaving}
                className="w-full py-5 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl mt-12 hover:bg-success transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                {isSaving ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    АКТИВИРОВАТЬ СВЯЗЬ <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
