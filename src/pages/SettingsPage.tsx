// ============================================
// NeuroGUARDIAN — Settings Page V7.0 (Warm Light)
// Clear UX: Easy API key input, sync feedback
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
  Crown,
  Volume2,
  VolumeX,
  X,
  Key,
  AlertCircle,
  Package,
  HelpCircle,
} from 'lucide-react';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
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
      alert('Ошибка сохранения. Проверьте данные.');
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
    <div className="min-h-full bg-page px-5 py-6 pb-32" role="main">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-surface border border-surface-dim hover:border-primary transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold text-text-main">Настройки</h1>
      </header>

      {/* ============================================
          SECTION 1: API KEYS (MAIN FOCUS)
          ============================================ */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">🔑 Ключи маркетплейсов</h2>
          <button
            onClick={() => {
              setEditingAccount({ marketplace: 'wb', is_active: true });
              setShowAccountModal(true);
            }}
            className="btn btn-ghost text-xs"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>

        {/* Empty State */}
        {accounts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning-soft flex items-center justify-center">
              <Key className="w-8 h-8 text-warning" />
            </div>
            <h3 className="font-semibold text-text-main mb-2">Подключите маркетплейс</h3>
            <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
              Добавьте API-ключи Wildberries или Ozon, чтобы синхронизировать товары и включить
              защиту цен
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setEditingAccount({ marketplace: 'wb', is_active: true });
                  setShowAccountModal(true);
                }}
                className="btn btn-primary"
              >
                <Store className="w-4 h-4" />
                Wildberries
              </button>
              <button
                onClick={() => {
                  setEditingAccount({ marketplace: 'ozon', is_active: true });
                  setShowAccountModal(true);
                }}
                className="btn btn-secondary"
              >
                <Store className="w-4 h-4" />
                Ozon
              </button>
            </div>
          </motion.div>
        )}

        {/* Account Cards */}
        <div className="space-y-3">
          {accounts.map(acc => (
            <motion.div key={acc.id} layout className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    acc.marketplace === 'wb'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-text-main">{acc.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge ${acc.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {acc.is_active ? 'Активен' : 'Отключен'}
                    </span>
                    <span className="text-xs text-text-muted uppercase">
                      {acc.marketplace === 'wb' ? 'Wildberries' : 'Ozon'}
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
                  className="p-2 rounded-lg hover:bg-surface-hl text-text-muted hover:text-primary transition-colors"
                  aria-label="Редактировать"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="p-2 rounded-lg hover:bg-danger-soft text-text-muted hover:text-danger transition-colors"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sync Button */}
        {accounts.length > 0 && (
          <motion.div layout className="mt-4">
            <button
              disabled={isSyncing}
              onClick={handleSync}
              className="w-full btn btn-primary py-4 text-sm"
            >
              <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Синхронизация...' : 'Синхронизировать товары'}
            </button>

            {/* Sync Result */}
            <AnimatePresence>
              {syncResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 p-4 rounded-xl flex items-center gap-3 ${
                    syncResult.success
                      ? 'bg-success-soft border border-success/20'
                      : 'bg-danger-soft border border-danger/20'
                  }`}
                >
                  {syncResult.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      <div>
                        <span className="font-semibold text-success">
                          Синхронизировано успешно!
                        </span>
                        <p className="text-sm text-text-secondary mt-0.5">
                          Загружено товаров: <strong>{syncResult.count}</strong>
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-danger shrink-0" />
                      <span className="font-semibold text-danger">
                        Ошибка синхронизации. Проверьте ключи.
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ============================================
          SECTION 2: DEFENSE SETTINGS
          ============================================ */}
      <section className="mb-8">
        <h2 className="section-title">🛡️ Защита Sentinel</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => handleDefenseModeChange('price_correction')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              defenseMode === 'price_correction'
                ? 'border-primary bg-primary-dim shadow-md'
                : 'border-surface-dim bg-surface hover:border-primary/30'
            }`}
          >
            <RefreshCcw
              className={`w-6 h-6 mb-2 ${
                defenseMode === 'price_correction' ? 'text-primary' : 'text-text-muted'
              }`}
            />
            <h4 className="font-semibold text-text-main text-sm">Коррекция цены</h4>
            <p className="text-xs text-text-muted mt-1">Возврат к минимуму при демпинге</p>
          </button>

          <button
            onClick={() => handleDefenseModeChange('zero_stock')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              defenseMode === 'zero_stock'
                ? 'border-danger bg-danger-soft shadow-md'
                : 'border-surface-dim bg-surface hover:border-danger/30'
            }`}
          >
            <Package
              className={`w-6 h-6 mb-2 ${
                defenseMode === 'zero_stock' ? 'text-danger' : 'text-text-muted'
              }`}
            />
            <h4 className="font-semibold text-text-main text-sm">Заморозка</h4>
            <p className="text-xs text-text-muted mt-1">Обнуление остатков при угрозе</p>
          </button>
        </div>

        {/* Price Buffer Slider */}
        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="font-semibold text-text-main text-sm">Буфер цены</span>
              <p className="text-xs text-text-muted">Допуск для СПП и акций</p>
            </div>
            <span className="text-2xl font-bold text-primary">
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
            onTouchEnd={() =>
              settingsApi.updateSettings({ priceBufferPercent: user?.priceBufferPercent })
            }
            className="w-full h-2 bg-surface-hl rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </section>

      {/* ============================================
          SECTION 3: VOICE SETTINGS
          ============================================ */}
      <section className="mb-8">
        <h2 className="section-title">🎙️ Голос Виктора</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  user?.voiceEnabled
                    ? 'bg-success-soft text-success'
                    : 'bg-surface-hl text-text-muted'
                }`}
              >
                {user?.voiceEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-text-main">Голосовые ответы</h4>
                <p className="text-xs text-text-muted">Виктор будет отвечать аудио в Telegram</p>
              </div>
            </div>
            <button
              onClick={() => {
                const newValue = !user?.voiceEnabled;
                hapticFeedback(newValue ? 'success' : 'light');
                setVoiceEnabled(newValue);
              }}
              className={`w-12 h-7 rounded-full transition-all relative ${
                user?.voiceEnabled ? 'bg-success' : 'bg-surface-dim'
              }`}
              role="switch"
              aria-checked={user?.voiceEnabled}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                  user?.voiceEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================
          SECTION 4: SUBSCRIPTION
          ============================================ */}
      <section className="mb-8">
        <h2 className="section-title">👑 Подписка</h2>
        <div className="card p-4 bg-gradient-to-br from-primary-dim to-surface">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary text-white">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-text-muted">Ваш тариф</span>
                <h4 className="font-bold text-text-main uppercase">
                  {user?.subscriptionPlan || 'FREE'}
                </h4>
              </div>
            </div>
            <span className="badge badge-success">Активен</span>
          </div>
          <button onClick={() => onNavigate?.('subscription')} className="w-full btn btn-secondary">
            <CreditCard className="w-4 h-4" />
            Управление подпиской
          </button>
        </div>
      </section>

      {/* ============================================
          MODAL: ADD/EDIT ACCOUNT
          ============================================ */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-surface-dim">
                <h3 className="text-lg font-bold text-text-main">
                  {editingAccount.id ? 'Редактировать аккаунт' : 'Добавить маркетплейс'}
                </h3>
                <button
                  onClick={() => {
                    setShowAccountModal(false);
                    setEditingAccount({});
                  }}
                  className="p-2 rounded-lg hover:bg-surface-hl transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5">
                {/* Marketplace Selection */}
                <div>
                  <label className="input-label">Маркетплейс</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['wb', 'ozon'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditingAccount({ ...editingAccount, marketplace: m })}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                          editingAccount.marketplace === m
                            ? 'border-primary bg-primary-dim font-semibold'
                            : 'border-surface-dim hover:border-primary/30'
                        }`}
                      >
                        <Store className="w-4 h-4" />
                        {m === 'wb' ? 'Wildberries' : 'Ozon'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Profile Name */}
                <div>
                  <label className="input-label">Название профиля</label>
                  <input
                    type="text"
                    value={editingAccount.name || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="input"
                    placeholder="Например: Основной склад"
                  />
                  <p className="input-hint">Для удобства идентификации</p>
                </div>

                {/* Ozon Client ID (only for Ozon) */}
                {editingAccount.marketplace === 'ozon' && (
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="input-label mb-0">Client ID</label>
                      <button
                        type="button"
                        onClick={() => setShowHelp('ozon')}
                        className="text-text-muted hover:text-primary"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingAccount.ozon_client_id || ''}
                      onChange={e =>
                        setEditingAccount({ ...editingAccount, ozon_client_id: e.target.value })
                      }
                      className="input mt-1"
                      placeholder="Например: 123456"
                    />
                  </div>
                )}

                {/* API Key */}
                <div>
                  <div className="flex items-center gap-2">
                    <label className="input-label mb-0">
                      {editingAccount.marketplace === 'ozon' ? 'API Key' : 'API Token'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowHelp(editingAccount.marketplace || 'wb')}
                      className="text-text-muted hover:text-primary"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative mt-1">
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
                      className="input pr-10"
                      placeholder="Вставьте ключ сюда..."
                    />
                    <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  </div>
                  <p className="input-hint flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Ключ шифруется и хранится безопасно
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-surface-dim bg-surface-warm">
                <button
                  onClick={handleSaveAccount}
                  disabled={isSaving || !editingAccount.name}
                  className="w-full btn btn-primary py-4"
                >
                  {isSaving ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {editingAccount.id ? 'Сохранить изменения' : 'Подключить аккаунт'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="font-bold text-lg text-text-main mb-3">
                Где взять {showHelp === 'wb' ? 'API Token' : 'ключи Ozon'}?
              </h3>
              {showHelp === 'wb' ? (
                <div className="text-sm text-text-secondary space-y-2">
                  <p>1. Зайдите в личный кабинет Wildberries</p>
                  <p>
                    2. Перейдите в <strong>Настройки → Доступ к API</strong>
                  </p>
                  <p>3. Нажмите "Создать токен" с доступом к ценам</p>
                  <p>4. Скопируйте и вставьте сюда</p>
                </div>
              ) : (
                <div className="text-sm text-text-secondary space-y-2">
                  <p>1. Зайдите в seller.ozon.ru</p>
                  <p>
                    2. Перейдите в <strong>Настройки → API-ключи</strong>
                  </p>
                  <p>3. Создайте ключ с правами на товары и цены</p>
                  <p>4. Client ID и API Key вставьте в соответствующие поля</p>
                </div>
              )}
              <button onClick={() => setShowHelp(null)} className="w-full btn btn-secondary mt-5">
                Понятно
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
