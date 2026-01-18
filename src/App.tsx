// ============================================
// NeuroAgent — Main App Entry V4.0 (Premium)
// Aesthetic: System Initialization | Tactical Dashboard
// ============================================

import React, { useEffect, useState, useRef, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useProductsStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData, hapticFeedback } from './lib/telegram';
import { authApi, productsApi } from './lib/api';
import type { User, Product } from './types';
import { Package, Settings, Info, Cpu } from 'lucide-react';
import { ViktorCore } from './components/ui/ViktorCore';
import './index.css';

import { AgentPage } from './pages/AgentPage';
import { ProductsPage } from './pages/ProductsPage';
import { SettingsPage } from './pages/SettingsPage';
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

// Premium Loading Screen V6.0 (Human)
function LoadingScreen() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-background overflow-hidden relative">
      <div className="bg-cosmic" />
      {/* Nebula glow removed for cleaner Human UI */}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center relative z-20"
      >
        <div className="relative mb-10">
          <ViktorCore size="lg" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">
            NEURO<span className="text-indigo-600">GUARDIAN</span>
          </h1>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-[0.4em]">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_var(--color-success)]" />
            Инициализация...
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const DEV_USER = {
  telegramId: 7548070478,
  firstName: 'Commander',
  username: 'commander_dev',
  subscriptionActive: true,
  subscriptionPlan: 'pro',
  protectionEnabled: true,
  priceBufferPercent: 5,
  hasUnlinkedAccounts: false,
};

type Page = 'agent' | 'products' | 'settings' | 'info' | 'ops' | 'subscription' | 'god-mode';

function App() {
  const { setUser, setLoading, isLoading, user } = useAppStore();
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
          setUser(DEV_USER as User);
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
            useProductsStore.getState().setProducts(products as Product[]);
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
              useProductsStore.getState().setProducts(products as Product[]);
            }
          }
        } else {
          setAuthError('Доступ заблокирован. Используйте Telegram-клиент.');
        }
      } catch {
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
      <div className="h-dvh flex flex-col items-center justify-center bg-background p-8 text-center relative overflow-hidden">
        <div className="bg-cosmic" />
        <h1 className="text-xl font-black italic text-slate-900 mb-2 uppercase tracking-tighter relative z-10">
          СИСТЕМНАЯ ОШИБКА
        </h1>
        <p className="text-slate-500 text-sm mb-8 font-medium relative z-10">{authError}</p>
        <a
          href="https://t.me/NeuroGuardianBot"
          className="btn-premium w-full max-w-xs relative z-10"
        >
          ПЕРЕПОДКЛЮЧИТЬСЯ
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
            onNavigate={(p: string) => setCurrentPage(p as Page)}
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

  const PageWrapper = ({ children, pageId }: { children: React.ReactNode; pageId: string }) => (
    <motion.div
      key={pageId}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );

  return (
    <div className="h-dvh flex flex-col relative overflow-hidden bg-background">
      {/* Global Cosmic Layer (Subtle Gradient) */}
      <div className="bg-cosmic" />

      <main className="flex-1 relative min-h-0 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait" initial={false}>
          <PageWrapper pageId={currentPage}>
            <PageContent />
          </PageWrapper>
        </AnimatePresence>
      </main>

      {/* Premium Navigation (Light Glass) */}
      <nav className="fixed bottom-0 left-0 right-0 nav-glass safe-area-inset-bottom z-50">
        <div className="flex justify-around items-center h-16 px-4 max-w-lg mx-auto">
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
            dot={user?.hasUnlinkedAccounts}
          />
          <NavButton
            active={currentPage === 'info'}
            onClick={() => setCurrentPage('info')}
            icon={<Info />}
            label="Инфо"
          />
        </div>
      </nav>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactElement;
  label: string;
  dot?: boolean;
}

function NavButton({ active, onClick, icon, label, dot }: NavButtonProps) {
  return (
    <button
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 py-1 ${active ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <div
        className={`p-1.5 rounded-xl transition-all duration-300 relative ${active ? 'bg-primary/10' : ''}`}
      >
        {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
          size: 20,
          strokeWidth: active ? 2.5 : 2,
        })}

        {dot && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-danger rounded-full border-2 border-background" />
        )}
      </div>
      <span
        className={`text-[9px] font-bold uppercase tracking-wider transition-opacity ${active ? 'opacity-100' : 'opacity-60'}`}
      >
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute -top-px w-8 h-[2px] bg-primary rounded-full shadow-[0_0_10px_var(--color-primary)]"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}

export default App;
