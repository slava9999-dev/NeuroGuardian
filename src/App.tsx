// ============================================
// NeuroAgent — Main App Entry
// Agent-first interface for WB & Ozon sellers
// ============================================

import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, useProductsStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData } from './lib/telegram';
import { authApi, productsApi } from './lib/api';
import './index.css';

// Lazy load pages for better initial bundle size
// Lazy load pages for better initial bundle size
const AgentPage = lazy(() => import('./pages/AgentPage').then(m => ({ default: m.AgentPage })));
const ProductsPage = lazy(() =>
  import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage }))
);
const LegalPage = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })));
const OpsPanelPage = lazy(() =>
  import('./pages/OpsPanelPage').then(m => ({ default: m.OpsPanelPage }))
);
const SubscriptionPage = lazy(() =>
  import('./pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage }))
);

// Loading screen with agent branding
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-stone-900 to-stone-800">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Agent Avatar */}
        <motion.div
          className="relative mx-auto mb-6"
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="absolute inset-0 rounded-full bg-linear-to-r from-violet-500 to-purple-500 blur-xl opacity-50" />
          <img
            src="/agent-avatar.png"
            alt="NeuroAgent"
            className="relative w-24 h-24 rounded-full object-cover border-2 border-violet-400/50"
          />
        </motion.div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">NeuroAgent</h1>
        <p className="text-stone-400 text-sm mb-6">Загрузка вашего помощника...</p>

        {/* Loading spinner */}
        <motion.div
          className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full mx-auto"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  );
}

// DEV_MODE: Enable local development without Telegram
// Set VITE_DEV_MODE=true in .env for local testing
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Mock user for development (only used when DEV_MODE=true)
import type { User } from './types';

const DEV_USER: User = {
  telegramId: 7548070478,
  username: 'slava9999', // Updated to match user context if possible, but ID is key
  firstName: 'Developer',
  lastName: 'User',
  photoUrl: null,

  // Subscription
  subscriptionActive: true,
  subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  subscriptionPlan: 'pro',
  subscriptionDaysLeft: 365,

  // Protection settings
  protectionEnabled: true,
  defenseMode: 'price_correction',

  // API Keys (empty - user will add in settings)
  wbKeyRef: null,
  ozonKeyRef: null,

  // Stats
  totalProducts: 0,
  triggeredToday: 0,
  savedAmount: 0,

  // Sentinel buffer settings
  priceBufferPercent: 5,
  warningThresholdPercent: 10,

  // Timestamps
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActiveAt: new Date(),
};

// Pages enum - Agent is first!
type Page = 'agent' | 'products' | 'settings' | 'info' | 'ops' | 'subscription';

function App() {
  const setUser = useAppStore(state => state.setUser);
  const setLoading = useAppStore(state => state.setLoading);
  const isLoading = useAppStore(state => state.isLoading);

  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page') as Page;
    if (
      pageParam &&
      ['agent', 'products', 'settings', 'info', 'ops', 'subscription'].includes(pageParam)
    ) {
      return pageParam;
    }
    return 'agent';
  });

  const initPerformed = useRef(false);

  useEffect(() => {
    if (initPerformed.current) return;
    initPerformed.current = true;

    async function init() {
      setLoading(true);

      try {
        // DEV_MODE: Skip Telegram auth for local development
        if (DEV_MODE && !isTelegramWebApp()) {
          console.log('🔧 DEV_MODE: Running with mock user');
          console.warn('⚠️ DEV MODE ACTIVE - DO NOT USE IN PRODUCTION');
          setUser(DEV_USER);

          // Try to load products from API (will work if backend is running)
          try {
            const productsResult = await productsApi.getProducts();
            if (productsResult.products) {
              const products = productsResult.products.map(p => ({
                ...p,
                vendorCode: p.vendorCode || '',
                imageUrl: p.imageUrl || '',
                lastCheckedAt: new Date(),
                lastTriggeredAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              }));
              useProductsStore.getState().setProducts(products);
              console.log('📦 Products loaded:', products.length);
            }
          } catch {
            console.log('📦 No products yet (connect your store in Settings)');
          }
        } else if (isTelegramWebApp()) {
          console.log('🚀 Telegram WebApp detected');
          initTelegramWebApp();

          const initData = getInitData();
          if (initData) {
            console.log('📱 Authenticating with Telegram...');
            const authResult = await authApi.login(initData);
            console.log('✅ Auth successful:', authResult.user);

            setUser(authResult.user);

            // Load products
            try {
              const productsResult = await productsApi.getProducts();
              if (productsResult.products) {
                // Convert ProductData to Product with required timestamps
                const products = productsResult.products.map(p => ({
                  ...p,
                  vendorCode: p.vendorCode || '',
                  imageUrl: p.imageUrl || '',
                  lastCheckedAt: new Date(),
                  lastTriggeredAt: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }));
                useProductsStore.getState().setProducts(products);
                console.log('📦 Products loaded:', products.length);
              }
            } catch {
              console.log('📦 No products yet');
            }
          } else {
            setAuthError('Не удалось получить данные авторизации Telegram');
          }
        } else {
          // Not in Telegram and DEV_MODE is off
          console.warn('⚠️ Not running in Telegram WebApp - authentication required');
          setAuthError('Приложение работает только внутри Telegram');
        }
      } catch (error) {
        console.error('❌ Init error:', error);
        setAuthError('Ошибка аутентификации. Попробуйте перезапустить приложение.');
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    }

    init();
  }, [setUser, setLoading]);

  // Navigation functions
  const goToAgent = () => setCurrentPage('agent');
  const goToProducts = () => setCurrentPage('products');
  const goToSettings = () => setCurrentPage('settings');
  const goToInfo = () => setCurrentPage('info');
  const goToOps = () => setCurrentPage('ops');

  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  // Show auth error if not in Telegram
  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-stone-900 to-stone-800 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="text-6xl mb-6">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-4">Требуется авторизация</h1>
          <p className="text-stone-400 mb-6">{authError}</p>
          <a
            href="https://t.me/NeuroGuardianBot"
            className="inline-block px-6 py-3 bg-violet-500 text-white font-medium rounded-xl hover:bg-violet-600 transition-colors"
          >
            Открыть в Telegram
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Pages - wrapped in Suspense for lazy loading */}
      <Suspense fallback={<LoadingScreen />}>
        {currentPage === 'agent' && <AgentPage />}
        {currentPage === 'products' && <ProductsPage onBack={goToAgent} />}
        {currentPage === 'settings' && (
          <SettingsPage onBack={goToAgent} onNavigate={p => (p === 'ops' ? goToOps() : null)} />
        )}
        {currentPage === 'info' && <LegalPage onBack={goToAgent} />}
        {currentPage === 'info' && <LegalPage onBack={goToAgent} />}
        {currentPage === 'ops' && <OpsPanelPage onBack={goToAgent} />}
        {currentPage === 'subscription' && <SubscriptionPage onBack={goToSettings} />}
      </Suspense>

      {/* Bottom Tab Bar - Simplified */}
      <nav className="fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 safe-area-inset-bottom z-40">
        <div className="flex justify-around py-2">
          {/* Agent Tab - Primary */}
          <button
            onClick={goToAgent}
            className={`flex flex-col items-center gap-1 px-5 py-2 transition-all relative ${
              currentPage === 'agent' ? 'text-violet-400' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {currentPage === 'agent' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-xl bg-violet-500/15"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            <div className="relative">
              <img
                src="/agent-avatar.png"
                alt="Agent"
                className="w-6 h-6 rounded-full object-cover"
              />
              {currentPage !== 'agent' && (
                <motion.span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>
            <span className="text-xs font-medium relative">Агент</span>
          </button>

          {/* Products Tab */}
          <button
            onClick={goToProducts}
            className={`flex flex-col items-center gap-1 px-5 py-2 transition-all relative ${
              currentPage === 'products' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {currentPage === 'products' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-xl bg-amber-500/15"
              />
            )}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="relative"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="text-xs font-medium relative">Товары</span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={goToSettings}
            className={`flex flex-col items-center gap-1 px-5 py-2 transition-all relative ${
              currentPage === 'settings' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {currentPage === 'settings' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-xl bg-amber-500/15"
              />
            )}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="relative"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-xs font-medium relative">Настройки</span>
          </button>

          {/* Info Tab */}
          <button
            onClick={goToInfo}
            className={`flex flex-col items-center gap-1 px-5 py-2 transition-all relative ${
              currentPage === 'info' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {currentPage === 'info' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-xl bg-amber-500/15"
              />
            )}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="relative"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="text-xs font-medium relative">Инфо</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default App;
