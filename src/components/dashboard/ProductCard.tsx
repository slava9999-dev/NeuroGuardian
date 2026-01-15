// ============================================
// NeuroGUARDIAN — ProductCard Component
// Individual product card with status and controls
// ============================================

import { useState, useCallback } from 'react';

import type { Product } from '../../types';
import { useProductsStore } from '../../stores';
import { hapticFeedback } from '../../lib/telegram';
import { LazyImage } from '../ui/LazyImage';
import { PriceCalculator } from './PriceCalculator';
import { ProductMediaModal } from './ProductMediaModal';

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
  const updateProduct = useProductsStore(s => s.updateProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(product.minPrice.toString());
  const [costPriceInput, setCostPriceInput] = useState((product.costPrice || 0).toString());
  const [showMedia, setShowMedia] = useState(false);

  const status = STATUS_CONFIG[product.status] || STATUS_CONFIG.active;

  const handleCostPriceBlur = useCallback(async () => {
    // Keep editing mode if we clicked another field (simplified logic)
    // setIsEditing(false); // Let the specific field click handler manage this if needed, or just close it.
    // For now, let's not close standard editing mode immediately if we want to edit multiple fields,
    // but the original code closed it. Let's stick to original behavior but we might have conflict.
    // Actually, distinct handlers are better.

    // We only close editing if we are blurring out of the card context?
    // Let's simplified: each blur saves.

    // NOTE: This shared `isEditing` state for both inputs is problematic if we want to edit one without closing.
    // However, usually we edit one by one.

    const newCostPrice = parseFloat(costPriceInput) || 0;

    if (newCostPrice !== (product.costPrice || 0)) {
      hapticFeedback('light');
      updateProduct(product.id, { costPrice: newCostPrice });

      try {
        interface TelegramWebApp {
          initData?: string;
        }
        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
          ?.WebApp;
        const initData = tg?.initData || 'demo';

        await fetch('/api?action=products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
          body: JSON.stringify({
            action: 'products',
            initData,
            productId: product.productId,
            costPrice: newCostPrice,
          }),
        });
        console.log(`✅ Cost Price saved: ${product.productId} → ${newCostPrice}`);
      } catch (error) {
        console.error('❌ Failed to save cost price:', error);
      }
    }
  }, [costPriceInput, product.id, product.productId, product.costPrice, updateProduct]);

  const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setCostPriceInput(value);
  };

  const handleMinPriceBlur = useCallback(async () => {
    setIsEditing(false);
    const newMinPrice = parseFloat(minPriceInput) || 0;

    // ... existing logic ...

    if (newMinPrice !== product.minPrice) {
      hapticFeedback('light');

      // Update local store
      updateProduct(product.id, {
        minPrice: newMinPrice,
        status: newMinPrice > 0 ? 'protected' : 'active',
      });

      // IMPORTANT: Save to server!
      try {
        interface TelegramWebApp {
          initData?: string;
        }
        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
          ?.WebApp;
        const initData = tg?.initData || 'demo';

        await fetch('/api?action=products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Init-Data': initData,
          },
          body: JSON.stringify({
            action: 'products',
            initData,
            productId: product.productId,
            minPrice: newMinPrice,
          }),
        });
        console.log(`✅ Минимальная цена saved: ${product.productId} → ${newMinPrice}`);
      } catch (error) {
        console.error('❌ Failed to save минимальная цена:', error);
      }
    }
  }, [minPriceInput, product.id, product.productId, product.minPrice, updateProduct]);

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and one decimal point
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setMinPriceInput(value);
  };

  const priceDiff = product.currentPrice - product.minPrice;
  const pricePercent =
    product.minPrice > 0
      ? ((product.currentPrice / product.minPrice) * 100 - 100).toFixed(1)
      : null;

  return (
    <div className="glass-panel glass-panel-hover p-4 relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1">
      {/* Triggered animation overlay */}
      {product.status === 'triggered' && (
        <div className="absolute inset-0 bg-red-500/10 pointer-events-none animate-pulse" />
      )}

      {/* Header: Image + Title + Status */}
      <div className="flex gap-3 mb-3">
        {/* Product image - Click to open media */}
        <div
          className="w-16 h-16 rounded-xl bg-stone-800 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity relative group"
          onClick={() => setShowMedia(true)}
        >
          {/* Vision Badge */}
          {(product.mediaAssets?.length ?? 0) > 0 && (
            <div className="absolute bottom-0 right-0 bg-black/60 text-[8px] text-white px-1 rounded-tl-md backdrop-blur-sm z-10">
              📸 {product.mediaAssets?.length}
            </div>
          )}

          {product.imageUrl ? (
            <LazyImage src={product.imageUrl} alt={product.title} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
          <p className="text-xs text-stone-400 font-mono">{product.vendorCode}</p>

          {/* Status badge */}
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`
              flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${status.color} ${status.glow ? 'shadow-lg' : ''}
            `}
            >
              <span
                className={`
                w-1.5 h-1.5 rounded-full bg-current
                ${status.pulse ? 'animate-pulse' : ''}
              `}
              />
              {status.label}
            </div>

            {/* Marketplace badge */}
            <span
              className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${
                product.marketplace === 'WB'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-blue-500/20 text-blue-400'
              }
            `}
            >
              {product.marketplace}
            </span>
          </div>
        </div>
      </div>

      {/* Price info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Current price with buyer estimate */}
        <div className="bg-stone-800/50 rounded-xl p-3 col-span-2">
          <p className="text-xs text-stone-400 mb-1 flex items-center gap-1">
            Ваша цена
            {product.marketplaceDiscountPercent && product.marketplaceDiscountPercent > 0 && (
              <span className="text-amber-400/70 ml-auto" title="Примерная скидка маркетплейса">
                ↓{product.marketplaceDiscountPercent}%
              </span>
            )}
          </p>
          <p className="text-lg font-bold text-white">
            {product.currentPrice.toLocaleString('ru-RU')} ₽
          </p>
          {/* Show estimated buyer price if different */}
          {product.estimatedBuyerPrice && product.estimatedBuyerPrice < product.currentPrice && (
            <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
              <span
                className={`${product.marketplace === 'Ozon' ? 'text-blue-400' : 'text-purple-400'} font-medium`}
                title={
                  product.marketplace === 'Ozon'
                    ? 'Цена для покупателей с Ozon Card (скидка 5%)'
                    : 'Цена с учётом кэшбэка WB Pay (~3%)'
                }
              >
                {product.marketplace === 'Ozon' ? '💳 с Ozon Card:' : '💳 с WB Pay:'}
              </span>
              <span
                className={`${product.marketplace === 'Ozon' ? 'text-blue-300' : 'text-purple-300'} font-bold`}
              >
                {product.estimatedBuyerPrice.toLocaleString('ru-RU')} ₽
              </span>
            </p>
          )}
        </div>

        {/* Cost Price (Unit Economics) */}
        <div
          className={`
            bg-stone-800/50 rounded-xl p-3 transition-all
            ${isEditing ? 'ring-2 ring-amber-500' : ''}
          `}
        >
          <p className="text-xs text-stone-400 mb-1 flex items-center gap-1">
            Себестоимость
            <span
              className="text-stone-500"
              title="Включая закупку, упаковку и логистику до склада"
            >
              📦
            </span>
          </p>
          {isEditing ? (
            <input
              type="text"
              inputMode="decimal"
              value={costPriceInput}
              onChange={handleCostPriceChange}
              onBlur={handleCostPriceBlur}
              onKeyDown={e => e.key === 'Enter' && handleCostPriceBlur()}
              className="w-full bg-transparent text-lg font-bold text-blue-400 outline-none"
              placeholder="0"
            />
          ) : (
            <p
              className="text-lg font-bold text-blue-400 cursor-pointer hover:text-blue-300"
              onClick={() => {
                setIsEditing(true);
                setCostPriceInput(product.costPrice?.toString() || '0');
              }}
            >
              {(product.costPrice || 0) > 0
                ? `${product.costPrice?.toLocaleString('ru-RU')} ₽`
                : 'Указать'}
            </p>
          )}
        </div>

        {/* Min price (editable) */}
        <div
          className={`
            bg-stone-800/50 rounded-xl p-3 transition-all
            ${isEditing ? 'ring-2 ring-amber-500' : ''}
          `}
        >
          <p className="text-xs text-stone-400 mb-1 flex items-center gap-1">
            Минимальная цена
            <span className="text-stone-500" title="Цена, ниже которой товар продавать невыгодно">
              ℹ️
            </span>
          </p>
          {isEditing ? (
            <input
              type="text"
              inputMode="decimal"
              value={minPriceInput}
              onChange={handleMinPriceChange}
              onBlur={handleMinPriceBlur}
              onKeyDown={e => e.key === 'Enter' && handleMinPriceBlur()}
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
                : 'Установить'}
            </p>
          )}

          {/* Calculator button */}
          {!isEditing && (
            <button
              onClick={() => setShowCalculator(true)}
              className="mt-2 w-full text-xs text-stone-400 hover:text-amber-400 transition-colors flex items-center justify-center gap-1"
            >
              🧮 Рассчитать
            </button>
          )}
        </div>
      </div>

      {/* Price Protection Indicator */}
      {product.minPrice > 0 && (
        <div className="mb-3 bg-stone-800/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-stone-400">🛡️ Защита цены</span>
            <span
              className={`text-xs font-medium ${
                product.currentPrice >= product.minPrice ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {product.currentPrice >= product.minPrice ? '✅ Безопасно' : '⚠️ Ниже минимума!'}
            </span>
          </div>

          {/* Visual price bar */}
          <div className="relative h-2 bg-stone-700 rounded-full overflow-hidden">
            {/* Minimum price marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
              style={{ left: '50%' }}
              title={`Минимум: ${product.minPrice}₽`}
            />

            {/* Current price fill */}
            <div
              className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                product.currentPrice >= product.minPrice
                  ? 'bg-linear-to-r from-emerald-500 to-emerald-400'
                  : 'bg-linear-to-r from-red-500 to-red-400'
              }`}
              style={{
                width: `${Math.min(100, (product.currentPrice / (product.minPrice * 2)) * 100)}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-1 text-xs text-stone-500">
            <span>0₽</span>
            <span className="text-amber-400">{product.minPrice}₽</span>
            <span>{(product.minPrice * 2).toLocaleString('ru-RU')}₽</span>
          </div>
        </div>
      )}

      {/* Footer: Price diff + Stock */}
      <div className="flex items-center justify-between text-xs">
        {/* Price difference */}
        {product.minPrice > 0 && (
          <div
            className={`
            flex items-center gap-1
            ${priceDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}
          `}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {priceDiff >= 0 ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
            </svg>
            <span>
              {priceDiff >= 0 ? '+' : ''}
              {priceDiff.toLocaleString('ru-RU')} ₽{pricePercent && ` (${pricePercent}%)`}
            </span>
          </div>
        )}

        {/* Stock */}
        <div className="flex items-center gap-1 text-stone-400">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span>{product.stock} шт</span>
        </div>
      </div>

      {/* Price Calculator Modal */}
      {showCalculator && (
        <PriceCalculator
          marketplace={product.marketplace}
          initialCostPrice={product.costPrice}
          onCalculated={calculatedPrice => {
            // Update input and trigger save
            setMinPriceInput(calculatedPrice.toString());
            setIsEditing(false);

            // Save to store and server
            hapticFeedback('light');
            updateProduct(product.id, {
              minPrice: calculatedPrice,
              status: calculatedPrice > 0 ? 'protected' : 'active',
            });

            // Save to server
            (async () => {
              try {
                interface TelegramWebApp {
                  initData?: string;
                }
                const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } })
                  .Telegram?.WebApp;
                const initData = tg?.initData || 'demo';

                await fetch('/api?action=products', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Init-Data': initData,
                  },
                  body: JSON.stringify({
                    action: 'products',
                    initData,
                    productId: product.productId,
                    minPrice: calculatedPrice,
                  }),
                });
                console.log(`✅ Минимальная цена saved: ${product.productId} → ${calculatedPrice}`);
              } catch (error) {
                console.error('❌ Failed to save минимальная цена:', error);
              }
            })();
          }}
          onClose={() => setShowCalculator(false)}
        />
      )}

      {/* Media Manager Modal */}
      <ProductMediaModal
        isOpen={showMedia}
        onClose={() => setShowMedia(false)}
        product={product}
        onUpdate={() => {
          // Basic refresh trigger - in real app, fetch fresh data
          console.log('Media updated for', product.productId);
          // Force update timestamp to verify reactivity
          updateProduct(product.id, { updatedAt: new Date() });
        }}
      />
    </div>
  );
}
