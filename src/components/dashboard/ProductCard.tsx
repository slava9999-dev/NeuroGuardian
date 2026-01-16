// ============================================
// NeuroGUARDIAN — ProductCard Component V3.1
// NEURO-UI: Compact, Data-First, Premium Design
// ============================================

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2,
  Shield,
  Package,
  TrendingUp,
  TrendingDown,
  Calculator,
  Image as ImageIcon,
} from 'lucide-react';

import type { Product } from '../../types';
import { useProductsStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';
import { LazyImage } from '../ui/LazyImage';
import { PriceCalculator } from './PriceCalculator';
import { ProductMediaModal } from './ProductMediaModal';

interface ProductCardProps {
  product: Product;
}

// Status colors for left neon bar
const STATUS_COLORS = {
  protected: {
    bar: 'bg-emerald-500',
    shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-400',
  },
  active: { bar: 'bg-slate-600', shadow: '', text: 'text-slate-400' },
  triggered: {
    bar: 'bg-rose-500',
    shadow: 'shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    text: 'text-rose-400',
  },
  disabled: { bar: 'bg-slate-700', shadow: '', text: 'text-slate-500' },
} as const;

export function ProductCard({ product }: ProductCardProps) {
  const updateProduct = useProductsStore(s => s.updateProduct);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(product.minPrice.toString());
  const [costPriceInput, setCostPriceInput] = useState((product.costPrice || 0).toString());
  const [editingField, setEditingField] = useState<'min' | 'cost' | null>(null);

  const statusConfig =
    STATUS_COLORS[product.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.active;

  // Calculate margin if we have cost price
  const margin =
    product.costPrice && product.costPrice > 0
      ? Math.round(((product.currentPrice - product.costPrice) / product.currentPrice) * 100)
      : null;

  const isProtected = product.minPrice > 0;
  const isSafe = product.currentPrice >= product.minPrice;

  // Save handlers
  const handleSaveMinPrice = useCallback(async () => {
    setEditingField(null);
    const newMinPrice = parseFloat(minPriceInput) || 0;

    if (newMinPrice !== product.minPrice) {
      hapticFeedback('light');
      updateProduct(product.id, {
        minPrice: newMinPrice,
        status: newMinPrice > 0 ? 'protected' : 'active',
      });

      try {
        const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
          ?.WebApp;
        const initData = tg?.initData || 'demo';
        await fetch('/api?action=products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
          body: JSON.stringify({ productId: product.productId, minPrice: newMinPrice }),
        });
      } catch (error) {
        console.error('Failed to save min price:', error);
      }
    }
  }, [minPriceInput, product.id, product.productId, product.minPrice, updateProduct]);

  const handleSaveCostPrice = useCallback(async () => {
    setEditingField(null);
    const newCostPrice = parseFloat(costPriceInput) || 0;

    if (newCostPrice !== (product.costPrice || 0)) {
      hapticFeedback('light');
      updateProduct(product.id, { costPrice: newCostPrice });

      try {
        const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
          ?.WebApp;
        const initData = tg?.initData || 'demo';
        await fetch('/api?action=products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
          body: JSON.stringify({ productId: product.productId, costPrice: newCostPrice }),
        });
      } catch (error) {
        console.error('Failed to save cost price:', error);
      }
    }
  }, [costPriceInput, product.id, product.productId, product.costPrice, updateProduct]);

  return (
    <motion.div
      className="product-card group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Left Neon Status Bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${statusConfig.bar} ${statusConfig.shadow}`}
      />

      {/* Triggered overlay */}
      {product.status === 'triggered' && (
        <motion.div
          className="absolute inset-0 bg-rose-500/5 pointer-events-none rounded-xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="flex gap-4 pl-3">
        {/* Product Image - Compact Square */}
        <div
          className="w-20 h-20 rounded-lg bg-slate-800/80 overflow-hidden shrink-0 cursor-pointer relative group/img"
          onClick={() => setShowMedia(true)}
        >
          {/* Media count badge */}
          {(product.mediaAssets?.length ?? 0) > 0 && (
            <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10">
              <ImageIcon className="w-2.5 h-2.5" />
              {product.mediaAssets?.length}
            </div>
          )}

          {product.imageUrl ? (
            <LazyImage src={product.imageUrl} alt={product.title} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Package className="w-6 h-6" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-violet-500/0 group-hover/img:bg-violet-500/20 transition-colors flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Title + Badges Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white truncate pr-2" title={product.title}>
                {product.title}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">{product.vendorCode}</p>
            </div>

            {/* Marketplace Badge */}
            <span
              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                product.marketplace === 'WB' ? 'badge-wb' : 'badge-ozon'
              }`}
            >
              {product.marketplace}
            </span>
          </div>

          {/* Price Row - Hero */}
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {product.currentPrice.toLocaleString('ru-RU')}
              <span className="text-base text-slate-400 ml-0.5">₽</span>
            </span>

            {/* Margin indicator */}
            {margin !== null && (
              <span
                className={`text-xs font-mono flex items-center gap-0.5 ${margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}
              >
                {margin >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {margin}%
              </span>
            )}

            {/* Protection status */}
            {isProtected && (
              <span
                className={`text-[10px] flex items-center gap-1 ${isSafe ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                <Shield className="w-3 h-3" />
                {isSafe ? 'OK' : '!'}
              </span>
            )}
          </div>

          {/* Editable Fields Row */}
          <div className="flex gap-2 mb-3">
            {/* Cost Price */}
            <div
              className={`flex-1 bg-slate-800/50 rounded-lg px-3 py-2 cursor-pointer transition-all ${
                editingField === 'cost' ? 'ring-1 ring-violet-500' : 'hover:bg-slate-800'
              }`}
              onClick={() => !editingField && setEditingField('cost')}
            >
              <p className="text-[10px] text-slate-500 mb-0.5">Себестоимость</p>
              {editingField === 'cost' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={costPriceInput}
                  onChange={e => setCostPriceInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={handleSaveCostPrice}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCostPrice()}
                  autoFocus
                  className="w-full bg-transparent text-sm font-bold font-mono text-violet-400 outline-none"
                  placeholder="0"
                />
              ) : (
                <p className="text-sm font-bold font-mono text-violet-400">
                  {(product.costPrice || 0) > 0
                    ? `${product.costPrice?.toLocaleString('ru-RU')} ₽`
                    : '—'}
                </p>
              )}
            </div>

            {/* Min Price (Stop-Loss) */}
            <div
              className={`flex-1 bg-slate-800/50 rounded-lg px-3 py-2 cursor-pointer transition-all ${
                editingField === 'min' ? 'ring-1 ring-violet-500' : 'hover:bg-slate-800'
              }`}
              onClick={() => !editingField && setEditingField('min')}
            >
              <p className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                Stop-Loss
                <Shield className="w-2.5 h-2.5" />
              </p>
              {editingField === 'min' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={minPriceInput}
                  onChange={e => setMinPriceInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={handleSaveMinPrice}
                  onKeyDown={e => e.key === 'Enter' && handleSaveMinPrice()}
                  autoFocus
                  className="w-full bg-transparent text-sm font-bold font-mono text-emerald-400 outline-none"
                  placeholder="0"
                />
              ) : (
                <p
                  className={`text-sm font-bold font-mono ${isProtected ? 'text-emerald-400' : 'text-slate-500'}`}
                >
                  {product.minPrice > 0
                    ? `${product.minPrice.toLocaleString('ru-RU')} ₽`
                    : 'Установить'}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex gap-2">
            {/* SMM Button */}
            <button
              className="btn-smm"
              onClick={() => {
                hapticFeedback('light');
                // TODO: Integrate with ContentSpecialist
                console.log('SMM for product:', product.productId);
              }}
            >
              <Wand2 className="w-3 h-3" />
              SMM-Пост
            </button>

            {/* Calculator Button */}
            <button
              className="text-[11px] bg-slate-800/50 text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1"
              onClick={() => setShowCalculator(true)}
            >
              <Calculator className="w-3 h-3" />
              Калькулятор
            </button>

            {/* Stock */}
            <div className="ml-auto text-[11px] text-slate-500 flex items-center gap-1">
              <Package className="w-3 h-3" />
              {product.stock} шт
            </div>
          </div>
        </div>
      </div>

      {/* Price Calculator Modal */}
      {showCalculator && (
        <PriceCalculator
          marketplace={product.marketplace}
          initialCostPrice={product.costPrice}
          onCalculated={calculatedPrice => {
            setMinPriceInput(calculatedPrice.toString());
            hapticFeedback('light');
            updateProduct(product.id, {
              minPrice: calculatedPrice,
              status: calculatedPrice > 0 ? 'protected' : 'active',
            });

            (async () => {
              try {
                const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
                  .Telegram?.WebApp;
                const initData = tg?.initData || 'demo';
                await fetch('/api?action=products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
                  body: JSON.stringify({ productId: product.productId, minPrice: calculatedPrice }),
                });
              } catch (error) {
                console.error('Failed to save:', error);
              }
            })();
          }}
          onClose={() => setShowCalculator(false)}
        />
      )}

      {/* Media Modal */}
      <ProductMediaModal
        isOpen={showMedia}
        onClose={() => setShowMedia(false)}
        product={product}
        onUpdate={newAsset => {
          if (newAsset) {
            const currentAssets = product.mediaAssets || [];
            updateProduct(product.id, {
              mediaAssets: [...currentAssets, newAsset],
              updatedAt: new Date(),
            });
          } else {
            updateProduct(product.id, { updatedAt: new Date() });
          }
        }}
      />
    </motion.div>
  );
}
