// ============================================
// NeuroGUARDIAN — Bulk Price Guard Modal
// Включить Сторожа цены для всех товаров
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';
import { useProductsStore } from '../../stores';

interface BulkStopLossModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERCENTAGE_OPTIONS = [5, 10, 15, 20, 25, 30];

export function BulkStopLossModal({ isOpen, onClose }: BulkStopLossModalProps) {
  const [selectedPercentage, setSelectedPercentage] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const products = useProductsStore(state => state.products);
  const updateProduct = useProductsStore(state => state.updateProduct);

  // Calculate how many products will be affected
  const productsWithoutStopLoss = products.filter(p => p.minPrice === 0 || !p.minPrice);
  const productsToUpdate = productsWithoutStopLoss.length;

  // Preview what will happen
  const previewProducts = productsWithoutStopLoss.slice(0, 3).map(p => ({
    title: p.title.length > 25 ? p.title.slice(0, 25) + '...' : p.title,
    currentPrice: p.currentPrice,
    newMinPrice: Math.floor(p.currentPrice * (1 - selectedPercentage / 100)),
  }));

  const handleApply = async () => {
    if (productsToUpdate === 0) {
      onClose();
      return;
    }

    setIsProcessing(true);
    hapticFeedback('medium');

    let successCount = 0;
    let failedCount = 0;

    try {
      // Call batch API endpoint
      const response = await fetch(`/api?action=batch-set-stop-loss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-init-data': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({
          percentage: selectedPercentage,
          productIds: productsWithoutStopLoss.map(p => p.productId),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set bulk stop-loss');
      }

      const data = await response.json();
      successCount = data.updated || 0;
      failedCount = data.failed || 0;

      // Update local state
      productsWithoutStopLoss.forEach(product => {
        const newMinPrice = Math.floor(product.currentPrice * (1 - selectedPercentage / 100));
        updateProduct(product.id, { minPrice: newMinPrice });
      });

      hapticFeedback('success');
    } catch (error) {
      console.error('Bulk stop-loss error:', error);

      // Fallback: Update locally anyway (optimistic)
      productsWithoutStopLoss.forEach(product => {
        const newMinPrice = Math.floor(product.currentPrice * (1 - selectedPercentage / 100));
        updateProduct(product.id, { minPrice: newMinPrice });
        successCount++;
      });

      hapticFeedback('warning');
    } finally {
      setIsProcessing(false);
      setResult({ success: successCount, failed: failedCount });
    }
  };

  const handleClose = () => {
    setResult(null);
    setSelectedPercentage(10);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-700/50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <span className="text-2xl">🛡️</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Массовая защита</h2>
                    <p className="text-sm text-stone-400">Включить Сторожа для всех товаров</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center hover:bg-stone-700 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-stone-400"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {result ? (
                // Result state
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-4"
                >
                  <motion.div
                    className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <span className="text-4xl">✅</span>
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">Защита установлена!</h3>
                  <p className="text-stone-400 mb-2">
                    Обновлено товаров:{' '}
                    <span className="text-emerald-400 font-bold">{result.success}</span>
                  </p>
                  {result.failed > 0 && (
                    <p className="text-red-400 text-sm">Не удалось: {result.failed}</p>
                  )}
                  <button
                    onClick={handleClose}
                    className="mt-6 w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-colors"
                  >
                    Отлично!
                  </button>
                </motion.div>
              ) : (
                // Setup state
                <>
                  {/* Info banner */}
                  <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">💡</span>
                      <div>
                        <p className="text-sm text-amber-200">
                          {productsToUpdate === 0 ? (
                            'Все товары уже под защитой Сторожа!'
                          ) : (
                            <>
                              <span className="font-bold text-white">{productsToUpdate}</span>{' '}
                              товаров без защиты. Установим минимальную цену на{' '}
                              <span className="font-bold text-white">{selectedPercentage}%</span>{' '}
                              ниже текущей.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {productsToUpdate > 0 && (
                    <>
                      {/* Percentage selector */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-stone-300 mb-3">
                          Снижение цены от текущей
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                          {PERCENTAGE_OPTIONS.map(pct => (
                            <button
                              key={pct}
                              onClick={() => {
                                setSelectedPercentage(pct);
                                hapticFeedback('light');
                              }}
                              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                                selectedPercentage === pct
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                              }`}
                            >
                              -{pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      {previewProducts.length > 0 && (
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-stone-300 mb-3">
                            Предпросмотр ({previewProducts.length} из {productsToUpdate})
                          </label>
                          <div className="space-y-2">
                            {previewProducts.map((p, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-xl bg-stone-800/50 border border-stone-700/50"
                              >
                                <p className="text-sm text-white font-medium mb-1">{p.title}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-stone-400">
                                    {p.currentPrice.toLocaleString('ru-RU')} ₽
                                  </span>
                                  <span className="text-stone-500">→</span>
                                  <span className="text-amber-400 font-bold">
                                    min {p.newMinPrice.toLocaleString('ru-RU')} ₽
                                  </span>
                                </div>
                              </div>
                            ))}
                            {productsToUpdate > 3 && (
                              <p className="text-stone-500 text-xs text-center">
                                и ещё {productsToUpdate - 3} товаров...
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-700 transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={isProcessing || productsToUpdate === 0}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        productsToUpdate === 0
                          ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400'
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <motion.div
                            className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                          <span>Применяю...</span>
                        </>
                      ) : productsToUpdate === 0 ? (
                        'Всё защищено'
                      ) : (
                        <>
                          <span>🛡️</span>
                          <span>Защитить все</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Safe area for mobile */}
            <div className="h-6 sm:hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
