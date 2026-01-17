// ============================================
// NeuroAgent — Main App Entry V4.0 (Premium)
// Aesthetic: System Initialization | Tactical Dashboard
// ============================================

import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, useProductsStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData, hapticFeedback } from './lib/telegram';
import { authApi, productsApi } from './lib/api';
import { Package, Settings, Info, Cpu } from 'lucide-react';
import { ViktorCore } from './components/ui/ViktorCore';
import './index.css';

// Lazy load pages
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
const GodModePage = lazy(() =>
  import('./pages/GodModePage').then(m => ({ default: m.GodModePage }))
);

// Premium Loading Screen V5.0 (Cosmic)
function LoadingScreen() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-[#02040a] overflow-hidden relative">
      <div className="bg-cosmic" />
      <div className="nebula-glow" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center relative z-20"
      >
        <div className="relative mb-12">
          <ViktorCore size="lg" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">
            NEURO<span className="text-violet-500">GUARDIAN</span>
          </h1>
          <div className="flex items-center gap-3 text-[10px] mono-data text-slate-500 font-bold uppercase tracking-[0.4em]">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
            Initializing Neural Mesh...
          </div>
        </div>

        <div className="mt-12 w-48 h-[1px] bg-white/5 rounded-full overflow-hidden mx-auto relative px-10">
          <motion.div
            className="h-full bg-linear-to-r from-transparent via-violet-500 to-transparent shadow-[0_0_15px_#8b5cf6]"
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: '50%' }}
          />
        </div>
      </motion.div>

      <div className="absolute bottom-10 flex flex-col items-center gap-2">
        <div className="text-[9px] font-black italic text-slate-700 uppercase tracking-widest">
          NeuroV5 Industrial Core • Secure Auth
        </div>
      </div>
    </div>
  );
}

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const DEV_USER: any = {
  telegramId: 7548070478,
  firstName: 'Commander',
  subscriptionActive: true,
  subscriptionPlan: 'pro',
  protectionEnabled: true,
  priceBufferPercent: 5,
};

type Page = 'agent' | 'products' | 'settings' | 'info' | 'ops' | 'subscription' | 'god-mode';

function App() {
  const { setUser, setLoading, isLoading } = useAppStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('page') as Page) || 'agent';
  });

  const initPerformed = useRef(false);

  useEffect(() => {
    if (initPerformed.current) return;
    initPerformed.current = true;

    async function init() {
      setLoading(true);
      try {
        if (DEV_MODE && !isTelegramWebApp()) {
          setUser(DEV_USER);
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
            useProductsStore.getState().setProducts(products as any);
          }
        } else if (isTelegramWebApp()) {
          initTelegramWebApp();
          const initData = getInitData();
          if (initData) {
            const authResult = await authApi.login(initData);
            setUser(authResult.user);
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
              useProductsStore.getState().setProducts(products as any);
            }
          }
        } else {
          setAuthError('Доступ заблокирован. Используйте Telegram-клиент.');
        }
      } catch (error) {
        setAuthError('Критический сбой инициализации.');
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    }
    init();
  }, [setUser, setLoading]);

  if (!isInitialized || isLoading) return <LoadingScreen />;

  if (authError) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-black p-8 text-center bg-cosmic">
        <div className="nebula-glow opacity-30" />
        <h1 className="text-xl font-black italic text-white mb-2 uppercase tracking-tighter">
          SECURITY BREACH
        </h1>
        <p className="text-zinc-500 text-sm mb-8 font-medium">{authError}</p>
        <a href="https://t.me/NeuroGuardianBot" className="btn-premium w-full max-w-xs">
          RECONNECT SYSTEM
        </a>
      </div>
    );
  }

  const PageContent = () => {
    switch (currentPage) {
      case 'agent':
        return <AgentPage />;
      case 'products':
        return <ProductsPage onBack={() => setCurrentPage('agent')} />;
      case 'settings':
        return (
          <SettingsPage
            onBack={() => setCurrentPage('agent')}
            onNavigate={(p: any) => setCurrentPage(p)}
          />
        );
      case 'info':
        return <LegalPage onBack={() => setCurrentPage('agent')} />;
      case 'ops':
        return <OpsPanelPage onBack={() => setCurrentPage('agent')} />;
      case 'subscription':
        return <SubscriptionPage onBack={() => setCurrentPage('settings')} />;
      case 'god-mode':
        return <GodModePage />;
      default:
        return <AgentPage />;
    }
  };

  return (
    <div className="h-dvh flex flex-col relative overflow-hidden bg-[#02040a]">
      {/* Global Cosmic Layer */}
      <div className="bg-cosmic" />
      <div className="nebula-glow" />

      <main className="flex-1 overflow-y-auto no-scrollbar relative min-h-0">
        <Suspense fallback={<LoadingScreen />}>
          <PageContent />
        </Suspense>
      </main>

      {/* Premium Apple-style Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 nav-glass safe-area-inset-bottom z-50">
        <div className="flex justify-around items-center h-16 px-4">
          <NavButton
            active={currentPage === 'agent'}
            onClick={() => setCurrentPage('agent')}
            icon={<Cpu />}
            label="Агент"
          />
          <NavButton
            active={currentPage === 'products'}
            onClick={() => setCurrentPage('products')}
            icon={<Package />}
            label="Товары"
          />
          <NavButton
            active={currentPage === 'settings'}
            onClick={() => setCurrentPage('settings')}
            icon={<Settings />}
            label="Настройки"
          />
          <NavButton
            active={currentPage === 'info'}
            onClick={() => setCurrentPage('info')}
            icon={<Info />}
            label="Log"
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      className={`relative flex flex-col items-center gap-1 transition-all flex-1 py-1 ${active ? 'text-violet-500' : 'text-slate-600'}`}
    >
      <motion.div
        whileTap={{ scale: 0.9, y: 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-violet-500/10 border border-violet-500/20' : 'border border-transparent'}`}
      >
        {React.cloneElement(icon, { size: 18, strokeWidth: active ? 2.5 : 2 })}
      </motion.div>
      <span
        className={`text-[9px] font-black uppercase tracking-wider transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}
      >
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="nav-glow"
          className="absolute -bottom-1 w-8 h-1 bg-violet-500 blur-sm rounded-full"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}

export default App;
