import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore, selectFilteredProducts } from '../../stores';
import { ProductCard } from './ProductCard';
import { Package } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

export function DashboardGrid() {
  const products = useProductsStore(useShallow(selectFilteredProducts));
  const totalInCatalog = useProductsStore(state => state.products.length);
  const isLoading = useProductsStore(state => state.isLoading);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <motion.div
          className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Загрузка данных...
        </span>
      </div>
    );
  }

  if (products.length === 0) {
    // If entire catalog is empty, return null (ProductsPage will show broad empty state)
    if (totalInCatalog === 0) return null;

    // Otherwise, this is a "nothing found by filters" state
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
        <div className="w-16 h-16 rounded-2xl bg-white/2 flex items-center justify-center mx-auto mb-6">
          <Package className="w-8 h-8 text-zinc-800" />
        </div>
        <h3 className="text-sm font-black uppercase text-zinc-400">Ничего не найдено</h3>
        <p className="text-[10px] text-zinc-600 uppercase font-bold mt-1">
          Попробуйте изменить параметры поиска
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
      <AnimatePresence mode="popLayout">
        {products.map(product => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <ProductCard
              product={product}
              onUpdate={updated => useProductsStore.getState().updateProduct(product.id, updated)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
