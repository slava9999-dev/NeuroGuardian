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
import { settingsApi, marketplaceAccountsApi, type MarketplaceAccount } from '../lib/api';
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
    <div className="min-h-screen bg-black text-white px-5 py-6 pb-32 bg-cosmic overflow-x-hidden">
      {/* Glow Spots */}
      <div className="nebula-glow opacity-30" />

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
            <p className="text-[10px] mono-data text-zinc-500 uppercase tracking-[0.2em]">
              {user?.username ? `@${user.username}` : 'Стратегический Оператор'}
            </p>
          </div>
        </div>
      </section>

      {/* Marketplace Hub */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
            Хаб Маркетплейсов
          </h3>
          <button
            onClick={() => {
              setEditingAccount({ marketplace: 'wb', is_active: true });
              setShowAccountModal(true);
            }}
            className="flex items-center gap-2 text-[10px] font-black text-emerald-400 hover:text-white transition-all uppercase tracking-widest"
          >
            <Plus className="w-3 h-3" /> Добавить Аккаунт
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
                    <span className="text-[9px] mono-data text-zinc-500 uppercase">
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
        </div>
      </section>

      {/* Viktor Voice Control */}
      <section className="mb-10">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 px-1">
          Личность Виктора
        </h3>
        <div className="premium-card border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${user?.voiceEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-500'}`}
              >
                {user?.voiceEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-black italic tracking-tight uppercase">
                  Голосовые Ответы
                </h4>
                <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">
                  Виктор будет отвечать голосовыми сообщениями
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
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user?.voiceEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Sentinel Security Panel */}
      <section className="mb-10">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 px-1">
          Тактика Sentinel
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            onClick={() => handleDefenseModeChange('price_correction')}
            className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-3 ${defenseMode === 'price_correction' ? 'bg-violet-500/10 border-violet-500/50' : 'bg-white/2 border-white/5 opacity-60'}`}
          >
            <RefreshCcw
              className={`w-6 h-6 ${defenseMode === 'price_correction' ? 'text-violet-400' : 'text-zinc-600'}`}
            />
            <div>
              <h4 className="text-xs font-black tracking-tight uppercase">Коррекция</h4>
              <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">
                Принудительная минимальная цена
              </p>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            onClick={() => handleDefenseModeChange('zero_stock')}
            className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-3 ${defenseMode === 'zero_stock' ? 'bg-red-500/5 border-red-500/50' : 'bg-white/2 border-white/5 opacity-60'}`}
          >
            <MinusCircle
              className={`w-6 h-6 ${defenseMode === 'zero_stock' ? 'text-red-500' : 'text-zinc-600'}`}
            />
            <div>
              <h4 className="text-xs font-black tracking-tight uppercase">Экстренная Остановка</h4>
              <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">
                Обнуление остатков
              </p>
            </div>
          </motion.button>
        </div>

        {/* Advanced Sliders */}
        <div className="premium-card border-white/5 space-y-8">
          <header className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Буферы Безопасности
            </span>
          </header>

          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Буфер Скидки</span>
                <span className="text-[8px] text-zinc-600 font-bold uppercase">
                  Учет СПП и карт лояльности
                </span>
              </div>
              <span className="mono-data text-xl text-violet-400">
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
            <p className="text-[9px] text-zinc-600 italic">
              Sentinel будет использовать этот процент как страховку от динамических скидок
              площадок.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription & Security */}
      <section className="space-y-4">
        <SecurityBadge />
        <div className="premium-card flex flex-col gap-4 border-lime-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black italic">
                {user?.subscriptionPlan?.toUpperCase() || 'FREE'} PLAN
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/20 font-bold tracking-widest uppercase">
              ACTIVE
            </span>
          </div>
          <button
            onClick={() => onNavigate?.('subscription')}
            className="w-full py-4 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
          >
            Управление Подпиской <CreditCard className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Modal - Account Edit (Premium Styled) */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-md premium-card p-8 border-indigo-500/30"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black italic tracking-tighter uppercase">
                  {editingAccount.id ? 'Редактировать Аккаунт' : 'Инициализировать Аккаунт'}
                </h3>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="text-zinc-600 hover:text-white uppercase text-[10px] font-black tracking-widest"
                >
                  Закрыть
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Название Магазина
                  </label>
                  <input
                    type="text"
                    value={editingAccount.name || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="w-full bg-white/2 border border-white/5 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-violet-500"
                    placeholder="e.g. ALPHA STORE"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Платформа
                  </label>
                  <div className="flex gap-2">
                    {['wb', 'ozon'].map(m => (
                      <button
                        key={m}
                        onClick={() =>
                          setEditingAccount({ ...editingAccount, marketplace: m as any })
                        }
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingAccount.marketplace === m ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' : 'bg-white/5 text-zinc-500'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Безопасные Ключи
                  </label>
                  <input
                    type="password"
                    value={
                      editingAccount.marketplace === 'ozon'
                        ? editingAccount.ozon_api_key
                        : editingAccount.wb_token || ''
                    }
                    onChange={e =>
                      setEditingAccount({
                        ...editingAccount,
                        [editingAccount.marketplace === 'ozon' ? 'ozon_api_key' : 'wb_token']:
                          e.target.value,
                      })
                    }
                    className="w-full bg-white/2 border border-white/5 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-indigo-500"
                    placeholder="••••••••••••••••"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveAccount}
                className="w-full py-5 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl mt-10 hover:bg-emerald-400 transition-all flex items-center justify-center gap-3"
              >
                {isSaving ? (
                  'Обработка...'
                ) : (
                  <>
                    Авторизовать <CheckCircle2 className="w-4 h-4" />
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
