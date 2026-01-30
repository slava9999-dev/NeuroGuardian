import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore, selectFilteredProducts } from '../../stores';
import { ProductCard } from './ProductCard';
import { Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ViktorCore } from '../ui/ViktorCore';
import type { Product } from '../../types';

interface DashboardGridProps {
  onOpenCalculator?: (product: Product) => void;
}

export function DashboardGrid({ onOpenCalculator }: DashboardGridProps) {
  const products = useProductsStore(useShallow(selectFilteredProducts));
  const totalInCatalog = useProductsStore(state => state.products.length);
  const isLoading = useProductsStore(state => state.isLoading);

  // Progressive Loading State
  const [visibleCount, setVisibleCount] = useState(12);
  const [prevProducts, setPrevProducts] = useState(products);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
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

  // Premium Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white/40 rounded-[32px] border border-black/5 animate-pulse">
        <ViktorCore size="lg" animate />
        <div className="text-center space-y-1">
          <h3 className="text-sm font-black text-black/80 uppercase tracking-tighter">
            Синхронизация потоков...
          </h3>
          <p className="text-[10px] font-medium text-black/30">Загрузка данных из облака Neuro</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    if (totalInCatalog === 0) return null;

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="size-20 rounded-3xl bg-black/5 flex items-center justify-center mx-auto mb-6">
          <Search size={32} className="text-black/10" />
        </div>
        <h3 className="text-base font-black text-black/80 tracking-tight">Ничего не найдено</h3>
        <p className="text-[10px] font-medium text-black/40 mt-1 max-w-[180px] mx-auto">
          Попробуйте изменить запрос или сбросьте активные фильтры
        </p>
        <button
          onClick={() => useProductsStore.getState().setSearchQuery('')}
          className="mt-6 text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/20 pb-0.5"
        >
          Сбросить все
        </button>
      </div>
    );
  }

  const visibleProducts = products.slice(0, visibleCount);

  return (
    <div className="pb-32">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="popLayout">
          {visibleProducts.map(product => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ProductCard
                product={product}
                onUpdate={updated => useProductsStore.getState().updateProduct(product.id, updated)}
                onOpenCalculator={onOpenCalculator}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scroll Sentinel */}
      {visibleCount < products.length && (
        <div
          ref={loadMoreRef}
          className="py-12 flex flex-col items-center justify-center opacity-40"
        >
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-[10px] font-black uppercase tracking-widest">Прогрузка...</span>
        </div>
      )}
    </div>
  );
}
