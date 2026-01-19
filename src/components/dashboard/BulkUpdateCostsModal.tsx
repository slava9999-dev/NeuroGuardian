// ============================================
// NeuroGUARDIAN — Bulk Update Costs Modal
// Mass update of unit economics data
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore } from '../../stores';
import { hapticFeedback, getInitData } from '../../lib/telegram';

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
      const initData = getInitData();

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
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:w-[600px] md:left-1/2 md:-translate-x-1/2 bg-zinc-900 rounded-2xl border border-white/5 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900">
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                📦 Массовая себестоимость
              </h2>
              <button
                onClick={onClose}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {step === 'input' ? (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-primary leading-relaxed">
                    <p className="font-black mb-1">Как использовать:</p>
                    <p>Скопируйте данные из Excel (Артикул и Цена) и вставьте сюда.</p>
                    <p className="mt-1 opacity-50 font-mono tracking-tight text-[9px]">
                      Формат: Артикул [TAB] Цена
                    </p>
                  </div>

                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder={`123456\t500\n789012\t1200\n...`}
                    className="w-full h-64 bg-black border border-white/5 rounded-2xl p-4 text-zinc-100 font-mono text-sm focus:border-primary/50 outline-none resize-none shadow-xl"
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

                  <div className="border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-white/5 text-zinc-600 uppercase tracking-widest font-black">
                        <tr>
                          <th className="p-4">Товар</th>
                          <th className="p-4 text-right">Было</th>
                          <th className="p-4 text-right">Станет</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/2">
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
            <div className="p-4 border-t border-white/5 bg-zinc-900 safe-area-bottom">
              {step === 'input' ? (
                <button
                  onClick={handleParse}
                  disabled={!textInput.trim()}
                  className="w-full py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-xl hover:bg-primary"
                >
                  Распознать
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full py-4 bg-primary text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl"
                >
                  {loading ? (
                    '💾 СОХРАНЕНИЕ...'
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
