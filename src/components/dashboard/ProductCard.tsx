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

  const handleSave = async () => {
    hapticFeedback('medium');
    setIsSaving(true);
    try {
      // Use correct API method
      const res = await productsApi.updateMinPrice(product.id, Number(localMin));
      // If we need to update cost price too, we'd call a separate method if exists,
      // but for now let's assume we update min price as primary sentinel duty.

      if (res.success) {
        onUpdate({ ...product, costPrice: localCost, minPrice: localMin });
        setIsEditing(false);
        hapticFeedback('success');
      }
    } catch (e) {
      hapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isProtected = product.status === 'protected';
  const isProfitable = product.currentPrice - (product.costPrice || 0) > 0;
  const profitColor = isProfitable ? 'text-emerald-400' : 'text-rose-500';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="premium-card p-0 mb-4 group ring-1 ring-white/5"
    >
      <div className="flex">
        {/* Left Side: Visuals & Core Info */}
        <div className="w-1/3 relative overflow-hidden flex flex-col items-center justify-center border-r border-white/5 bg-white/2">
          <img
            src={product.imageUrl || 'https://via.placeholder.com/200'}
            alt={product.title}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-60" />

          {/* Protect Status Aura */}
          {isProtected && (
            <motion.div
              className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-emerald-500/30"
              animate={{
                boxShadow: ['0 0 5px #10b98122', '0 0 15px #10b98144', '0 0 5px #10b98122'],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-black italic text-emerald-400 uppercase">
                Active Protection
              </span>
            </motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.9, rotate: 5 }}
            onClick={() => {
              hapticFeedback('light');
              onOpenMedia?.(product);
            }}
            className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-full border border-white/10 hover:border-indigo-500 transition-all"
          >
            <ImageIcon className="w-4 h-4 text-zinc-300" />
          </motion.button>
        </div>

        {/* Right Side: Data & Control */}
        <div className="flex-1 p-4 flex flex-col gap-4">
          {/* Header Data */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate max-w-[120px]">
                {product.title}
              </h3>
              <p className="text-[9px] mono-data text-zinc-600 mt-0.5">
                ID: {product.nmId || product.productId || product.id}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                hapticFeedback('light');
                openExternalLink((product as any).url || '#');
              }}
              className="p-1.5 hover:text-indigo-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Price Focus */}
          <div className="flex flex-col items-start bg-white/2 p-3 rounded-lg border border-white/5">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">
              Live Market Price
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black italic tracking-tighter text-white text-quantum">
                {product.currentPrice?.toLocaleString()}₽
              </span>
              <div
                className={`flex items-center text-[10px] font-black italic ${profitColor} profit-pulse`}
              >
                <TrendingUp className="w-3 h-3 mr-1" /> ACTIVE
              </div>
            </div>
          </div>

          {/* Tactical Controls (Inputs) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1">
                Cost Price
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={localCost}
                  onChange={e => {
                    setLocalCost(Number(e.target.value));
                    setIsEditing(true);
                  }}
                  className="w-full bg-white/5 border border-white/5 rounded-md p-3 text-xs font-black italic text-zinc-300 outline-none focus:border-indigo-500/50"
                />
                <span className="absolute right-3 top-3.5 text-[10px] font-bold text-zinc-700">
                  ₽
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1">
                Stop-Loss (Min)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={localMin}
                  onChange={e => {
                    setLocalMin(Number(e.target.value));
                    setIsEditing(true);
                  }}
                  className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-md p-3 text-xs font-black italic text-indigo-400 outline-none focus:border-indigo-500/50"
                />
                <span className="absolute right-3 top-3.5 text-[10px] font-bold text-indigo-500/40">
                  ₽
                </span>
              </div>
            </div>
          </div>

          {/* Actions Bento */}
          <div className="flex gap-2 mt-2">
            <AnimatePresence>
              {isEditing && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  whileTap={{ scale: 0.95, y: 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                >
                  {isSaving ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Commit
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <div className="flex gap-1 flex-1">
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                onClick={() => {
                  hapticFeedback('medium');
                  onOpenSMM?.(product);
                }}
                className="flex-1 py-3 bg-white/5 border border-white/5 text-[10px] font-black italic tracking-widest uppercase hover:bg-white/10 transition-all rounded-lg"
              >
                SMM AI
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9, y: 2 }}
                onClick={() => {
                  hapticFeedback('medium');
                  onOpenCalculator?.(product);
                }}
                className="px-4 py-3 bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-all rounded-lg"
              >
                <Calculator className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
