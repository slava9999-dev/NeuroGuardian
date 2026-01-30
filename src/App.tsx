// ============================================
// NeuroGUARDIAN — Neuro-Flash UI v2.0
// Architecture: Stitch (Intelligence thru Transparency)
// ============================================

import React, { useEffect, useState, useRef, lazy, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useProductsStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData, hapticFeedback } from './lib/telegram';
import { authApi, productsApi } from './lib/api';
import type { User, Product } from './types';
import { LayoutGrid, Package, Settings, Info, Cpu, Shield } from 'lucide-react';
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

// Premium Loading Screen (Neuro-Flash Ghost Skeleton)
function LoadingScreen() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-background overflow-hidden relative">
      <div className="aura-layer" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center relative z-20"
      >
        <div className="relative mb-8 skeleton-pulse rounded-full p-4">
          <ViktorCore size="lg" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 font-display">
            NEURO<span className="text-primary italic">FLASH</span>
          </h1>
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em]">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Био-синхронизация...
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
type DesignMode = 'peace' | 'hunt' | 'critical';

function App() {
  const { setUser, setLoading, isLoading, user } = useAppStore();
  const { products } = useProductsStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('page') as Page) || 'agent';
  });

  const initPerformed = useRef(false);

  // Dynamic Mode Detection
  const designMode = useMemo<DesignMode>(() => {
    if (!products || products.length === 0) return 'peace';
    const hasCritical = products.some(p => p.status === 'triggered');
    if (hasCritical) return 'critical';
    const isHunting = products.some(p => p.isMonitored);
    return isHunting ? 'hunt' : 'peace';
  }, [products]);

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
            useProductsStore.getState().setProducts(productsResult.products as Product[]);
          }
        } else if (isTelegramWebApp()) {
          initTelegramWebApp();
          const initData = getInitData();
          if (initData) {
            const authResult = await authApi.login(initData);
            setUser(authResult.user);
            const productsResult = await productsApi.getProducts();
            if (productsResult.products) {
              useProductsStore.getState().setProducts(productsResult.products as Product[]);
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
        <div className="aura-layer" />
        <h1 className="text-xl font-black text-hot-neon mb-2 uppercase tracking-tighter font-display">
          СИСТЕМНАЯ ОШИБКА
        </h1>
        <p className="text-slate-500 text-sm mb-8 font-medium">{authError}</p>
        <a href="https://t.me/NeuroGuardianBot" className="btn btn-primary w-full max-w-xs">
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
        return (
          <ProductsPage
            onBack={() => setCurrentPage('agent')}
            onNavigate={(page: string) => setCurrentPage(page as Page)}
          />
        );
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

  return (
    <div
      className={`h-dvh flex flex-col relative overflow-hidden bg-background mode-${designMode}`}
    >
      {/* L2: Aura Canvas */}
      <div className="aura-layer" />

      {/* L3: Critical HUD Alert (Only in Critical Mode) */}
      {designMode === 'critical' && (
        <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="hud-alert">
          <div className="flex items-center gap-2">
            <Shield className="size-4 animate-pulse text-black" />
            <span className="text-[10px] font-black uppercase tracking-widest text-black">
              Sentinel: Внимание, обнаружены угрозы демпинга
            </span>
          </div>
          <button
            onClick={() => setCurrentPage('ops')}
            className="text-[9px] font-black bg-black text-toxic-orange px-2 py-1 rounded"
          >
            ЛОГИ
          </button>
        </motion.div>
      )}

      {/* Main Context Layer */}
      <main
        className={`flex-1 relative min-h-0 overflow-y-auto no-scrollbar ${designMode === 'critical' ? 'pt-12' : ''}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full"
          >
            <PageContent />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* L1: Glass HUD Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass-nav safe-area-inset-bottom-zero z-50 border-t border-black/5">
        <div className="flex justify-around items-center h-20 px-4 max-w-lg mx-auto">
          <NavButton
            active={currentPage === 'agent'}
            onClick={() => setCurrentPage('agent')}
            icon={<LayoutGrid />}
            label="Главная"
          />
          <NavButton
            active={currentPage === 'products'}
            onClick={() => setCurrentPage('products')}
            icon={<Package />}
            label="Склад"
          />

          {/* Viktor Center Button */}
          <div className="relative -top-4">
            <button
              onClick={() => {
                hapticFeedback('heavy');
                setCurrentPage('agent');
              }}
              className="size-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-white transition-transform active:scale-90"
            >
              <Cpu className="text-white size-7" />
            </button>
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-primary tracking-tighter">
              Страж
            </span>
          </div>

          <NavButton
            active={currentPage === 'settings'}
            onClick={() => setCurrentPage('settings')}
            icon={<Settings />}
            label="Система"
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
      className={`relative flex flex-col items-center gap-1 transition-all flex-1 py-1 ${
        active ? 'text-primary' : 'text-black/30'
      }`}
    >
      <div className="p-1 rounded-xl transition-all duration-300">
        {React.cloneElement(
          icon as React.ReactElement<{
            size?: number;
            strokeWidth?: number;
            className?: string;
          }>,
          {
            size: 22,
            strokeWidth: active ? 3 : 2,
            className: active ? 'fill-current' : '',
          }
        )}
        {dot && (
          <div className="absolute top-1 right-1/4 w-2 h-2 bg-toxic-orange rounded-full border-2 border-white" />
        )}
      </div>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

export default App;
