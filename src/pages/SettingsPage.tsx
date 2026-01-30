// ============================================
// NeuroGUARDIAN — Settings Page v2.0
// Aesthetic: System Core | Security Hub
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trash2,
  Edit3,
  Shield,
  CreditCard,
  RefreshCcw,
  Store,
  CheckCircle2,
  Crown,
  Volume2,
  VolumeX,
  X,
  Key,
  Package,
  Cpu,
  Fingerprint,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { AccountCardSkeleton } from '../components/ui/Skeleton';
import {
  settingsApi,
  marketplaceAccountsApi,
  productsApi,
  type MarketplaceAccount,
} from '../lib/api';
import type { DefenseMode } from '../types';

export function SettingsPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}) {
  const { user, defenseMode, setUser, setVoiceEnabled } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; count: number } | null>(null);

  // Multi-account state
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<MarketplaceAccount>>({});
  const [showHelp, setShowHelp] = useState<'wb' | 'ozon' | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await marketplaceAccountsApi.getAccounts();
      if (res.success) setAccounts(res.accounts);
    } catch (e) {
      console.error('Load Accounts Error:', e);
    } finally {
      setIsLoading(false);
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
        isActive: editingAccount.is_active ?? true,
      };
      const res = await marketplaceAccountsApi.saveAccount(payload);
      if (res.success) {
        hapticFeedback('success');
        setShowAccountModal(false);
        setEditingAccount({});
        loadAccounts();
      }
    } catch {
      hapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    hapticFeedback('medium');
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const [wbResult, ozonResult] = await Promise.all([
        productsApi.syncProducts('WB').catch(() => ({ count: 0 })),
        productsApi.syncProducts('Ozon').catch(() => ({ count: 0 })),
      ]);
      const total = (wbResult.count || 0) + (ozonResult.count || 0);
      setSyncResult({ success: true, count: total });
      hapticFeedback('success');
    } catch {
      setSyncResult({ success: false, count: 0 });
      hapticFeedback('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDefenseModeChange = (mode: DefenseMode) => {
    hapticFeedback('medium');
    useAppStore.getState().setDefenseMode(mode);
    settingsApi.updateSettings({ defenseMode: mode });
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Удалить этот аккаунт?')) return;
    try {
      await marketplaceAccountsApi.deleteAccount(id);
      hapticFeedback('success');
      loadAccounts();
    } catch {
      hapticFeedback('error');
    }
  };

  return (
    <div className="min-h-full bg-background font-display relative overflow-x-hidden pb-32">
      <div className="aura-layer" />

      {/* Header */}
      <header className="sticky top-0 z-40 glass-nav border-b border-black/5 px-4 py-4">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => {
              hapticFeedback('light');
              onBack();
            }}
            className="size-10 flex items-center justify-center rounded-xl fused-card border border-black/5 active:scale-90 transition-transform"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-black tracking-tight text-text-main">Настройки</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto relative z-10">
        {/* API Connections Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-black/5 flex items-center justify-center text-black/40">
                <Key size={14} />
              </div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Магистрали данных
              </h2>
            </div>
            <button
              onClick={() => {
                setEditingAccount({
                  marketplace: 'wb',
                  name: 'Wildberries',
                  is_active: true,
                  wb_token: '',
                  ozon_client_id: '',
                  ozon_api_key: '',
                });
                setShowAccountModal(true);
              }}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity"
            >
              + Подключить
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </div>
          ) : accounts.length === 0 ? (
            <div className="fused-card p-10 text-center flex flex-col items-center">
              <div className="size-16 rounded-3xl bg-black/3 flex items-center justify-center mb-4 text-black/10">
                <Cpu size={32} />
              </div>
              <h3 className="text-sm font-black text-black/80">Пустые каналы</h3>
              <p className="text-[10px] font-medium text-black/40 mt-2 max-w-[200px]">
                Подключите API ключи для начала работы Sentinel.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="fused-card p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`size-12 rounded-2xl flex items-center justify-center shadow-inner ${acc.marketplace === 'wb' ? 'bg-[#7000FF]/10 text-[#7000FF]' : 'bg-[#005BFF]/10 text-[#005BFF]'}`}
                    >
                      <Store size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-black/80">{acc.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${acc.is_active ? 'bg-peace-green/10 text-peace-green' : 'bg-black/5 text-black/30'}`}
                        >
                          {acc.is_active ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-[8px] font-black text-black/20 uppercase tracking-tighter">
                          {acc.marketplace}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingAccount({
                          ...acc,
                          wb_token: acc.wb_token === '***' ? '' : acc.wb_token,
                          ozon_api_key: acc.ozon_api_key === '***' ? '' : acc.ozon_api_key,
                          ozon_client_id: acc.ozon_client_id === '***' ? '' : acc.ozon_client_id,
                        });
                        setShowAccountModal(true);
                      }}
                      className="size-9 flex items-center justify-center rounded-xl hover:bg-black/5 text-black/20 hover:text-black transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="size-9 flex items-center justify-center rounded-xl hover:bg-toxic-orange/10 text-black/20 hover:text-toxic-orange transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {accounts.length > 0 && (
            <button
              disabled={isSyncing}
              onClick={handleSync}
              className="w-full h-12 rounded-2xl bg-black text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all"
            >
              <RefreshCcw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Синхронизация потоков...' : 'Синхронизировать данные'}
            </button>
          )}

          <AnimatePresence>
            {syncResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 rounded-2xl flex items-center gap-3 border ${syncResult.success ? 'bg-peace-green/5 border-peace-green/10 text-peace-green' : 'bg-toxic-orange/5 border-toxic-orange/10 text-toxic-orange'}`}
              >
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-tight">
                  {syncResult.success
                    ? `Успех: ${syncResult.count} объектов обработано`
                    : 'Ошибка в магистрали данных'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Sentinel Mode Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="size-6 rounded-lg bg-black/5 flex items-center justify-center text-black/40">
              <Shield size={14} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-black/40">
              Режим Sentinel
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDefenseModeChange('price_correction')}
              className={`p-4 rounded-[24px] border transition-all text-left relative overflow-hidden fused-card ${defenseMode === 'price_correction' ? 'ring-2 ring-primary border-transparent' : 'border-black/5'}`}
            >
              {defenseMode === 'price_correction' && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-primary animate-ping" />
              )}
              <RefreshCcw
                size={20}
                className={`mb-3 ${defenseMode === 'price_correction' ? 'text-primary' : 'text-black/20'}`}
              />
              <h4 className="text-[11px] font-black text-black/80 uppercase">Коррекция</h4>
              <p className="text-[9px] font-medium text-black/40 mt-1 leading-tight">
                Сброс цены до минимума при атаке
              </p>
            </button>

            <button
              onClick={() => handleDefenseModeChange('zero_stock')}
              className={`p-4 rounded-[24px] border transition-all text-left relative overflow-hidden fused-card ${defenseMode === 'zero_stock' ? 'ring-2 ring-toxic-orange border-transparent' : 'border-black/5'}`}
            >
              {defenseMode === 'zero_stock' && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-toxic-orange animate-ping" />
              )}
              <Package
                size={20}
                className={`mb-3 ${defenseMode === 'zero_stock' ? 'text-toxic-orange' : 'text-black/20'}`}
              />
              <h4 className="text-[11px] font-black text-black/80 uppercase">Заморозка</h4>
              <p className="text-[9px] font-medium text-black/40 mt-1 leading-tight">
                Обнуление остатков при демпинге
              </p>
            </button>
          </div>

          <div className="fused-card p-4 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h4 className="text-xs font-black text-black/80 uppercase tracking-tighter">
                  Буфер безопасности
                </h4>
                <p className="text-[10px] font-medium text-black/40">Допуск для акций и СПП</p>
              </div>
              <span className="text-xl font-black text-primary">
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
              className="w-full h-1.5 bg-black/5 rounded-full appearance-none cursor-pointer accent-black"
            />
          </div>
        </section>

        {/* System Interface Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="size-6 rounded-lg bg-black/5 flex items-center justify-center text-black/40">
              <Fingerprint size={14} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-black/40">
              Интерфейс системы
            </h2>
          </div>

          <div className="fused-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`size-10 rounded-xl flex items-center justify-center ${user?.voiceEnabled ? 'bg-peace-green/10 text-peace-green' : 'bg-black/5 text-black/20'}`}
              >
                {user?.voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <div>
                <h4 className="text-xs font-black text-black/80 uppercase tracking-tighter">
                  Нейро-голос
                </h4>
                <p className="text-[10px] font-medium text-black/40">Голосовые ответы Виктора</p>
              </div>
            </div>
            <button
              onClick={() => {
                const newValue = !user?.voiceEnabled;
                hapticFeedback(newValue ? 'success' : 'light');
                setVoiceEnabled(newValue);
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${user?.voiceEnabled ? 'bg-black' : 'bg-black/5'}`}
            >
              <div
                className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all ${user?.voiceEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </section>

        {/* Subscription Block */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="size-6 rounded-lg bg-black/5 flex items-center justify-center text-black/40">
              <Zap size={14} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-black/40">
              Уровень доступа
            </h2>
          </div>

          <div className="fused-card p-5 bg-black text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Crown size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Текущий тариф
                  </span>
                  <h4 className="text-2xl font-black italic tracking-tighter mt-1">
                    {user?.subscriptionPlan?.toUpperCase() || 'CORE'} PLATFORM
                  </h4>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-peace-green text-black">
                  Active
                </span>
              </div>
              <button
                onClick={() => onNavigate?.('subscription')}
                className="w-full h-11 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <CreditCard size={14} /> Управление подпиской
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Account Modal (Tactical) */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-black/5">
                <h3 className="text-base font-black text-black uppercase tracking-tight">
                  {editingAccount.id ? 'Апгрейд канала' : 'Новый канал'}
                </h3>
                <button
                  onClick={() => {
                    setShowAccountModal(false);
                    setEditingAccount({});
                  }}
                  className="size-10 flex items-center justify-center rounded-xl bg-black/5 text-black/40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30 mb-2 block">
                    Тип площадки
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['wb', 'ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() =>
                          setEditingAccount({
                            ...editingAccount,
                            marketplace: m,
                            name: m === 'wb' ? 'Wildberries' : 'Ozon',
                          })
                        }
                        className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${editingAccount.marketplace === m ? 'border-black bg-black text-white' : 'border-black/5 text-black/40 hover:border-black/20'}`}
                      >
                        <Store size={24} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block">
                    ID Имя
                  </label>
                  <input
                    type="text"
                    value={editingAccount.name || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="w-full h-12 bg-black/3 border border-black/5 rounded-2xl px-4 text-xs font-black focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                    placeholder="Название аккаунта..."
                  />
                </div>

                {editingAccount.marketplace === 'wb' && (
                  <div className="space-y-4 pt-4 border-t border-black/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">
                        WB API Token
                      </label>
                      <button
                        onClick={() => setShowHelp('wb')}
                        className="text-[9px] font-black uppercase text-primary"
                      >
                        Помощь
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={editingAccount.wb_token || ''}
                      onChange={e =>
                        setEditingAccount({ ...editingAccount, wb_token: e.target.value })
                      }
                      className="w-full bg-black/3 border border-black/5 rounded-2xl p-4 text-[10px] font-mono focus:bg-white outline-none transition-all resize-none"
                      placeholder={editingAccount.id ? '••••••••••••••••' : 'Вставьте токен WB...'}
                    />
                  </div>
                )}

                {editingAccount.marketplace === 'ozon' && (
                  <div className="space-y-4 pt-4 border-t border-black/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/30">
                        Ozon Credentials
                      </label>
                      <button
                        onClick={() => setShowHelp('ozon')}
                        className="text-[9px] font-black uppercase text-primary"
                      >
                        Помощь
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingAccount.ozon_client_id || ''}
                        onChange={e =>
                          setEditingAccount({ ...editingAccount, ozon_client_id: e.target.value })
                        }
                        className="w-full h-12 bg-black/3 border border-black/5 rounded-2xl px-4 text-xs font-black focus:bg-white outline-none transition-all"
                        placeholder="Client ID..."
                      />
                      <input
                        type="password"
                        value={editingAccount.ozon_api_key || ''}
                        onChange={e =>
                          setEditingAccount({ ...editingAccount, ozon_api_key: e.target.value })
                        }
                        className="w-full h-12 bg-black/3 border border-black/5 rounded-2xl px-4 text-xs font-black focus:bg-white outline-none transition-all"
                        placeholder={editingAccount.id ? '••••••••' : 'API Key...'}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-black/3">
                <button
                  onClick={handleSaveAccount}
                  disabled={isSaving}
                  className="w-full h-14 rounded-[20px] bg-black text-white flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-black/20"
                >
                  {isSaving ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {editingAccount.id ? 'Commit Update' : 'Initialize Channel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 size-32 bg-primary/5 rounded-full" />
              <h3 className="text-lg font-black text-black uppercase tracking-tight mb-4 relative z-10">
                Протокол подключения
              </h3>
              <div className="space-y-4 text-[11px] font-medium text-black/50 relative z-10">
                {showHelp === 'wb' ? (
                  <>
                    <p>
                      <span className="font-black text-black">01.</span> ЛК WB → Настройки → Доступ
                      к API
                    </p>
                    <p>
                      <span className="font-black text-black">02.</span> Создать токен (Категории:
                      Цены и Скидки)
                    </p>
                    <p>
                      <span className="font-black text-black">03.</span> Скопировать хеш и вставить
                      в Sentinel
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="font-black text-black">01.</span> Seller Ozon → Настройки →
                      API ключи
                    </p>
                    <p>
                      <span className="font-black text-black">02.</span> Создать "Admin" токен для
                      системы
                    </p>
                    <p>
                      <span className="font-black text-black">03.</span> Взять Client ID и Key со
                      страницы
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowHelp(null)}
                className="w-full h-12 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-widest mt-8"
              >
                Понятно
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
