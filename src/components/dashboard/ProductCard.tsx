// ============================================
// NeuroGUARDIAN — Product Card v2.0
// Aesthetic: Tactical Unit | Inventory Matrix
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  Calculator,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  Shield,
  AlertTriangle,
  Check,
  Loader2,
  Lock,
} from 'lucide-react';
import { productsApi } from '../../lib/api';
import { hapticFeedback, openExternalLink } from '../../lib/telegram';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onUpdate: (updated: Product) => void;
  onOpenCalculator?: (product: Product) => void;
}

export function ProductCard({ product, onUpdate, onOpenCalculator }: ProductCardProps) {
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
  const isTriggered = product.status === 'triggered';
  const profit = product.currentPrice - (product.costPrice || 0);
  const isProfitable = profit > 0;
  const profitPercent = product.costPrice ? Math.round((profit / product.costPrice) * 100) : 0;

  return (
    <motion.div
      layout
      className={`fused-card overflow-hidden group transition-all duration-300 ${isTriggered ? 'ring-2 ring-toxic-orange ring-offset-2' : ''}`}
    >
      {/* Visual Identification Layer */}
      <div className="flex gap-4 p-4">
        {/* Media Block */}
        <div className="relative size-24 shrink-0 rounded-2xl overflow-hidden bg-black/5 border border-black/5 shadow-inner">
          {!imageError && product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover grayscale-[0.2] transition-all group-hover:grayscale-0 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-black/10">
              <ImageIcon size={24} />
            </div>
          )}

          {/* External Link Overlay */}
          <button
            onClick={e => {
              e.stopPropagation();
              openExternalLink(product.url || '#');
            }}
            className="absolute bottom-1.5 right-1.5 size-7 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-lg shadow-sm border border-black/5 text-black/40 hover:text-primary active:scale-90 transition-all"
          >
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Data Block */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="space-y-1.5">
            {/* Tag Stack */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${product.marketplace === 'WB' ? 'bg-[#7000FF] text-white' : 'bg-[#005BFF] text-white'}`}
              >
                {product.marketplace}
              </span>

              {isProtected ? (
                <span
                  className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md flex items-center gap-1 ${isTriggered ? 'bg-toxic-orange text-black animate-pulse' : 'bg-peace-green/20 text-peace-green'}`}
                >
                  {isTriggered ? <Lock size={8} /> : <Shield size={8} />}
                  {isTriggered ? 'Attacked' : 'Protected'}
                </span>
              ) : (
                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-black/5 text-black/30">
                  No Guard
                </span>
              )}

              <span className="text-[7px] font-black font-mono text-black/20 uppercase">
                {product.vendorCode}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-[11px] font-black text-black/80 leading-tight line-clamp-2 tracking-tight">
              {product.title}
            </h3>
          </div>

          {/* Price Engine */}
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[15px] font-black text-black tracking-tighter">
                {product.currentPrice?.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div
              className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg ${isProfitable ? 'bg-peace-green/10 text-peace-green' : 'bg-toxic-orange/10 text-toxic-orange'}`}
            >
              {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isProfitable ? '+' : ''}
              {profitPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Control Surface */}
      <div className="px-4 pb-4 mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Input Unit: Cost */}
          <div className="space-y-1">
            <label className="text-[7px] font-black uppercase tracking-[0.1em] text-black/30 px-1">
              Cost Unit
            </label>
            <div className="relative h-10">
              <input
                type="number"
                value={localCost || ''}
                onChange={e => {
                  setLocalCost(Number(e.target.value));
                  setIsEditing(true);
                }}
                className="w-full h-full bg-black/3 border border-black/5 rounded-xl px-3 text-[11px] font-black text-black focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-black/10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/20">
                ₽
              </span>
            </div>
          </div>

          {/* Input Unit: Stop-Loss */}
          <div className="space-y-1">
            <label className="text-[7px] font-black uppercase tracking-[0.1em] text-black/30 px-1">
              Stop Loss
            </label>
            <div className="relative h-10">
              <input
                type="number"
                value={localMin || ''}
                onChange={e => {
                  setLocalMin(Number(e.target.value));
                  setIsEditing(true);
                }}
                className="w-full h-full bg-black/3 border border-black/5 rounded-xl px-3 text-[11px] font-black text-black focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-black/10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/20">
                ₽
              </span>
            </div>
          </div>
        </div>

        {/* Action Hub */}
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.button
              key="save"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-11 bg-black text-white rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isSaving ? 'Synching...' : 'Commit Changes'}
            </motion.button>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onOpenCalculator?.(product);
                }}
                className="flex-1 h-11 bg-white border border-black/5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors"
              >
                <Calculator size={14} /> Unit Economic
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success Pulse */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-peace-green text-white text-[8px] font-black uppercase tracking-widest text-center py-1.5"
          >
            System Updated Successfully
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
