// ============================================
// NeuroAgent — Settings Page
// User settings, API keys, and sync
// ============================================

import { useState, useEffect } from 'react';
import { useAppStore, useProductsStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';
import { PaymentModal } from '../components/ui/PaymentModal';
import {
  settingsApi,
  productsApi,
  marketplaceAccountsApi,
  type MarketplaceAccount,
} from '../lib/api';
import { SecurityBadge } from '../components/ui/SecurityBadge';
import type { DefenseMode, Product } from '../types';

export function SettingsPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}) {
  const { user, defenseMode, setDefenseMode, setUser } = useAppStore();
  const { setProducts } = useProductsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showApiModal, setShowApiModal] = useState<'WB' | 'Ozon' | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
      if (res.success) {
        setAccounts(res.accounts);
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    }
  };

  const handleSaveAccount = async () => {
    if (!editingAccount.name || !editingAccount.marketplace) {
      alert('Заполните обязательные поля');
      return;
    }

    // Debug: log what we're about to send
    const payload = {
      id: editingAccount.id,
      name: editingAccount.name,
      marketplace: editingAccount.marketplace,
      wbApiKey: editingAccount.wb_token, // Mapping from UI state to API payload
      ozonClientId: editingAccount.ozon_client_id,
      ozonApiKey: editingAccount.ozon_api_key,
      isActive: editingAccount.is_active,
    };

    console.log('[SettingsPage] Saving account, payload:', {
      ...payload,
      wbApiKey: payload.wbApiKey ? '***SET***' : 'EMPTY',
      ozonApiKey: payload.ozonApiKey ? '***SET***' : 'EMPTY',
    });

    setIsSaving(true);
    try {
      const res = await marketplaceAccountsApi.saveAccount(payload);

      console.log('[SettingsPage] Save response:', res);

      if (res.success) {
        hapticFeedback('success');
        setShowAccountModal(false);
        setEditingAccount({});
        loadAccounts();
      } else {
        console.error('[SettingsPage] Save failed:', res.error);
        alert('Ошибка: ' + res.error);
      }
    } catch (e) {
      console.error('[SettingsPage] Save exception:', e);
      alert('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Удалить аккаунт?')) return;
    try {
      await marketplaceAccountsApi.deleteAccount(id);
      loadAccounts();
      hapticFeedback('success');
    } catch (e) {
      console.error(e);
      alert('Ошибка удаления');
    }
  };

  const handleDefenseModeChange = async (mode: DefenseMode) => {
    hapticFeedback('light');
    setDefenseMode(mode);

    setIsSaving(true);
    try {
      await settingsApi.updateSettings({ defenseMode: mode });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!showApiModal || !apiKey) return;

    hapticFeedback('medium');
    setIsSaving(true);

    try {
      // For Ozon, combine clientId:apiKey
      const fullKey = showApiModal === 'Ozon' && clientId ? `${clientId}:${apiKey}` : apiKey;

      await settingsApi.saveApiKey(showApiModal, fullKey, clientId);

      // Update local user state
      if (user) {
        setUser({
          ...user,
          [showApiModal === 'WB' ? 'wbKeyRef' : 'ozonKeyRef']: 'configured',
        });
      }

      setShowApiModal(null);
      setApiKey('');
      setClientId('');
      hapticFeedback('success');
    } catch (error) {
      console.error('Error saving API key:', error);
      hapticFeedback('error');
      alert('Ошибка сохранения ключа');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncProducts = async (marketplace: 'WB' | 'Ozon') => {
    hapticFeedback('medium');
    setSyncStatus(`Синхронизация ${marketplace}...`);

    try {
      const result = await productsApi.syncProducts(marketplace);
      setSyncStatus(result.message);

      // Reload products
      const productsResult = await productsApi.getProducts();
      if (productsResult.success && productsResult.products) {
        setProducts(productsResult.products as Product[]);
      }

      hapticFeedback('success');

      // Clear status after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error: unknown) {
      console.error('Sync error:', error);
      const apiError = error as { response?: { data?: { error?: string } }; message?: string };
      setSyncStatus(
        `Ошибка: ${apiError.response?.data?.error || apiError.message || 'Неизвестная ошибка'}`
      );
      hapticFeedback('error');
    }
  };

  const handleDisconnectApi = async (marketplace: 'WB' | 'Ozon') => {
    hapticFeedback('warning');
    alert(`Отключение ${marketplace} API будет реализовано`);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Настройки</h1>
      </header>

      {/* Sync Status */}
      {syncStatus && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm">
          {syncStatus}
        </div>
      )}

      {/* User info */}
      {user && (
        <section className="glass-panel p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center text-stone-900 font-bold text-xl">
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

      {/* Marketplace Accounts (Multi-Account) */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider">
            Аккаунты Маркетплейсов
          </h3>
          <button
            onClick={() => {
              setEditingAccount({ marketplace: 'wb', is_active: true });
              setShowAccountModal(true);
            }}
            className="text-xs uppercase font-bold text-amber-500 hover:text-amber-400"
          >
            + Добавить
          </button>
        </div>

        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="glass-panel p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${acc.marketplace === 'wb' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}
                >
                  <span className="text-sm font-bold">
                    {acc.marketplace === 'wb' ? 'WB' : 'Oz'}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-white">{acc.name}</h4>
                  <p className="text-xs text-stone-400">
                    ID: {acc.id} | {acc.is_active ? 'Активен' : 'Отключен'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingAccount(acc);
                    setShowAccountModal(true);
                  }}
                  className="p-2 rounded-lg bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="p-2 rounded-lg bg-stone-800 text-red-400 hover:text-red-300 hover:bg-stone-700"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="text-center p-4 rounded-xl border border-dashed border-stone-700 text-stone-500 text-sm">
              Нет добавленных аккаунтов. Добавьте аккаунт для работы.
            </div>
          )}
        </div>
      </section>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingAccount.id ? 'Редактировать аккаунт' : 'Добавить аккаунт'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-stone-400 mb-1">Название</label>
                <input
                  type="text"
                  value={editingAccount.name || ''}
                  onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Например: Основной магазин"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Маркетплейс</label>
                <div className="flex gap-2 p-1 bg-stone-800 rounded-xl">
                  {['wb', 'ozon'].map(m => (
                    <button
                      key={m}
                      onClick={() =>
                        !editingAccount.id &&
                        setEditingAccount({ ...editingAccount, marketplace: m as 'wb' | 'ozon' })
                      }
                      disabled={!!editingAccount.id}
                      className={`
                        flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                        ${
                          editingAccount.marketplace === m
                            ? m === 'wb'
                              ? 'bg-purple-500 text-white'
                              : 'bg-blue-500 text-white'
                            : 'text-stone-400 hover:text-white'
                        }
                        ${editingAccount.id ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {m === 'wb' ? 'Wildberries' : 'Ozon'}
                    </button>
                  ))}
                </div>
              </div>

              {(!editingAccount.marketplace || editingAccount.marketplace === 'wb') && (
                <div>
                  <label className="block text-sm text-stone-400 mb-1">API Token (Header)</label>
                  <input
                    type="password"
                    value={editingAccount.wb_token || ''}
                    onChange={e =>
                      setEditingAccount({ ...editingAccount, wb_token: e.target.value })
                    }
                    className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white focus:border-amber-500 focus:outline-none"
                    placeholder={
                      editingAccount.id ? '•••••••• (оставьте пустым)' : 'Вставьте токен'
                    }
                  />
                </div>
              )}

              {editingAccount.marketplace === 'ozon' && (
                <>
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={editingAccount.ozon_client_id || ''}
                      onChange={e =>
                        setEditingAccount({ ...editingAccount, ozon_client_id: e.target.value })
                      }
                      className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={editingAccount.ozon_api_key || ''}
                      onChange={e =>
                        setEditingAccount({ ...editingAccount, ozon_api_key: e.target.value })
                      }
                      className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white focus:border-amber-500 focus:outline-none"
                      placeholder={
                        editingAccount.id ? '•••••••• (оставьте пустым)' : 'Вставьте ключ'
                      }
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingAccount.is_active !== false}
                  onChange={e =>
                    setEditingAccount({ ...editingAccount, is_active: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-stone-700 bg-stone-800 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-sm text-white cursor-pointer select-none">
                  Аккаунт активен (мониторинг включен)
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAccountModal(false)} className="flex-1 btn-secondary">
                Отмена
              </button>
              <button
                onClick={handleSaveAccount}
                className="flex-1 btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected APIs (LEGACY / SINGLE) */}
      <section className="mb-6 opacity-60 hover:opacity-100 transition-opacity">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Legacy (Старое подключение)
        </h3>

        <div className="space-y-3">
          {/* WB */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-3">
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
              <div className="flex items-center gap-2">
                {user?.wbKeyRef ? (
                  <>
                    <button
                      onClick={() => setShowApiModal('WB')}
                      className="text-sm text-purple-400 hover:text-purple-300"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDisconnectApi('WB')}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Отключить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowApiModal('WB')}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
                  >
                    Подключить
                  </button>
                )}
              </div>
            </div>
            {user?.wbKeyRef && (
              <button
                onClick={() => handleSyncProducts('WB')}
                disabled={isSaving}
                className="w-full btn-secondary text-sm"
              >
                🔄 Синхронизировать товары WB
              </button>
            )}
          </div>

          {/* Ozon */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-3">
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
              <div className="flex items-center gap-2">
                {user?.ozonKeyRef ? (
                  <>
                    <button
                      onClick={() => setShowApiModal('Ozon')}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDisconnectApi('Ozon')}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Отключить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowApiModal('Ozon')}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors"
                  >
                    Подключить
                  </button>
                )}
              </div>
            </div>
            {user?.ozonKeyRef && (
              <button
                onClick={() => handleSyncProducts('Ozon')}
                disabled={isSaving}
                className="w-full btn-secondary text-sm"
              >
                🔄 Синхронизировать товары Ozon
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Security Badge */}
      <section className="mb-6">
        <SecurityBadge />
      </section>

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
            <div
              className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              ${defenseMode === 'zero_stock' ? 'bg-amber-500/20' : 'bg-stone-800'}
            `}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={defenseMode === 'zero_stock' ? 'text-amber-400' : 'text-stone-400'}
              >
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
            <div
              className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              ${defenseMode === 'price_correction' ? 'bg-amber-500/20' : 'bg-stone-800'}
            `}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={defenseMode === 'price_correction' ? 'text-amber-400' : 'text-stone-400'}
              >
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

      {/* Price Guard Buffer Settings */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          🛡️ Настройки Sentinel
        </h3>

        <div className="glass-panel p-4 space-y-5">
          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-200">
              <strong>Буфер скидок карт:</strong> Маркетплейсы дают скидки по картам (Ozon Card до
              30%, WB Pay до 6%). Буфер добавляется к минимальной цене, чтобы учесть эти скидки.
            </p>
          </div>

          {/* Price Buffer Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-stone-300">Буфер скидок карт</label>
              <span className="text-amber-400 font-bold">{user?.priceBufferPercent ?? 5}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={user?.priceBufferPercent ?? 5}
              onChange={e => {
                const value = Number(e.target.value);
                if (user) {
                  setUser({ ...user, priceBufferPercent: value });
                }
              }}
              onMouseUp={async () => {
                if (user) {
                  await settingsApi.updateSettings({ priceBufferPercent: user.priceBufferPercent });
                  hapticFeedback('light');
                }
              }}
              onTouchEnd={async () => {
                if (user) {
                  await settingsApi.updateSettings({ priceBufferPercent: user.priceBufferPercent });
                  hapticFeedback('light');
                }
              }}
              className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-xs text-stone-500 mt-1">
              <span>0% (без буфера)</span>
              <span>30% (макс)</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              💡 Рекомендуем 5-10% для базовой защиты, 15-20% если много клиентов с Ozon Card
            </p>
          </div>

          {/* Warning Threshold Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-stone-300">Порог предупреждения</label>
              <span className="text-amber-400 font-bold">
                {user?.warningThresholdPercent ?? 10}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={user?.warningThresholdPercent ?? 10}
              onChange={async e => {
                const value = Number(e.target.value);
                if (user) {
                  setUser({ ...user, warningThresholdPercent: value });
                  await settingsApi.updateSettings({ warningThresholdPercent: value });
                }
              }}
              className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-xs text-stone-500 mt-1">
              <span>5%</span>
              <span>25%</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              ⚠️ Получите предупреждение, когда цена приблизится к лимиту (до срабатывания Sentinel)
            </p>
          </div>

          {/* Example Calculation */}
          <div className="p-3 rounded-xl bg-stone-800/50 border border-stone-700">
            <p className="text-sm text-stone-300">
              <strong>Пример:</strong> min_price = 1000₽, буфер = {user?.priceBufferPercent ?? 5}%
            </p>
            <p className="text-sm text-emerald-400 mt-1">
              → Эффективный минимум:{' '}
              <strong>{Math.round(1000 * (1 + (user?.priceBufferPercent ?? 5) / 100))}₽</strong>
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Sentinel сработает, если цена упадёт ниже этого значения
            </p>
          </div>
        </div>
      </section>

      {/* Subscription */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Подписка
        </h3>

        <div
          className={`
          glass-panel p-4
          ${user?.subscriptionActive ? 'border-emerald-500/30' : 'border-red-500/30'}
        `}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">
              {user?.subscriptionPlan === 'trial'
                ? '🎁 Тест-драйв (7 дней бесплатно)'
                : user?.subscriptionPlan === 'yearly'
                  ? '💎 Годовой Pro'
                  : user?.subscriptionPlan === 'pro'
                    ? '⭐ Pro'
                    : user?.subscriptionPlan === 'basic'
                      ? 'Basic'
                      : 'Нет подписки'}
            </span>
            <span
              className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${user?.subscriptionActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
            `}
            >
              {user?.subscriptionActive ? 'Активна' : 'Неактивна'}
            </span>
          </div>

          {user?.subscriptionExpiresAt && (
            <p className="text-sm text-stone-400">
              Действует до: {new Date(user.subscriptionExpiresAt).toLocaleDateString('ru-RU')}
            </p>
          )}

          {!user?.subscriptionActive && (
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowPayment(true);
              }}
              className="btn-primary w-full mt-4"
            >
              Оформить подписку
            </button>
          )}
        </div>
      </section>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel p-6">
            <h3 className="text-lg font-bold text-white mb-4">Подключить {showApiModal}</h3>

            {showApiModal === 'Ozon' && (
              <div className="mb-4">
                <label className="block text-sm text-stone-400 mb-2">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="Введите Client ID"
                  className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm text-stone-400 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Введите API ключ"
                className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
              <p className="text-xs text-stone-500 mt-2">
                {showApiModal === 'WB'
                  ? 'Получить ключ: Личный кабинет WB → API → Создать токен'
                  : 'Получить: Seller Center → Настройки → API ключи'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApiModal(null);
                  setApiKey('');
                  setClientId('');
                }}
                className="flex-1 btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey || (showApiModal === 'Ozon' && !clientId) || isSaving}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App info */}
      <section className="text-center text-stone-500 text-sm pb-8">
        <p className="opacity-50">NeuroAgent v3.0.0 (GodMode Ready)</p>
        <p className="opacity-30 text-xs">AI-ассистент для селлеров</p>

        {/* Existing Ops Panel Link */}
        {onNavigate && (
          <button
            onClick={() => onNavigate('ops')}
            className="mt-4 text-xs opacity-20 hover:opacity-100 transition-opacity uppercase tracking-widest mr-4"
          >
            OPS
          </button>
        )}

        {/* HIDDEN GOD MODE ENTRY POINT */}
        {/* Only visible for specific Admin IDs (Hardcoded + Env check on backend) */}
        {onNavigate && user?.telegramId && [7548070478].includes(user.telegramId) && (
          <button
            onClick={() => {
              hapticFeedback('heavy');
              // Use a direct window location change or a router push if onNavigate supports arbitrary strings
              // Assuming onNavigate maps to setCurrentPage in App.tsx which handles 'god-mode'
              onNavigate('god-mode');
            }}
            className="mt-4 text-xs font-bold text-violet-500/50 hover:text-violet-500 transition-colors uppercase tracking-widest"
          >
            GOD_MODE
          </button>
        )}
      </section>
    </div>
  );
}
