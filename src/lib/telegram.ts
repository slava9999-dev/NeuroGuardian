// ============================================
// NeuroGUARDIAN — Telegram WebApp SDK
// ============================================

import type { TelegramWebApp, TelegramUser } from '../types';

// Declare global Telegram object
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Get Telegram WebApp instance
 * Returns null if not running in Telegram
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * Check if running inside Telegram WebApp
 */
export function isTelegramWebApp(): boolean {
  const tg = getTelegramWebApp();
  return tg !== null && !!tg.initData;
}

/**
 * Get current Telegram user
 */
export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.user ?? null;
}

/**
 * Get init data for backend validation
 */
export function getInitData(): string {
  const tg = getTelegramWebApp();
  return tg?.initData ?? '';
}

let isInitialized = false;
/**
 * Initialize Telegram WebApp
 * Call this on app startup
 */
export function initTelegramWebApp(): void {
  if (isInitialized) {
    console.log('⚠️ Telegram WebApp already initialized');
    return;
  }

  const tg = getTelegramWebApp();
  if (!tg) {
    console.warn('⚠️ Not running in Telegram WebApp environment');
    return;
  }

  isInitialized = true;

  // Signal that the app is ready
  tg.ready();

  // Expand to full height
  tg.expand();

  // Set header color
  if ('setHeaderColor' in tg) {
    (tg as TelegramWebApp & { setHeaderColor: (color: string) => void }).setHeaderColor('#0c0c0e');
  }

  // Set background color
  if ('setBackgroundColor' in tg) {
    (tg as TelegramWebApp & { setBackgroundColor: (color: string) => void }).setBackgroundColor(
      '#0c0c0e'
    );
  }

  console.log('✅ Telegram WebApp initialized', {
    version: tg.version,
    platform: tg.platform,
    colorScheme: tg.colorScheme,
  });
}

/**
 * Show Telegram native alert
 */
export function showAlert(message: string): Promise<void> {
  return new Promise(resolve => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.showAlert(message, resolve);
    } else {
      alert(message);
      resolve();
    }
  });
}

/**
 * Show Telegram native confirm dialog
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.showConfirm(message, resolve);
    } else {
      resolve(confirm(message));
    }
  });
}

/**
 * Trigger haptic feedback
 */
export function hapticFeedback(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
): void {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;

  switch (type) {
    case 'light':
    case 'medium':
    case 'heavy':
      tg.HapticFeedback.impactOccurred(type);
      break;
    case 'success':
    case 'warning':
    case 'error':
      tg.HapticFeedback.notificationOccurred(type);
      break;
  }
}

/**
 * Close the WebApp
 */
export function closeWebApp(): void {
  const tg = getTelegramWebApp();
  tg?.close();
}

/**
 * MainButton helpers
 */
export const MainButton = {
  show(text: string, onClick: () => void): void {
    const tg = getTelegramWebApp();
    if (!tg?.MainButton) return;

    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    tg.MainButton.show();
  },

  hide(): void {
    const tg = getTelegramWebApp();
    tg?.MainButton?.hide();
  },

  showProgress(): void {
    const tg = getTelegramWebApp();
    tg?.MainButton?.showProgress(true);
  },

  hideProgress(): void {
    const tg = getTelegramWebApp();
    tg?.MainButton?.hideProgress();
  },

  enable(): void {
    const tg = getTelegramWebApp();
    tg?.MainButton?.enable();
  },

  disable(): void {
    const tg = getTelegramWebApp();
    tg?.MainButton?.disable();
  },
};

/**
 * BackButton helpers
 */
export const BackButton = {
  show(onClick: () => void): void {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;

    tg.BackButton.onClick(onClick);
    tg.BackButton.show();
  },

  hide(): void {
    const tg = getTelegramWebApp();
    tg?.BackButton?.hide();
  },
};

/**
 * Normalize and validate HTTP URL
 * Cleans garbage from malformed HTML, adds https:// if missing
 */
function normalizeHttpUrl(raw: string): string | null {
  if (!raw) return null;

  // 1) Trim and cut at first space/quote/tag (handles: https://url" target=...)
  let s = raw.trim();
  s = s.split(/[\s"'<>]/)[0];

  // 2) If looks like domain but missing scheme, add https://
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(s) && !/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  // 3) Validate as URL and only allow http/https
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Open external link in browser (not inside WebApp)
 * Uses Telegram WebApp API if available, with URL normalization
 */
export function openExternalLink(rawUrl: string): void {
  console.log('🔗 openExternalLink called with raw:', rawUrl);

  const url = normalizeHttpUrl(rawUrl);
  if (!url) {
    console.warn('❌ Invalid URL after normalization:', rawUrl);
    return;
  }

  console.log('✅ Normalized URL:', url);

  const tg = getTelegramWebApp();

  // Must be called from click handler (user gesture) for WebView to allow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (tg && typeof (tg as any).openLink === 'function') {
    console.log('🔗 Using Telegram.WebApp.openLink()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tg as any).openLink(url, { try_instant_view: false });
  } else {
    console.log('🔗 Fallback: window.open()');
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
