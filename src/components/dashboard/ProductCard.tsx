// ============================================
// NeuroGUARDIAN — Product Card Component V4.0 (Premium)
// Aesthetic: Digital Cockpit | Tactical Data Unit
// Interaction: Tactile Physical Response
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ExternalLink,
  Calculator,
  Save,
  TrendingUp,
  Image as ImageIcon,
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
  const profitColor = isProfitable ? 'text-emerald-400' : 'text-rose-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-card p-0 mb-4 group ring-1 ring-white/5 bg-surface"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Left Side: Visuals & Core Info */}
        <div className="w-full sm:w-1/3 relative overflow-hidden flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-white/5 bg-black/20 min-h-[160px]">
          {!imageError ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full bg-slate-900/50 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-slate-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

          {/* Protect Status Aura */}
          {isProtected && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-emerald-500/20 z-20">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">
                ЗАЩИТА
              </span>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              hapticFeedback('light');
              onOpenMedia?.(product);
            }}
            className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-full border border-white/10 hover:bg-violet-500/20 transition-all z-20"
          >
            <ImageIcon className="w-4 h-4 text-zinc-300" />
          </motion.button>
        </div>

        {/* Right Side: Data & Control */}
        <div className="flex-1 p-4 flex flex-col gap-4">
          {/* Header Data */}
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                {product.title}
              </h3>
              <p className="text-[9px] font-mono text-zinc-500 mt-1 uppercase">
                ID {product.nmId || product.productId || product.id}
              </p>
            </div>
            <button
              onClick={() => {
                hapticFeedback('light');
                openExternalLink(product.url || '#');
              }}
              className="p-1 text-zinc-500 hover:text-violet-400 transition-colors shrink-0"
              aria-label="Открыть в магазине"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Price Focus */}
          <div className="flex flex-col items-start bg-black/20 p-3 rounded-xl border border-white/5">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
              ТЕКУЩАЯ ЦЕНА
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-white">
                {product.currentPrice?.toLocaleString()}₽
              </span>
              <div className={`flex items-center text-[9px] font-bold ${profitColor}`}>
                {isProfitable ? (
                  <>
                    <TrendingUp className="w-3 h-3 mr-1" /> В ПЛЮСЕ
                  </>
                ) : (
                  <>В УБЫТКЕ</>
                )}
              </div>
            </div>
          </div>

          {/* Tactical Controls (Inputs) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                СЕБЕСТОИМОСТЬ
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={localCost}
                  onChange={e => {
                    setLocalCost(Number(e.target.value));
                    setIsEditing(true);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs font-bold text-white outline-none focus:border-violet-500/40 transition-colors"
                />
                <span className="absolute right-3 top-3 text-[10px] font-bold text-zinc-600">
                  ₽
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                СТОП-ЛОСС
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={localMin}
                  onChange={e => {
                    setLocalMin(Number(e.target.value));
                    setIsEditing(true);
                  }}
                  className="w-full bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 text-xs font-bold text-violet-300 outline-none focus:border-violet-500/50 transition-colors"
                />
                <span className="absolute right-3 top-3 text-[10px] font-bold text-violet-500/40">
                  ₽
                </span>
              </div>
            </div>
          </div>

          {/* Actions Bento */}
          <div className="flex gap-2 mt-auto pt-2">
            <AnimatePresence>
              {isEditing && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    'СОХРАНЕНИЕ...'
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> СОХРАНИТЬ
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <div className="flex gap-2 flex-1">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  hapticFeedback('medium');
                  onOpenSMM?.(product);
                }}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all rounded-lg text-zinc-400"
              >
                SMM AI
              </motion.button>
              <button
                onClick={() => {
                  hapticFeedback('medium');
                  onOpenCalculator?.(product);
                }}
                className="px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all rounded-lg"
                aria-label="Открыть калькулятор"
              >
                <Calculator className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
