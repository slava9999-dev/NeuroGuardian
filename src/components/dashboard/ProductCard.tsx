// ============================================
// NeuroGUARDIAN — Product Card Component V6.0 (Human)
// Aesthetic: Clean, Tactile, Mobile-First
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  Calculator,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  Wand2, // Magic wand for AI interactions
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
  const [imageError, setImageError] = useState(false);

  const handleSave = async () => {
    hapticFeedback('medium');
    setIsSaving(true);
    try {
      const res = await productsApi.updateMinPrice(product.id, Number(localMin));
      if (res.success) {
        onUpdate({ ...product, costPrice: localCost, minPrice: localMin });
        setIsEditing(false);
        hapticFeedback('success');
      }
    } catch {
      hapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isProtected = product.status === 'protected' || product.minPrice > 0;
  const isProfitable = product.currentPrice - (product.costPrice || 0) > 0;

  // V6 Human Colors
  const statusColor = isProtected
    ? 'text-emerald-600 bg-emerald-50'
    : 'text-slate-500 bg-slate-100';
  const profitColor = isProfitable ? 'text-emerald-600' : 'text-rose-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.995 }}
      className="premium-card mb-4 flex flex-row overflow-hidden"
    >
      {/* 1. Left: Image Thumbnail (Square for mobile) */}
      <div className="w-24 sm:w-32 relative bg-slate-100 shrink-0 border-r border-slate-100">
        {!imageError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}

        {/* Quick Media Action */}
        <button
          onClick={() => {
            hapticFeedback('light');
            onOpenMedia?.(product);
          }}
          className="absolute bottom-1 right-1 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-slate-600 active:scale-90 transition-transform"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Right: Content */}
      <div className="flex-1 p-3 flex flex-col min-w-0">
        {/* Header: Title & Link */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${statusColor}`}
              >
                {isProtected ? 'Под защитой' : 'Не активен'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                #{product.nmId || product.id}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight truncate pr-2">
              {product.title}
            </h3>
          </div>

          <button
            onClick={() => openExternalLink(product.url || '#')}
            className="text-slate-400 hover:text-indigo-600 p-1 -mr-1"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* Core Metrics: Price & Profit */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-slate-900 font-display">
            {product.currentPrice?.toLocaleString()}₽
          </span>
          <div className={`flex items-center text-xs font-medium ${profitColor}`}>
            {isProfitable ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {isProfitable ? 'Прибыль' : 'Убыток'}
          </div>
        </div>

        {/* Controls: Inputs (iOS Style) */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Себестоимость
            </label>
            <input
              type="number"
              value={localCost}
              onChange={e => {
                setLocalCost(Number(e.target.value));
                setIsEditing(true);
              }}
              className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none p-0 placeholder-slate-300"
              placeholder="0"
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Стоп-лосс
            </label>
            <input
              type="number"
              value={localMin}
              onChange={e => {
                setLocalMin(Number(e.target.value));
                setIsEditing(true);
              }}
              className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none p-0 placeholder-slate-300"
              placeholder="0"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-auto flex gap-2">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.button
                key="save"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg shadow-sm shadow-indigo-200"
              >
                {isSaving ? '...' : 'Сохранить'}
              </motion.button>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2 w-full"
              >
                <button
                  onClick={() => onOpenSMM?.(product)}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs font-medium py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                  SMM
                </button>
                <button
                  onClick={() => onOpenCalculator?.(product)}
                  className="px-3 bg-white border border-slate-200 text-slate-400 py-2 rounded-lg hover:text-slate-600 active:bg-slate-100 transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
