// ============================================
// NeuroGUARDIAN — ProductCard Component
// Individual product card with status and controls
// ============================================

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '../../types';
import { useProductsStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';

interface ProductCardProps {
  product: Product;
}

interface StatusConfig {
  color: string;
  label: string;
  glow: boolean;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active: {
    color: 'bg-stone-500',
    label: 'Активен',
    glow: false,
  },
  protected: {
    color: 'bg-emerald-500',
    label: 'Защищен',
    glow: true,
  },
  triggered: {
    color: 'bg-red-500',
    label: 'АТАКА',
    glow: true,
    pulse: true,
  },
  disabled: {
    color: 'bg-stone-600',
    label: 'Отключен',
    glow: false,
  },
};

export function ProductCard({ product }: ProductCardProps) {
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(product.minPrice.toString());
  
  const status = STATUS_CONFIG[product.status];
  
  const handleMinPriceBlur = useCallback(() => {
    setIsEditing(false);
    const newMinPrice = parseFloat(minPriceInput) || 0;
    
    if (newMinPrice !== product.minPrice) {
      hapticFeedback('light');
      updateProduct(product.id, { 
        minPrice: newMinPrice,
        status: newMinPrice > 0 ? 'protected' : 'active',
      });
      // TODO: Sync with Firestore
    }
  }, [minPriceInput, product.id, product.minPrice, updateProduct]);
  
  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and one decimal point
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setMinPriceInput(value);
  };
  
  const priceDiff = product.currentPrice - product.minPrice;
  const pricePercent = product.minPrice > 0 
    ? ((product.currentPrice / product.minPrice) * 100 - 100).toFixed(1)
    : null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel glass-panel-hover p-4 relative overflow-hidden"
    >
      {/* Triggered animation overlay */}
      {product.status === 'triggered' && (
        <motion.div
          className="absolute inset-0 bg-red-500/10 pointer-events-none"
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      
      {/* Header: Image + Title + Status */}
      <div className="flex gap-3 mb-3">
        {/* Product image */}
        <div className="w-16 h-16 rounded-xl bg-stone-800 overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Title and meta */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate" title={product.title}>
            {product.title}
          </h3>
          <p className="text-xs text-stone-400 font-mono">
            {product.vendorCode}
          </p>
          
          {/* Status badge */}
          <div className="flex items-center gap-2 mt-1">
            <div className={`
              flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${status.color} ${status.glow ? 'shadow-lg' : ''}
            `}>
              <span className={`
                w-1.5 h-1.5 rounded-full bg-current
                ${status.pulse ? 'animate-pulse' : ''}
              `} />
              {status.label}
            </div>
            
            {/* Marketplace badge */}
            <span className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${product.marketplace === 'WB' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'bg-blue-500/20 text-blue-400'
              }
            `}>
              {product.marketplace}
            </span>
          </div>
        </div>
      </div>
      
      {/* Price info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Current price */}
        <div className="bg-stone-800/50 rounded-xl p-3">
          <p className="text-xs text-stone-400 mb-1">Текущая цена</p>
          <p className="text-lg font-bold text-white">
            {product.currentPrice.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        
        {/* Min price (editable) */}
        <div 
          className={`
            bg-stone-800/50 rounded-xl p-3 transition-all
            ${isEditing ? 'ring-2 ring-amber-500' : ''}
          `}
        >
          <p className="text-xs text-stone-400 mb-1">Stop-Loss</p>
          {isEditing ? (
            <input
              type="text"
              inputMode="decimal"
              value={minPriceInput}
              onChange={handleMinPriceChange}
              onBlur={handleMinPriceBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleMinPriceBlur()}
              autoFocus
              className="w-full bg-transparent text-lg font-bold text-amber-400 outline-none"
            />
          ) : (
            <p 
              className="text-lg font-bold text-amber-400 cursor-pointer hover:text-amber-300"
              onClick={() => {
                setIsEditing(true);
                setMinPriceInput(product.minPrice.toString());
              }}
            >
              {product.minPrice > 0 
                ? `${product.minPrice.toLocaleString('ru-RU')} ₽`
                : 'Установить'
              }
            </p>
          )}
        </div>
      </div>
      
      {/* Footer: Price diff + Stock */}
      <div className="flex items-center justify-between text-xs">
        {/* Price difference */}
        {product.minPrice > 0 && (
          <div className={`
            flex items-center gap-1
            ${priceDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}
          `}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {priceDiff >= 0 ? (
                <path d="m18 15-6-6-6 6" />
              ) : (
                <path d="m6 9 6 6 6-6" />
              )}
            </svg>
            <span>
              {priceDiff >= 0 ? '+' : ''}{priceDiff.toLocaleString('ru-RU')} ₽
              {pricePercent && ` (${pricePercent}%)`}
            </span>
          </div>
        )}
        
        {/* Stock */}
        <div className="flex items-center gap-1 text-stone-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span>{product.stock} шт</span>
        </div>
      </div>
    </motion.div>
  );
}
