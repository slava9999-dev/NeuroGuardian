// ============================================
// NeuroGUARDIAN — Bulk Update Costs Modal
// Mass update of unit economics data
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';

interface BulkUpdateCostsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkUpdateCostsModal({ isOpen, onClose }: BulkUpdateCostsModalProps) {
  const products = useProductsStore(state => state.products);
  const updateProduct = useProductsStore(state => state.updateProduct);

  const [textInput, setTextInput] = useState('');
  const [parsedUpdates, setParsedUpdates] = useState<
    Array<{ id: string; title: string; oldCost: number; newCost: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setTextInput('');
      setParsedUpdates([]);
      setError(null);
    }
  }, [isOpen]);

  // Parse input text (Article/Title -> Cost) is tricky if user pastes names.
  // Pro mode: Simple list of products with inputs.
  // OR: Paste from Excel format: "VendorCode Tab Cost" or "VendorCode ; Cost"

  const handleParse = () => {
    const lines = textInput.split('\n').filter(l => l.trim());
    const updates: typeof parsedUpdates = [];
    const notFound: string[] = [];

    for (const line of lines) {
      // Try to split by tab, semicolon, or space
      // Expected format: IDENTIFIER separator PRICE
      const parts = line.split(/[\t;]+/).map(s => s.trim());

      if (parts.length < 2) continue; // Skip invalid lines

      const identifier = parts[0]; // VendorCode, ProductId, avg Title match?
      const priceStr = parts[parts.length - 1].replace(/[^0-9.,]/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      if (isNaN(price)) continue;

      // Find product
      // Strategy: Exact match on vendorCode, then productId, then nmId
      const product = products.find(
        p =>
          p.vendorCode === identifier ||
          p.productId === identifier ||
          p.nmId?.toString() === identifier ||
          p.title.includes(identifier) // Risky? Let's allow it for now but show in preview
      );

      if (product) {
        updates.push({
          id: product.productId,
          title: product.title,
          oldCost: product.costPrice || 0,
          newCost: price,
        });
      } else {
        notFound.push(identifier);
      }
    }

    if (updates.length === 0) {
      setError('Не удалось распознать товары. Используйте формат: Артикул [TAB] Цена');
      return;
    }

    setParsedUpdates(updates);
    setStep('preview');
    setError(
      notFound.length > 0 ? `Не найдено товаров: ${notFound.length} (проверьте артикулы)` : null
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || '';

      const updatesPayload = parsedUpdates.map(u => ({
        productId: u.id,
        costPrice: u.newCost,
      }));

      // Send to API
      const res = await fetch('/api?action=batch-update-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData,
        },
        body: JSON.stringify({ updates: updatesPayload }),
      });

      if (!res.ok) throw new Error('API request failed');
      const result = await res.json();

      if (result.success) {
        hapticFeedback('success');
        // Update local store
        parsedUpdates.forEach(u => {
          const product = products.find(p => p.productId === u.id);
          if (product) updateProduct(product.id, { costPrice: u.newCost });
        });
        onClose();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      console.error(e);
      setError('Ошибка сохранения');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:w-[600px] md:left-1/2 md:-translate-x-1/2 bg-stone-900 rounded-2xl border border-stone-800 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900">
              <h2 className="text-xl font-bold text-white">📦 Массовая себестоимость</h2>
              <button onClick={onClose} className="text-stone-500 hover:text-white">
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {step === 'input' ? (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-sm text-blue-200">
                    <p className="font-bold mb-1">Как использовать:</p>
                    <p>Скопируйте данные из Excel (Артикул и Цена) и вставьте сюда.</p>
                    <p className="mt-1 opacity-70">Формат: Артикул [TAB] Цена</p>
                  </div>

                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder={`123456\t500\n789012\t1200\n...`}
                    className="w-full h-64 bg-stone-950 border border-stone-800 rounded-xl p-4 text-stone-300 font-mono text-sm focus:border-blue-500 outline-none resize-none"
                  />

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded">{error}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm text-stone-400">
                    <span>Распознано товаров: {parsedUpdates.length}</span>
                    <button
                      onClick={() => setStep('input')}
                      className="text-blue-400 hover:underline"
                    >
                      Назад к вводу
                    </button>
                  </div>

                  <div className="border border-stone-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-stone-800 text-stone-400">
                        <tr>
                          <th className="p-3">Товар</th>
                          <th className="p-3 text-right">Было</th>
                          <th className="p-3 text-right">Станет</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800">
                        {parsedUpdates.map(u => (
                          <tr key={u.id} className="hover:bg-stone-800/50">
                            <td className="p-3 text-white truncate max-w-[200px]">
                              {u.title}
                              <div className="text-xs text-stone-500">{u.id}</div>
                            </td>
                            <td className="p-3 text-right text-stone-400">{u.oldCost} ₽</td>
                            <td className="p-3 text-right font-bold text-blue-400">
                              {u.newCost} ₽
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && (
                    <div className="text-orange-400 text-sm bg-orange-500/10 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-800 bg-stone-900 safe-area-bottom">
              {step === 'input' ? (
                <button
                  onClick={handleParse}
                  disabled={!textInput.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Распознать
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Сохранение...'
                  ) : (
                    <>
                      <span>💾 Сохранить {parsedUpdates.length} цен</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
