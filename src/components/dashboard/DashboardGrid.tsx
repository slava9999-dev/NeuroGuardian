import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore, selectFilteredProducts } from '../../stores';
import { ProductCard } from './ProductCard';
import { Search, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Product } from '../../types';

interface DashboardGridProps {
  onOpenSMM?: (product: Product) => void;
  onOpenCalculator?: (product: Product) => void;
  onOpenMedia?: (product: Product) => void;
}

export function DashboardGrid({ onOpenSMM, onOpenCalculator, onOpenMedia }: DashboardGridProps) {
  const products = useProductsStore(useShallow(selectFilteredProducts));
  const totalInCatalog = useProductsStore(state => state.products.length);
  const isLoading = useProductsStore(state => state.isLoading);

  // Progressive Loading State
  const [visibleCount, setVisibleCount] = useState(12);
  const [prevProducts, setPrevProducts] = useState(products);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change (new products list)
  // implementing derived state pattern to avoid useEffect state update
  if (products !== prevProducts) {
    setPrevProducts(products);
    setVisibleCount(12);
  }

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 12, products.length));
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, products.length]);

  // Alive Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="relative">
          <motion.div
            className="w-16 h-16 rounded-full bg-violet-100 blur-xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-violet-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-slate-700">Синхронизация с нейросетью...</h3>
          <p className="text-sm text-slate-400">Это займет всего пару секунд</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    // If entire catalog is empty, return null (ProductsPage will show broad empty state)
    if (totalInCatalog === 0) return null;

    // Otherwise, this is a "nothing found by filters" state
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-6 shadow-xs">
          <Search className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Товары не найдены</h3>
        <p className="text-slate-500 mt-2 max-w-xs mx-auto">
          Попробуйте изменить параметры поиска или сбросить фильтры
        </p>
        <button
          onClick={() => useProductsStore.getState().setSearchQuery('')}
          className="mt-6 text-violet-600 font-semibold text-sm hover:underline"
        >
          Сбросить фильтры
        </button>
      </div>
    );
  }

  const visibleProducts = products.slice(0, visibleCount);

  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {visibleProducts.map(product => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ProductCard
                product={product}
                onUpdate={updated => useProductsStore.getState().updateProduct(product.id, updated)}
                onOpenSMM={onOpenSMM}
                onOpenCalculator={onOpenCalculator}
                onOpenMedia={onOpenMedia}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scroll Guardian (Sentinel) */}
      {visibleCount < products.length && (
        <div
          ref={loadMoreRef}
          className="py-12 flex flex-col items-center justify-center opacity-60"
        >
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-medium text-slate-400">Загрузка товаров...</span>
        </div>
      )}
    </div>
  );
}
