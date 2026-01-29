import 'dotenv/config';
import { logger } from '../lib/logger.js';

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

interface ProxyStatus {
  url: string;
  config: ProxyConfig;
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

    this.proxies = rawProxies.map(urlStr => {
      const url = urlStr.trim();
      const config = this.parseProxyUrl(url);

      return {
        url,
        config,
        isAlive: true,
        latencyMs: 0,
        failureCount: 0,
        lastUsed: new Date(0),
      };
    });

    if (this.proxies.length > 0) {
      logger.info(`[ProxyService] Pool initialized with ${this.proxies.length} proxies.`);
    } else {
      logger.warn('[ProxyService] Running WITHOUT proxies. Vulnerable to IP bans.');
    }
  }

  /**
   * Parses protocol://user:pass@host:port or protocol://host:port
   */
  private parseProxyUrl(urlStr: string): ProxyConfig {
    try {
      const url = new URL(urlStr);
      const server = `${url.protocol}//${url.host}`;
      const username = url.username ? decodeURIComponent(url.username) : undefined;
      const password = url.password ? decodeURIComponent(url.password) : undefined;

      return { server, username, password };
    } catch {
      // Fallback for simple host:port if protocol is missing
      return { server: urlStr };
    }
  }

  /**
   * Returns the best available proxy config
   */
  async getNextProxyConfig(): Promise<ProxyConfig | null> {
    const proxy = this.getBestAvailable();
    if (!proxy) return null;

    proxy.lastUsed = new Date();
    return proxy.config;
  }

  /**
   * Legacy method for backward compatibility
   */
  async getNextProxy(): Promise<string | null> {
    const proxy = this.getBestAvailable();
    if (!proxy) return null;

    proxy.lastUsed = new Date();
    return proxy.url;
  }

  private getBestAvailable(): ProxyStatus | null {
    if (this.proxies.length === 0) return null;

    const available = this.proxies
      .filter(p => p.isAlive)
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

    if (available.length === 0) {
      logger.error('[ProxyService] 🚨 ALL PROXIES ARE DOWN!');
      return null;
    }

    return available[0];
  }

  /**
   * Report a proxy failure (Industrial feedback loop)
   */
  reportFailure(url: string) {
    const proxy = this.proxies.find(p => p.url === url || p.config.server === url);
    if (proxy) {
      proxy.failureCount++;
      if (proxy.failureCount > 3) {
        proxy.isAlive = false;
        logger.error(`[ProxyService] Proxy blacklisted: ${proxy.url}`);
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
