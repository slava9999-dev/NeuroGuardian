// ============================================
// NeuroAgent — Main App Entry V4.0 (Premium)
// Aesthetic: System Initialization | Tactical Dashboard
// ============================================

import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useProductsStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData, hapticFeedback } from './lib/telegram';
import { authApi, productsApi } from './lib/api';
import { Package, Settings, Info, Cpu, Terminal, AlertTriangle } from 'lucide-react';
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

// Premium Loading Screen V4.0
function LoadingScreen() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-black overflow-hidden relative">
      <div className="bg-glow-spot top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60 scale-150" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center relative z-20"
      >
        <div className="relative mb-12">
          <motion.div
            className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className="relative p-1 rounded-full border border-indigo-500/30">
            <img
              src="/agent-avatar.png"
              alt="Victor"
              className="w-32 h-32 rounded-full object-cover grayscale-[0.3] shadow-2xl"
            />
            <motion.div
              className="absolute inset-0 border-2 border-lime-400/50 rounded-full"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-black italic tracking-tighter text-white/90 uppercase">
            NEURO<span className="text-indigo-500">GUARDIAN</span>
          </h1>
          <div className="flex items-center gap-2 text-[10px] mono-data text-zinc-500 font-bold uppercase tracking-[0.3em]">
            <Terminal className="w-3 h-3 text-lime-400" /> Initializing Tactical Layer...
          </div>
        </div>

        <div className="mt-10 w-40 h-[2px] bg-white/5 rounded-full overflow-hidden mx-auto relative">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-600 via-lime-400 to-indigo-600 shadow-[0_0_10px_#bef264]"
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', width: '60%' }}
          />
        </div>
      </motion.div>

      <div className="absolute bottom-10 text-[9px] font-black italic text-zinc-700 uppercase tracking-widest">
        Victor Agent v4.0.2 • Authorized Access Only
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
      <div className="h-dvh flex flex-col items-center justify-center bg-black p-8 text-center bg-cyber">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
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
    <div className="h-dvh flex flex-col">
      <Suspense fallback={<LoadingScreen />}>
        <PageContent />
      </Suspense>

      {/* Premium Apple-style Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 nav-blur border-t border-white/5 safe-area-inset-bottom z-50">
        <div className="flex justify-around items-center h-16 px-4">
          <NavButton
            active={currentPage === 'agent'}
            onClick={() => setCurrentPage('agent')}
            icon={<Cpu />}
            label="Agent"
          />
          <NavButton
            active={currentPage === 'products'}
            onClick={() => setCurrentPage('products')}
            icon={<Package />}
            label="Units"
          />
          <NavButton
            active={currentPage === 'settings'}
            onClick={() => setCurrentPage('settings')}
            icon={<Settings />}
            label="Control"
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
      className={`relative flex flex-col items-center gap-1 transition-all flex-1 py-1 ${active ? 'text-indigo-500' : 'text-zinc-600'}`}
    >
      <motion.div
        whileTap={{ scale: 0.9, y: 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-indigo-500/10 border border-indigo-500/20' : 'border border-transparent'}`}
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
          className="absolute -bottom-1 w-8 h-1 bg-indigo-500 blur-sm rounded-full"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}

export default App;
