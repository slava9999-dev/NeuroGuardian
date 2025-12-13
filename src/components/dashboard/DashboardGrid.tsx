// ============================================
// NeuroGUARDIAN — DashboardGrid Component
// Grid of product cards with filters
// ============================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductsStore } from '../../stores';
import { ProductCard } from './ProductCard';
import type { Marketplace, ProductStatus } from '../../types';

export function DashboardGrid() {
  const products = useProductsStore((state) => state.products);
  const isLoading = useProductsStore((state) => state.isLoading);
  const marketplaceFilter = useProductsStore((state) => state.marketplaceFilter);
  const statusFilter = useProductsStore((state) => state.statusFilter);
  const searchQuery = useProductsStore((state) => state.searchQuery);
  const sortBy = useProductsStore((state) => state.sortBy);
  const sortOrder = useProductsStore((state) => state.sortOrder);
  const setMarketplaceFilter = useProductsStore((state) => state.setMarketplaceFilter);
  const setStatusFilter = useProductsStore((state) => state.setStatusFilter);
  const setSearchQuery = useProductsStore((state) => state.setSearchQuery);

  // Memoize filtered products to prevent infinite re-renders
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter((p) => p.marketplace === marketplaceFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.vendorCode.toLowerCase().includes(query) ||
          p.nmId?.toString().includes(query) ||
          p.offerId?.toLowerCase().includes(query)
      );
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'price':
          comparison = a.currentPrice - b.currentPrice;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastChecked':
          comparison = new Date(a.lastCheckedAt).getTime() - new Date(b.lastCheckedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [products, marketplaceFilter, statusFilter, searchQuery, sortBy, sortOrder]);

  // Memoize stats
  const stats = useMemo(() => ({
    total: products.length,
    wbCount: products.filter((p) => p.marketplace === 'WB').length,
    ozonCount: products.filter((p) => p.marketplace === 'Ozon').length,
    activeCount: products.filter((p) => p.status === 'active').length,
    triggeredCount: products.filter((p) => p.status === 'triggered').length,
    protectedCount: products.filter((p) => p.minPrice > 0).length,
  }), [products]);
  
  const [showFilters, setShowFilters] = useState(false);
  
  const marketplaceOptions: { value: Marketplace | 'all'; label: string; color: string }[] = [
    { value: 'all', label: 'Все', color: 'bg-stone-600' },
    { value: 'WB', label: 'Wildberries', color: 'bg-purple-500' },
    { value: 'Ozon', label: 'Ozon', color: 'bg-blue-500' },
  ];
  
  const statusOptions: { value: ProductStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все статусы' },
    { value: 'active', label: 'Активные' },
    { value: 'protected', label: 'Защищённые' },
    { value: 'triggered', label: 'Сработавшие' },
  ];
  
  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        <div className="glass-panel px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <span className="text-stone-400 text-sm">Всего:</span>
          <span className="font-bold text-white">{stats.total}</span>
        </div>
        
        <div className="glass-panel px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="font-bold text-white">{stats.wbCount}</span>
        </div>
        
        <div className="glass-panel px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="font-bold text-white">{stats.ozonCount}</span>
        </div>
        
        <div className="glass-panel px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-stone-400 text-sm">Защищено:</span>
          <span className="font-bold text-emerald-400">{stats.protectedCount}</span>
        </div>
        
        {stats.triggeredCount > 0 && (
          <div 
            className="glass-panel px-4 py-2 flex items-center gap-2 whitespace-nowrap bg-red-500/20 border-red-500/30"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-stone-400 text-sm">Атаки:</span>
            <span className="font-bold text-red-400">{stats.triggeredCount}</span>
          </div>
        )}
      </div>
      
      {/* Search and filters */}
      <div className="mb-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по названию или артикулу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-12 pr-12"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            w-full flex items-center justify-between px-4 py-3 rounded-xl
            transition-all
            ${showFilters 
              ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400' 
              : 'bg-stone-800/50 border border-stone-700 text-stone-400'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Фильтры</span>
            {(marketplaceFilter !== 'all' || statusFilter !== 'all') && (
              <span className="px-2 py-0.5 bg-amber-500 text-stone-900 text-xs font-bold rounded-full">
                {[marketplaceFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
          </div>
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ rotate: showFilters ? 180 : 0 }}
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </button>
        
        {/* Filter options */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-panel p-4 space-y-4">
                {/* Marketplace filter */}
                <div>
                  <p className="text-sm text-stone-400 mb-2">Маркетплейс</p>
                  <div className="flex gap-2">
                    {marketplaceOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMarketplaceFilter(opt.value)}
                        className={`
                          flex-1 py-2 rounded-xl text-sm font-medium transition-all
                          ${marketplaceFilter === opt.value
                            ? `${opt.color} text-white`
                            : 'bg-stone-800 text-stone-400 hover:text-white'
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Status filter */}
                <div>
                  <p className="text-sm text-stone-400 mb-2">Статус</p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        className={`
                          px-4 py-2 rounded-xl text-sm font-medium transition-all
                          ${statusFilter === opt.value
                            ? 'bg-amber-500 text-stone-900'
                            : 'bg-stone-800 text-stone-400 hover:text-white'
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Products grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <motion.div
              className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400">
            <svg
              className="w-16 h-16 mb-4 opacity-50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96 12 12.01l8.73-5.05" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p className="text-lg font-medium">
              {products.length === 0 ? 'Нет товаров' : 'Ничего не найдено'}
            </p>
            <p className="text-sm">
              {products.length === 0 
                ? 'Подключите API для синхронизации'
                : 'Попробуйте изменить фильтры'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
