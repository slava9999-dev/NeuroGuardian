// ============================================
// NeuroGUARDIAN — Main App Entry
// ============================================

import { useEffect, useState, useRef } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardPage } from './pages/DashboardPage';
import { useAppStore } from './stores';
import { initTelegramWebApp, isTelegramWebApp, getInitData } from './lib/telegram';
import { authApi } from './lib/api';
import './index.css';

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Logo */}
        <motion.div
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center"
          animate={{
            boxShadow: [
              '0 0 20px rgba(245, 158, 11, 0.3)',
              '0 0 40px rgba(245, 158, 11, 0.5)',
              '0 0 20px rgba(245, 158, 11, 0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-900"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </motion.div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-gradient-amber mb-2">NeuroGUARDIAN</h1>
        <p className="text-stone-400 text-sm mb-6">Инициализация системы защиты...</p>
        
        {/* Loading spinner */}
        <motion.div
          className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full mx-auto"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  );
}

// Mock user for development outside Telegram
const MOCK_USER = {
  telegramId: 123456789,
  username: 'dev_user',
  firstName: 'Developer',
  lastName: 'Mode',
  photoUrl: null,
  subscriptionActive: true,
  subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  subscriptionPlan: 'pro' as const,
  protectionEnabled: false,
  defenseMode: 'zero_stock' as const,
  wbKeyRef: null,
  ozonKeyRef: null,
  totalProducts: 5,
  triggeredToday: 3,
  savedAmount: 42500,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActiveAt: new Date(),
};

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const setLoading = useAppStore((state) => state.setLoading);
  const isLoading = useAppStore((state) => state.isLoading);
  
  const [isInitialized, setIsInitialized] = useState(false);
  
  const initPerformed = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization (especially in React Strict Mode)
    if (initPerformed.current) return;
    initPerformed.current = true;

    let mounted = true;

    async function init() {
      try {
        console.log('🚀 App initialization started...');
        
        // Initialize Telegram WebApp
        if (isTelegramWebApp()) {
          console.log('📱 Detected Telegram WebApp environment');
          initTelegramWebApp();
          
          const initData = getInitData();
          if (initData) {
              try {
                  console.log('🔐 Authenticating with InitData...');
                  const response = await authApi.login(initData);
                  if (mounted && response.success && response.user) {
                      console.log('✅ Authentication successful', response.user);
                      setUser(response.user);
                  }
              } catch (err) {
                  console.error("❌ Auth failed:", err);
              }
          }
        } else {
          console.log('🔧 Development mode: Using mock user');
          if (mounted) {
            setUser(MOCK_USER);
          }
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
      } finally {
        if (mounted) {
           // Small delay to ensure smooth transition
           setTimeout(() => {
             if (mounted) {
               console.log('✨ Initialization complete');
               setLoading(false);
               setIsInitialized(true);
             }
           }, 1000);
        }
      }
    }
    
    init();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array to run only once
  
  return (
    <AnimatePresence mode="wait">
      {!isInitialized || isLoading ? (
        <LoadingScreen key="loading" />
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <MemoryRouter>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              {/* TODO: Add more routes */}
              {/* <Route path="/onboarding" element={<OnboardingPage />} /> */}
              {/* <Route path="/settings" element={<SettingsPage />} /> */}
            </Routes>
          </MemoryRouter>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
