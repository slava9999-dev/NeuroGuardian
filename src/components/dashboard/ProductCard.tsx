// ============================================
// NeuroGUARDIAN — Product Card Component V6.1 (Human)
// Aesthetic: Algorithmic Clarity, Tactile, High Accessibility
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
  AlertTriangle,
  ShieldCheck,
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
      const res = await productsApi.updateProductParams(product.id, {
        minPrice: Number(localMin),
        costPrice: Number(localCost),
      });
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

  const isProtected = product.status === 'protected' || (product.minPrice && product.minPrice > 0);
  const isProfitable = product.currentPrice - (product.costPrice || 0) > 0;

  // High contrast accessible colors
  const statusColor = isProtected
    ? 'text-emerald-700 bg-emerald-100/50 border-emerald-200 ring-emerald-500/10'
    : 'text-amber-700 bg-amber-100/50 border-amber-200 ring-amber-500/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.995 }}
      className="premium-card mb-4 flex flex-col sm:flex-row bg-white overflow-hidden group"
    >
      {/* 1. Visual Zone (Image) */}
      <div className="relative h-48 sm:h-auto sm:w-40 shrink-0 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100">
        {!imageError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <ImageIcon className="w-8 h-8 opacity-50" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Нет фото</span>
          </div>
        )}

        {/* Floating Quick Actions (Image Overlay) */}
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <button
            onClick={e => {
              e.stopPropagation();
              openExternalLink(product.url || '#');
            }}
            className="p-2 bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:text-indigo-600 active:scale-95 transition-all"
            aria-label="Открыть на маркетплейсе"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => {
            hapticFeedback('light');
            onOpenMedia?.(product);
          }}
          className="absolute bottom-2 left-2 right-2 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Медиа</span>
        </button>
      </div>

      {/* 2. Logic Zone (Content) */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ring-1 ${statusColor}`}
              >
                {isProtected ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span className="text-xs font-bold leading-none">
                  {isProtected ? 'Защита активна' : 'Требует настройки'}
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100/50 px-2 py-1 rounded-md">
                NM: {product.nmId || product.id}
              </span>
            </div>

            <h3
              className="text-base font-semibold text-slate-900 leading-snug line-clamp-2"
              title={product.title}
            >
              {product.title}
            </h3>
          </div>
        </div>

        {/* Economics Dashboard */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Текущая цена</span>
            <div className="text-2xl font-display font-bold text-slate-900 tracking-tight">
              {product.currentPrice?.toLocaleString()}
              <span className="text-base text-slate-400 ml-1 font-medium">₽</span>
            </div>
          </div>

          <div className="pl-3 border-l border-slate-200">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Маржинальность</span>
            <div
              className={`flex items-center gap-1.5 font-bold text-lg ${isProfitable ? 'text-emerald-600' : 'text-rose-500'}`}
            >
              {isProfitable ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {isProfitable ? 'Прибыль' : 'Убыток'}
            </div>
          </div>
        </div>

        {/* Interactive Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <label className="group relative">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute top-2 left-3 z-10 transition-colors group-focus-within:text-indigo-500">
              Себестоимость
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={localCost || ''}
              onChange={e => {
                setLocalCost(Number(e.target.value));
                setIsEditing(true);
              }}
              className="w-full pt-6 pb-2 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-200"
              placeholder="0 ₽"
            />
          </label>

          <label className="group relative">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute top-2 left-3 z-10 transition-colors group-focus-within:text-rose-500">
              Минимум (Stop)
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={localMin || ''}
              onChange={e => {
                setLocalMin(Number(e.target.value));
                setIsEditing(true);
              }}
              className="w-full pt-6 pb-2 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-slate-200"
              placeholder="0 ₽"
            />
          </label>
        </div>

        {/* Action Panel */}
        <div className="mt-auto pt-2">
          <AnimatePresence mode="popLayout">
            {isEditing ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={handleSave}
                disabled={isSaving}
                className="w-full btn-premium bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200"
              >
                {isSaving ? 'Сохранение...' : 'Применить изменения'}
              </motion.button>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                <button
                  onClick={() => onOpenSMM?.(product)}
                  className="flex-1 py-3 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group/btn"
                >
                  <Wand2 className="w-4 h-4 text-violet-500 group-hover/btn:rotate-12 transition-transform" />
                  <span>Создать контент</span>
                </button>

                <button
                  onClick={() => onOpenCalculator?.(product)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md active:scale-[0.95] transition-all"
                  aria-label="Калькулятор"
                >
                  <Calculator className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
