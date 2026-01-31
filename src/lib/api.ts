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
api.interceptors.request.use(config => {
  const initData = getInitData();
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
  const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY;

  if (initData) {
    config.headers['X-Init-Data'] = initData;
  } else if (DEV_MODE && ADMIN_KEY) {
    // Bypass auth for local development using Admin Key
    config.headers['X-Admin-Key'] = ADMIN_KEY;

    // Add telegramId to both params (for GET) and data (for POST)
    config.params = { ...config.params, telegramId: 7548070478 };
    if (config.data && typeof config.data === 'object') {
      config.data = { ...config.data, telegramId: 7548070478 };
    }
  }
  return config;
});

// Response interceptor for logging
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================
// SWR CACHING STRATEGY
// ============================================

const swrCache = new Map<string, { data: unknown; timestamp: number }>();
const SWR_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Enhanced fetch with Stale-While-Revalidate
 */
export async function fetchSWR<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = swrCache.get(key);
  const now = Date.now();

  // If we have valid non-stale cache, return it immediately
  if (cached && now - cached.timestamp < SWR_TTL / 2) {
    return cached.data as T;
  }

  // If we have stale cache, return it but revalidate in background
  if (cached) {
    console.log(`[SWR] Serving stale content for ${key}...`);
    // Revalidate in background
    fetcher()
      .then(freshData => {
        swrCache.set(key, { data: freshData, timestamp: Date.now() });
      })
      .catch(err => console.warn(`[SWR] Revalidation failed for ${key}:`, err));

    return cached.data as T;
  }

  // No cache, fetch and store
  const data = await fetcher();
  swrCache.set(key, { data, timestamp: Date.now() });
  return data;
}

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
    } catch {
      console.warn('Auth API failed, using demo mode');
      return {
        success: true,
        user: {
          telegramId: '123456',
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
    priceBufferPercent?: number;
    warningThresholdPercent?: number;
    voiceEnabled?: boolean;
  }) => {
    const initData = getInitData();
    const response = await api.post('', { action: 'settings', initData, ...settings });
    return response.data;
  },

  saveApiKey: async (marketplace: 'WB' | 'Ozon', apiKey: string, clientId?: string) => {
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

export interface MarketplaceAccount {
  id: number;
  name: string;
  marketplace: 'wb' | 'ozon';
  is_active: boolean;
  wb_token?: string;
  ozon_client_id?: string;
  ozon_api_key?: string;
  created_at: string;
}

export const marketplaceAccountsApi = {
  getAccounts: async (): Promise<{ success: boolean; accounts: MarketplaceAccount[] }> => {
    const initData = getInitData();
    const response = await api.get('', {
      params: { action: 'marketplace-accounts' },
      headers: { 'X-Init-Data': initData || '' },
    });
    return response.data;
  },

  saveAccount: async (account: {
    id?: number;
    name: string;
    marketplace: 'wb' | 'ozon';
    wbApiKey?: string;
    ozonClientId?: string;
    ozonApiKey?: string;
    isActive?: boolean;
  }) => {
    const initData = getInitData();

    // Debug logging for troubleshooting
    console.log('[API] saveAccount called:', {
      hasInitData: !!initData,
      initDataLength: initData?.length || 0,
      accountName: account.name,
      marketplace: account.marketplace,
      hasWbKey: !!account.wbApiKey,
      hasOzonKey: !!account.ozonApiKey,
    });

    const response = await api.post(
      '',
      {
        action: 'marketplace-accounts',
        ...account,
      },
      {
        headers: {
          'X-Init-Data': initData || '',
        },
      }
    );

    console.log('[API] saveAccount response:', response.data);
    return response.data;
  },

  deleteAccount: async (id: number) => {
    const initData = getInitData();
    const response = await api.delete('', {
      params: { action: 'marketplace-accounts', id },
      headers: { 'X-Init-Data': initData || '' },
    });
    return response.data;
  },
};

// ============================================
// PRODUCTS SERVICE
// ============================================

export interface ProductData {
  id: string;
  userId: string | number;
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
    return fetchSWR('products', async () => {
      const initData = getInitData();
      const response = await api.get('', {
        params: { action: 'products' },
        headers: { 'X-Init-Data': initData || '' },
      });
      return { success: true, products: response.data.products };
    });
  },

  syncProducts: async (
    marketplace: 'WB' | 'Ozon' = 'Ozon'
  ): Promise<{
    success: boolean;
    message: string;
    count: number;
    smartDefaultsApplied?: number;
    protectionEnabled?: boolean;
    warning?: string;
  }> => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'sync-products',
      initData,
      marketplace,
    });
    return response.data;
  },

  updateProductParams: async (
    productId: string,
    params: { minPrice?: number; costPrice?: number }
  ) => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'products',
      initData,
      productId,
      ...params,
    });
    return response.data;
  },

  // Deprecated wrapper for backward compatibility
  updateMinPrice: async (productId: string, minPrice: number) => {
    return productsApi.updateProductParams(productId, { minPrice });
  },
};

export const contentApi = {
  generate: async (params: {
    productId: string;
    platform: 'instagram' | 'telegram' | 'wb_desc' | 'ozon_desc';
    style?: string;
    includeImage?: boolean;
  }): Promise<{ success: boolean; content: string; imageUrl?: string; error?: string }> => {
    const initData = getInitData();
    const response = await api.post('', {
      action: 'generate-content',
      initData,
      ...params,
    });
    return response.data;
  },

  getQuota: async () => {
    const initData = getInitData();
    const response = await api.get('', {
      params: { action: 'content-quota' },
      headers: { 'X-Init-Data': initData || '' },
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
  testMode?: boolean;
  message?: string;
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
    tier: string;
    billingPeriod?: 'monthly' | 'yearly';
    email?: string;
    savePaymentMethod?: boolean;
    promoCode?: string;
  }): Promise<CreatePaymentResult> => {
    const initData = getInitData();

    const response = await api.post('', {
      action: 'create-payment',
      initData,
      tier: params.tier,
      billing_period: params.billingPeriod || 'monthly',
      email: params.email,
      savePaymentMethod: params.savePaymentMethod ?? true,
      promoCode: params.promoCode,
    });

    // Map backend response to frontend expected format
    const data = response.data;
    return {
      ...data,
      confirmationUrl: data.payment_url, // Map payment_url -> confirmationUrl
    };
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
