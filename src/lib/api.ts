// ============================================
// NeuroGUARDIAN — API Client (Vercel Backend)
// Unified API endpoint: /api?action=xxx
// ============================================

import axios from 'axios';
import { getInitData } from './telegram';
import type { User } from '../types';

// API base - uses /api for Vercel
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add initData header to every request
api.interceptors.request.use((config) => {
  const initData = getInitData();
  if (initData) {
    config.headers['X-Init-Data'] = initData;
  }
  return config;
});

// Response interceptor for logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================
// AUTH SERVICE
// ============================================

export const authApi = {
  login: async (initData: string): Promise<{ success: boolean; user: User }> => {
    try {
      const response = await api.post('', { action: 'auth', initData });
      
      // Convert date strings to Date objects
      const userData = response.data.user;
      if (userData.subscriptionExpiresAt) {
        userData.subscriptionExpiresAt = new Date(userData.subscriptionExpiresAt);
      }
      
      return {
        success: true,
        user: userData,
      };
    } catch (error) {
      console.warn('Auth API failed, using demo mode');
      return {
        success: true,
        user: {
          telegramId: 123456,
          username: 'demo_user',
          firstName: 'Demo User',
          lastName: null,
          photoUrl: null,
          subscriptionActive: false,
          subscriptionExpiresAt: null,
          subscriptionPlan: null,
          subscriptionDaysLeft: null,
          protectionEnabled: false,
          defenseMode: 'zero_stock',
          wbKeyRef: null,
          ozonKeyRef: null,
          totalProducts: 5,
          triggeredToday: 0,
          savedAmount: 0,
        },
      };
    }
  },
};

// ============================================
// SETTINGS SERVICE
// ============================================

export const settingsApi = {
  updateSettings: async (settings: {
    protectionEnabled?: boolean;
    defenseMode?: 'zero_stock' | 'price_correction';
    autoRenew?: boolean;
  }) => {
    const initData = getInitData();
    const response = await api.post('', { action: 'settings', initData, ...settings });
    return response.data;
  },

  saveApiKey: async (
    marketplace: 'WB' | 'Ozon',
    apiKey: string,
    clientId?: string
  ) => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'settings',
      initData,
      marketplace,
      apiKey,
      clientId,
    });
    return response.data;
  },
};

// ============================================
// PRODUCTS SERVICE
// ============================================

export interface ProductData {
  id: string;
  userId: number;
  productId: string;
  nmId?: number;
  offerId?: string;
  vendorCode?: string;
  title: string;
  imageUrl?: string;
  currentPrice: number;
  minPrice: number;
  stock: number;
  marketplace: 'WB' | 'Ozon';
  status: 'active' | 'protected' | 'triggered' | 'disabled';
  isMonitored: boolean;
}

export const productsApi = {
  getProducts: async (): Promise<{ success: boolean; products: ProductData[] }> => {
    const initData = getInitData();
    const response = await api.get('', {
      params: { action: 'products' },
      headers: { 'X-Init-Data': initData || '' },
    });
    return { success: true, products: response.data.products };
  },

  syncProducts: async (marketplace: 'WB' | 'Ozon' = 'Ozon'): Promise<{ success: boolean; message: string; count: number }> => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'sync-products',
      initData,
      marketplace,
    });
    return response.data;
  },

  updateMinPrice: async (productId: string, minPrice: number) => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'products',
      initData,
      productId,
      minPrice,
    });
    return response.data;
  },
};

// ============================================
// PAYMENT SERVICE
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxProducts: number;
  features: string[];
  pricePerMonth: number;
  isPopular: boolean;
  isBestValue: boolean;
}

export interface CreatePaymentResult {
  success: boolean;
  paymentId?: string;
  confirmationToken?: string;
  confirmationUrl?: string;
  transactionId?: string;
  plan?: {
    id: string;
    name: string;
    price: number;
    durationDays: number;
  };
  error?: string;
}

export const paymentApi = {
  getPlans: async (): Promise<{ success: boolean; plans: SubscriptionPlan[] }> => {
    const response = await api.get('', { params: { action: 'plans' } });
    return response.data;
  },

  createPayment: async (params: {
    planId: string;
    email?: string;
    savePaymentMethod?: boolean;
    promoCode?: string;
  }): Promise<CreatePaymentResult> => {
    const initData = getInitData();
    
    const response = await api.post('', {
      action: 'create-payment',
      initData,
      planId: params.planId,
      email: params.email,
      savePaymentMethod: params.savePaymentMethod ?? true,
      promoCode: params.promoCode,
    });
    
    return response.data;
  },
};

// For backward compatibility
export const syncApi = {
  saveApiKey: settingsApi.saveApiKey,
  getProducts: productsApi.getProducts,
  syncProducts: productsApi.syncProducts,
};

export const productApi = {
  updateMinPrice: productsApi.updateMinPrice,
};

export default api;
