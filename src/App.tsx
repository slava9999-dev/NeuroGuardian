// ============================================
// NeuroGUARDIAN — Main App Entry
// ============================================

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
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
  subscriptionActive: false,
  subscriptionExpiresAt: null,
  subscriptionPlan: null,
  protectionEnabled: false,
  defenseMode: 'zero_stock' as const,
  wbKeyRef: null,
  ozonKeyRef: null,
  totalProducts: 0,
  triggeredToday: 0,
  savedAmount: 0,
};

// Pages enum
type Page = 'dashboard' | 'settings';

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const setLoading = useAppStore((state) => state.setLoading);
  const isLoading = useAppStore((state) => state.isLoading);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  
  const initPerformed = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization (especially in React Strict Mode)
    if (initPerformed.current) return;
    initPerformed.current = true;

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
                  if (response.success && response.user) {
                      console.log('✅ Authentication successful', response.user);
                      setUser(response.user);
                  }
              } catch (err) {
                  console.error("❌ Auth failed:", err);
              }
          }
        } else {
          console.log('🔧 Development mode: Using mock user');
          setUser(MOCK_USER);
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
      }
      
      // Always complete initialization after delay
      console.log('⏳ Completing initialization in 1s...');
      setTimeout(() => {
        console.log('✨ Initialization complete');
        setLoading(false);
        setIsInitialized(true);
      }, 1000);
    }
    
    init();
  }, []);
  
  // Navigation functions
  const goToSettings = () => setCurrentPage('settings');
  const goToDashboard = () => setCurrentPage('dashboard');
  
  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      {currentPage === 'dashboard' && (
        <DashboardPage onGoToSettings={goToSettings} />
      )}
      {currentPage === 'settings' && (
        <SettingsPage onBack={goToDashboard} />
      )}
      
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 safe-area-inset-bottom z-40">
        <div className="flex justify-around py-2">
          <button
            onClick={goToDashboard}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              currentPage === 'dashboard' ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="text-xs font-medium">Защита</span>
          </button>
          
          <button
            onClick={goToSettings}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              currentPage === 'settings' ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-xs font-medium">Настройки</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default App;
