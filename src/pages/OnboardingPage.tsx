// ============================================
// NeuroAgent — Onboarding Page
// AI Assistant setup flow for WB & Ozon
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../lib/telegram';
import { settingsApi, productsApi } from '../lib/api';

type Step = 'welcome' | 'marketplace' | 'apiKey' | 'sync' | 'complete';
type Marketplace = 'WB' | 'Ozon';

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const [protectedCount, setProtectedCount] = useState(0);

  const handleMarketplaceSelect = (mp: Marketplace) => {
    hapticFeedback('light');
    setSelectedMarketplace(mp);
    setStep('apiKey');
  };

  const handleSubmitKey = async () => {
    if (!apiKey.trim()) {
      setError('Введите API ключ');
      return;
    }

    if (selectedMarketplace === 'Ozon' && !clientId.trim()) {
      setError('Для Ozon требуется Client ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    hapticFeedback('light');

    try {
      // For Ozon, combine clientId:apiKey
      const fullKey = selectedMarketplace === 'Ozon' && clientId ? `${clientId}:${apiKey}` : apiKey;

      // REAL: Save API key to database
      await settingsApi.saveApiKey(selectedMarketplace!, fullKey, clientId);

      setStep('sync');

      // REAL: Sync products from marketplace with Smart Defaults enabled
      const syncResult = await productsApi.syncProducts(selectedMarketplace!);

      setSyncedCount(syncResult.count || 0);
      setProtectedCount(syncResult.smartDefaultsApplied || syncResult.count || 0);
      hapticFeedback('success');
      setStep('complete');
    } catch (err: unknown) {
      // Error handling without logging sensitive context
      const errorMessage = err instanceof Error ? err.message : 'Ошибка сохранения ключа';
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || errorMessage);
      hapticFeedback('error');
      setStep('apiKey'); // Go back to input on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    hapticFeedback('success');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-stone-900 to-stone-800 px-6 py-12">
      <AnimatePresence mode="wait">
        {/* STEP: Welcome */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            {/* Logo */}
            <motion.div
              className="w-24 h-24 mb-6 rounded-3xl bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center"
              animate={{
                boxShadow: [
                  '0 0 20px rgba(245, 158, 11, 0.3)',
                  '0 0 60px rgba(245, 158, 11, 0.5)',
                  '0 0 20px rgba(245, 158, 11, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-stone-900"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </motion.div>

            <h1 className="text-3xl font-bold text-gradient-amber mb-4">Привет! Я NeuroAgent 🤖</h1>
            <p className="text-stone-400 mb-8 max-w-xs">
              Твой личный AI-помощник для управления магазином на Wildberries и Ozon
            </p>

            <button
              onClick={() => setStep('marketplace')}
              className="btn-primary px-8 py-4 text-lg"
            >
              Начать настройку
            </button>
          </motion.div>
        )}

        {/* STEP: Marketplace selection */}
        {step === 'marketplace' && (
          <motion.div
            key="marketplace"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="py-8"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Подключите маркетплейс</h2>
            <p className="text-stone-400 mb-8">
              Я загружу ваши товары и настрою защиту автоматически
            </p>

            <div className="space-y-4">
              <button
                onClick={() => handleMarketplaceSelect('WB')}
                className="w-full glass-panel glass-panel-hover p-6 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-400">WB</span>
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white">Wildberries</h3>
                  <p className="text-sm text-stone-400">Content API + Marketplace API</p>
                </div>
              </button>

              <button
                onClick={() => handleMarketplaceSelect('Ozon')}
                className="w-full glass-panel glass-panel-hover p-6 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-400">O₃</span>
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white">Ozon</h3>
                  <p className="text-sm text-stone-400">Seller API</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP: API Key input */}
        {step === 'apiKey' && (
          <motion.div
            key="apiKey"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="py-8"
          >
            <button
              onClick={() => setStep('marketplace')}
              className="flex items-center gap-2 text-stone-400 mb-6 hover:text-white transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Назад
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div
                className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${selectedMarketplace === 'WB' ? 'bg-purple-500/20' : 'bg-blue-500/20'}
              `}
              >
                <span
                  className={`
                  text-lg font-bold
                  ${selectedMarketplace === 'WB' ? 'text-purple-400' : 'text-blue-400'}
                `}
                >
                  {selectedMarketplace === 'WB' ? 'WB' : 'O₃'}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">API ключ {selectedMarketplace}</h2>
                <p className="text-sm text-stone-400">Введите ваш API ключ</p>
              </div>
            </div>

            {/* Collapsible instructions */}
            <details className="mb-6 group">
              <summary className="flex items-center gap-2 cursor-pointer text-amber-400 text-sm hover:text-amber-300 transition-colors">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform group-open:rotate-90"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Где получить API ключ?
              </summary>

              <div className="mt-4 p-4 bg-stone-800/50 rounded-xl border border-stone-700">
                {selectedMarketplace === 'WB' ? (
                  <div className="space-y-3 text-sm text-stone-300">
                    <p className="font-medium text-white">Инструкция для Wildberries:</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Откройте{' '}
                        <a
                          href="https://seller.wildberries.ru"
                          target="_blank"
                          rel="noopener"
                          className="text-purple-400 underline"
                        >
                          seller.wildberries.ru
                        </a>
                      </li>
                      <li>
                        Перейдите в <span className="text-white">Профиль → Настройки</span>
                      </li>
                      <li>
                        Выберите <span className="text-white">Доступ к API</span>
                      </li>
                      <li>
                        Нажмите <span className="text-white">"Создать новый токен"</span>
                      </li>
                      <li>
                        Выберите права: <span className="text-amber-400">Контент, Цены, Склад</span>
                      </li>
                      <li>Скопируйте полученный ключ</li>
                    </ol>
                    <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-amber-400 text-xs">
                        ⚠️ Ключ показывается только 1 раз! Сохраните его.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-stone-300">
                    <p className="font-medium text-white">Инструкция для Ozon:</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Откройте{' '}
                        <a
                          href="https://seller.ozon.ru"
                          target="_blank"
                          rel="noopener"
                          className="text-blue-400 underline"
                        >
                          seller.ozon.ru
                        </a>
                      </li>
                      <li>
                        Перейдите в <span className="text-white">Настройки → API ключи</span>
                      </li>
                      <li>
                        Нажмите <span className="text-white">"Создать ключ"</span>
                      </li>
                      <li>
                        Скопируйте <span className="text-blue-400">API-ключ</span> и{' '}
                        <span className="text-blue-400">Client ID</span>
                      </li>
                    </ol>
                    <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 text-xs">
                        📌 Для Ozon нужны ОБА значения: API-ключ и Client ID
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm text-stone-400 mb-2">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Вставьте API ключ..."
                  className="input-field"
                  autoComplete="off"
                />
              </div>

              {selectedMarketplace === 'Ozon' && (
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    placeholder="Введите Client ID..."
                    className="input-field"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmitKey}
              disabled={isLoading}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <motion.div
                    className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Проверка...
                </>
              ) : (
                'Подключить'
              )}
            </button>

            <p className="text-xs text-stone-500 text-center mt-4">
              🔐 Ключ шифруется и хранится в защищённом хранилище
            </p>
          </motion.div>
        )}

        {/* STEP: Syncing */}
        {step === 'sync' && (
          <motion.div
            key="sync"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <motion.div
              className="w-20 h-20 border-4 border-amber-500 border-t-transparent rounded-full mb-8"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <h2 className="text-2xl font-bold text-white mb-2">Синхронизация товаров</h2>
            <p className="text-stone-400">Загружаем ваши товары с {selectedMarketplace}...</p>
          </motion.div>
        )}

        {/* STEP: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-24 h-24 mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-400"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">Отлично! Я готов работать 🎉</h2>

            {/* Smart Defaults Summary */}
            {syncedCount > 0 && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-emerald-400"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-emerald-400 font-semibold">Защита настроена автоматически</p>
                    <p className="text-sm text-stone-400">Setup Cost: 0₽ (обычно 3,000₽)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="text-center p-2 bg-stone-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-white">{syncedCount}</p>
                    <p className="text-xs text-stone-400">Товаров загружено</p>
                  </div>
                  <div className="text-center p-2 bg-stone-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-400">{protectedCount}</p>
                    <p className="text-xs text-stone-400">Под защитой</p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-stone-400 mb-8">
              {syncedCount > 0
                ? 'Все товары под защитой. Sentinel уже следит за ценами!'
                : 'Товары загружены. Напишите мне в чат — я помогу настроить защиту!'}
            </p>

            <button onClick={handleComplete} className="btn-primary px-8 py-4 text-lg">
              Начать работу с агентом
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
