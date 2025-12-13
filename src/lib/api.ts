import axios from 'axios';
import { getInitData } from './telegram';
import { UserSchema, ProductSchema } from '../schemas'; // Use the patched schemas
import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error('⚠️ VITE_API_BASE_URL is not set!');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Authorization header to every request
api.interceptors.request.use((config) => {
  const initData = getInitData();
  if (initData) {
    config.headers.Authorization = `Bearer ${initData}`;
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

// Auth Service
export const authApi = {
  login: async (initData: string) => {
    const response = await api.post('/telegramAuth', { initData });
    // Validate response with Zod
    const ResponseSchema = z.object({
      success: z.boolean(),
      user: UserSchema,
    });
    
    // We parse the response to ensure types are correct (converts timestamps to Dates)
    return ResponseSchema.parse(response.data);
  },
};

// User Settings Service
export const settingsApi = {
  updateSettings: async (settings: { protectionEnabled?: boolean; defenseMode?: 'zero_stock' | 'price_correction' }) => {
    const response = await api.post('/updateSettings', settings);
    return response.data;
  },
};

// Sync Service
export const syncApi = {
  saveApiKey: async (marketplace: 'WB' | 'Ozon', apiKey: string, clientId?: string) => {
    const response = await api.post('/saveApiKey', {
      initData: getInitData(), // Explicitly pass initData if needed by backend body
      marketplace,
      apiKey,
      clientId,
    });
    return response.data;
  },
  
  getProducts: async (marketplace?: 'WB' | 'Ozon') => {
    const response = await api.get('/getProducts', {
      params: { marketplace },
    });
    
    const ResponseSchema = z.object({
      success: z.boolean(),
      products: z.array(ProductSchema),
    });
    
    return ResponseSchema.parse(response.data);
  },
};

// Product Management
export const productApi = {
  updateMinPrice: async (productId: string, minPrice: number) => {
    const response = await api.post('/updateMinPrice', {
      productId,
      minPrice,
    });
    return response.data;
  },
};

export default api;
