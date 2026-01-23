import { logger } from '../lib/logger.js';

interface ProxyStatus {
  url: string;
  isAlive: boolean;
  latencyMs: number;
  failureCount: number;
  lastUsed: Date;
}

/**
 * INDUSTRIAL PROXY ROTATOR
 * Manages pools of residential/mobile proxies for stealth parsing.
 */
export class ProxyService {
  private proxies: ProxyStatus[] = [];

  constructor() {
    this.refreshPool();
  }

  /**
   * Refreshes the proxy pool from ENV or external API (Industrial ready)
   */
  private refreshPool() {
    const rawProxies = process.env.PROXY_URLS ? process.env.PROXY_URLS.split(',') : [];

    this.proxies = rawProxies.map(url => ({
      url: url.trim(),
      isAlive: true,
      latencyMs: 0,
      failureCount: 0,
      lastUsed: new Date(0),
    }));

    if (this.proxies.length > 0) {
      logger.info(`[ProxyService] Pool initialized with ${this.proxies.length} proxies.`);
    } else {
      logger.warn('[ProxyService] Running WITHOUT proxies. Vulnerable to IP bans.');
    }
  }

  /**
   * Returns the best available proxy URL
   */
  async getNextProxy(): Promise<string | null> {
    if (this.proxies.length === 0) return null;

    // Filtration: find alive proxies, sort by last used (Round Robin behavior)
    const available = this.proxies
      .filter(p => p.isAlive)
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

    if (available.length === 0) {
      logger.error('[ProxyService] 🚨 ALL PROXIES ARE DOWN!');
      return null;
    }

    const proxy = available[0];
    proxy.lastUsed = new Date();
    return proxy.url;
  }

  /**
   * Report a proxy failure (Industrial feedback loop)
   */
  reportFailure(url: string) {
    const proxy = this.proxies.find(p => p.url === url);
    if (proxy) {
      proxy.failureCount++;
      if (proxy.failureCount > 3) {
        proxy.isAlive = false;
        logger.error(`[ProxyService] Proxy blacklisted: ${url}`);
      }
    }
  }

  /**
   * Reset alive status for all proxies
   */
  resetAll() {
    this.proxies.forEach(p => {
      p.isAlive = true;
      p.failureCount = 0;
    });
  }
}

export const proxyService = new ProxyService();
