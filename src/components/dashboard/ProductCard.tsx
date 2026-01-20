// ============================================
// NeuroGUARDIAN — Product Card V7.0 (Warm Light)
// Clear, tactile, accessible design
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  Calculator,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  Wand2,
  Shield,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';
import { productsApi } from '../../lib/api';
import { hapticFeedback, openExternalLink } from '../../lib/telegram';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onUpdate: (updated: Product) => void;
  onOpenSMM?: (product: Product) => void;
  onOpenCalculator?: (product: Product) => void;
  onOpenMedia?: (product: Product) => void;
}

export function ProductCard({
  product,
  onUpdate,
  onOpenSMM,
  onOpenCalculator,
  onOpenMedia,
}: ProductCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localCost, setLocalCost] = useState(product.costPrice || 0);
  const [localMin, setLocalMin] = useState(product.minPrice || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSave = async () => {
    hapticFeedback('medium');
    setIsSaving(true);
    try {
      const res = await productsApi.updateProductParams(product.id, {
        minPrice: Number(localMin),
        costPrice: Number(localCost),
      });
      if (res.success) {
        onUpdate({ ...product, costPrice: localCost, minPrice: localMin });
        setIsEditing(false);
        setSaveSuccess(true);
        hapticFeedback('success');
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      hapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isProtected = product.status === 'protected' || (product.minPrice && product.minPrice > 0);
  const profit = product.currentPrice - (product.costPrice || 0);
  const isProfitable = profit > 0;
  const profitPercent = product.costPrice ? Math.round((profit / product.costPrice) * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      {/* Top Section: Image + Quick Info */}
      <div className="flex gap-4 p-4">
        {/* Product Image */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-surface-warm">
          {!imageError && product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-[9px] mt-1 uppercase font-medium">Нет фото</span>
            </div>
          )}

          {/* External Link Overlay */}
          <button
            onClick={e => {
              e.stopPropagation();
              openExternalLink(product.url || '#');
            }}
            className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
            aria-label="Открыть на маркетплейсе"
          >
            <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {/* Status Badge */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`badge ${isProtected ? 'badge-success' : 'badge-warning'}`}>
              {isProtected ? (
                <>
                  <Shield className="w-3 h-3" />
                  Защищён
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Настроить
                </>
              )}
            </span>
            <span className="text-[10px] font-mono text-text-muted bg-surface-hl px-2 py-0.5 rounded">
              {product.nmId || product.id}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-sm font-semibold text-text-main leading-snug line-clamp-2 mb-2"
            title={product.title}
          >
            {product.title}
          </h3>

          {/* Price Display */}
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-text-main">
              {product.currentPrice?.toLocaleString('ru-RU')} ₽
            </span>
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {isProfitable ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {isProfitable ? '+' : ''}
              {profitPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Economics Section */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3 p-3 bg-surface-warm rounded-xl">
          {/* Cost Price Input */}
          <div>
            <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block mb-1">
              Себестоимость
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={localCost || ''}
                onChange={e => {
                  setLocalCost(Number(e.target.value));
                  setIsEditing(true);
                }}
                className="w-full py-2 px-3 bg-surface border border-surface-dim rounded-lg text-sm font-semibold text-text-main focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                ₽
              </span>
            </div>
          </div>

          {/* Min Price Input */}
          <div>
            <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block mb-1">
              Стоп-лосс
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={localMin || ''}
                onChange={e => {
                  setLocalMin(Number(e.target.value));
                  setIsEditing(true);
                }}
                className="w-full py-2 px-3 bg-surface border border-surface-dim rounded-lg text-sm font-semibold text-text-main focus:border-danger focus:ring-2 focus:ring-danger/10 outline-none transition-all"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                ₽
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.button
              key="save"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full btn btn-primary py-3"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Сохранить изменения
                </>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              {/* SMM Button */}
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onOpenSMM?.(product);
                }}
                className="flex-1 btn btn-secondary py-3"
              >
                <Wand2 className="w-4 h-4 text-primary" />
                Контент
              </button>

              {/* Media Button */}
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onOpenMedia?.(product);
                }}
                className="btn btn-ghost py-3 px-3"
                aria-label="Медиа"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Calculator Button */}
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onOpenCalculator?.(product);
                }}
                className="btn btn-ghost py-3 px-3"
                aria-label="Калькулятор"
              >
                <Calculator className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center justify-center gap-2 text-success text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Сохранено!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
