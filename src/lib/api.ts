// ============================================
// NeuroGUARDIAN — API Client (Vercel Backend)
// ============================================

import axios from 'axios';
import { getInitData } from './telegram';

// Use relative /api path for Vercel or explicit base URL
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

import type { User } from '../types';


export const authApi = {
  login: async (initData: string): Promise<{ success: boolean; user: User }> => {
    // Demo mode fallback
    if (!API_BASE_URL || API_BASE_URL === '/api') {
      // Still try the request, but have fallback
    }

    try {
      const response = await api.post('/auth', { initData });
      
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
    const response = await api.post('/settings', { initData, ...settings });
    return response.data;
  },

  saveApiKey: async (
    marketplace: 'WB' | 'Ozon',
    apiKey: string,
    clientId?: string
  ) => {
    const initData = getInitData();
    const response = await api.post('/settings', {
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
  barcode?: string;
  title: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  currentPrice: number;
  minPrice: number;
  originalPrice?: number;
  stock: number;
  marketplace: 'WB' | 'Ozon';
  status: 'active' | 'protected' | 'triggered' | 'disabled';
  isMonitored: boolean;
  lastCheckedAt?: Date;
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const productsApi = {
  getProducts: async (marketplace?: 'WB' | 'Ozon'): Promise<{ success: boolean; products: ProductData[] }> => {
    const initData = getInitData();
    const response = await api.get('/products', {
      headers: { 'X-Init-Data': initData || '' },
      params: { marketplace },
    });
    
    // Convert date strings
    const products = response.data.products.map((p: any) => ({
      ...p,
      lastCheckedAt: p.lastCheckedAt ? new Date(p.lastCheckedAt) : null,
      lastTriggeredAt: p.lastTriggeredAt ? new Date(p.lastTriggeredAt) : null,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    }));
    
    return { success: true, products };
  },

  updateMinPrice: async (productId: string, minPrice: number) => {
    const initData = getInitData();
    const response = await api.post('/products', {
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
    const response = await api.get('/plans');
    return response.data;
  },

  createPayment: async (params: {
    planId: string;
    email?: string;
    savePaymentMethod?: boolean;
    promoCode?: string;
  }): Promise<CreatePaymentResult> => {
    const initData = getInitData();
    const returnUrl = window.location.origin + '?payment_complete=true';
    
    const response = await api.post('/create-payment', {
      initData,
      planId: params.planId,
      email: params.email,
      savePaymentMethod: params.savePaymentMethod ?? true,
      promoCode: params.promoCode,
      returnUrl,
    });
    
    return response.data;
  },
};

// For backward compatibility
export const syncApi = {
  saveApiKey: settingsApi.saveApiKey,
  getProducts: productsApi.getProducts,
};

export const productApi = {
  updateMinPrice: productsApi.updateMinPrice,
};

export default api;
