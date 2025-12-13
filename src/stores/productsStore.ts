// ============================================
// NeuroGUARDIAN — Zustand Products Store
// Products state management
// ============================================

import { create } from 'zustand';
import type { Product, Marketplace, ProductStatus } from '../types';

interface ProductsState {
  // Data
  products: Product[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  marketplaceFilter: Marketplace | 'all';
  statusFilter: ProductStatus | 'all';
  searchQuery: string;
  sortBy: 'title' | 'price' | 'status' | 'lastChecked';
  sortOrder: 'asc' | 'desc';
  
  // Computed (derived in selectors)
  
  // Actions
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  
  // Filter actions
  setMarketplaceFilter: (marketplace: Marketplace | 'all') => void;
  setStatusFilter: (status: ProductStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'title' | 'price' | 'status' | 'lastChecked') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  clearFilters: () => void;
  
  // State actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProductsStore = create<ProductsState>()((set) => ({
  // Initial state
  products: [],
  isLoading: false,
  error: null,
  
  // Default filters
  marketplaceFilter: 'all',
  statusFilter: 'all',
  searchQuery: '',
  sortBy: 'title',
  sortOrder: 'asc',
  
  // Data actions
  setProducts: (products) => set({ products, isLoading: false, error: null }),
  
  addProduct: (product) => set((state) => ({
    products: [...state.products, product],
  })),
  
  updateProduct: (id, updates) => set((state) => ({
    products: state.products.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
    ),
  })),
  
  removeProduct: (id) => set((state) => ({
    products: state.products.filter((p) => p.id !== id),
  })),
  
  // Filter actions
  setMarketplaceFilter: (marketplace) => set({ marketplaceFilter: marketplace }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (order) => set({ sortOrder: order }),
  
  clearFilters: () => set({
    marketplaceFilter: 'all',
    statusFilter: 'all',
    searchQuery: '',
  }),
  
  // State actions
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}));

// ============================================
// Selectors (for computed values)
// ============================================

export const selectFilteredProducts = (state: ProductsState): Product[] => {
  let filtered = [...state.products];
  
  // Filter by marketplace
  if (state.marketplaceFilter !== 'all') {
    filtered = filtered.filter((p) => p.marketplace === state.marketplaceFilter);
  }
  
  // Filter by status
  if (state.statusFilter !== 'all') {
    filtered = filtered.filter((p) => p.status === state.statusFilter);
  }
  
  // Filter by search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.vendorCode.toLowerCase().includes(query) ||
        p.nmId?.toString().includes(query) ||
        p.offerId?.toLowerCase().includes(query)
    );
  }
  
  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;
    
    switch (state.sortBy) {
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
        comparison = a.lastCheckedAt.getTime() - b.lastCheckedAt.getTime();
        break;
    }
    
    return state.sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return filtered;
};

export const selectProductStats = (state: ProductsState) => {
  const total = state.products.length;
  const wbCount = state.products.filter((p) => p.marketplace === 'WB').length;
  const ozonCount = state.products.filter((p) => p.marketplace === 'Ozon').length;
  const activeCount = state.products.filter((p) => p.status === 'active').length;
  const triggeredCount = state.products.filter((p) => p.status === 'triggered').length;
  const protectedCount = state.products.filter((p) => p.minPrice > 0).length;
  
  return {
    total,
    wbCount,
    ozonCount,
    activeCount,
    triggeredCount,
    protectedCount,
  };
};
