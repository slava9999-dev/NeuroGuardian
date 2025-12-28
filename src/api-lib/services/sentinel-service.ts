// ============================================
// NeuroGUARDIAN — Sentinel Service
// 30-minute monitoring & price protection cycle
// Version: 2.0.0 | Date: December 2024
// ============================================

import { sql } from '@vercel/postgres';
import {
  getMarketplaceKeys,
  fetchWbPrices,
  fetchOzonCurrentPrices,
  setWbDefensePrice,
  setOzonDefensePrice,
  setWbZeroStock,
  setOzonZeroStock,
} from './marketplace.js';
import { scanProductThreats, ThreatType } from './threat-detector.js';
import { logSentinelAction } from './database.js';
import { sendTelegramNotification } from './notifications.js';

export interface SentinelRunResult {
  usersProcessed: number;
  threatsDetected: number;
  actionsTaken: number;
  errors: string[];
}

export class SentinelService {
  /**
   * Run a full cycle for all users
   */
  async runCycle(): Promise<SentinelRunResult> {
    const result: SentinelRunResult = {
      usersProcessed: 0,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
    };

    try {
      // 1. Get all active users with protection enabled
      const usersRes = await sql`
        SELECT * FROM users 
        WHERE (protection_enabled = true OR subscription_active = true)
        AND is_active = true
      `;
      const users = usersRes.rows as any[];
      result.usersProcessed = users.length;

      console.log(`🛡️ Sentinel Cycle: Processing ${users.length} users...`);

      // 2. Process users sequentially or in small batches to avoid API rate limits
      for (const user of users) {
        try {
          await this.processUser(user, result);
        } catch (err) {
          const errorMsg = `Error processing user ${user.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (err) {
      result.errors.push(`Critical cycle error: ${err}`);
    }

    return result;
  }

  /**
   * Run check for a specific user
   */
  async runForUser(userId: number): Promise<SentinelRunResult> {
    const result: SentinelRunResult = {
      usersProcessed: 1,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
    };

    const userRes = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = userRes.rows[0];
    if (user) {
      await this.processUser(user, result);
    }

    return result;
  }

  /**
   * Process a single user's products
   */
  public async processUser(user: any, summary: SentinelRunResult): Promise<void> {
    const keys = await getMarketplaceKeys(user.id);
    if (!keys.wb && !keys.ozon) return;

    // Get monitored products
    const productsRes = await sql`
      SELECT * FROM products 
      WHERE user_id = ${user.id} 
      AND (is_monitored = true OR min_price > 0)
    `;
    const products = productsRes.rows;
    if (products.length === 0) return;

    // --- WB Sub-cycle ---
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB');
      const nmIds = wbProducts.map(p => p.nm_id).filter(Boolean);
      if (nmIds.length > 0) {
        const { priceMap } = await fetchWbPrices(keys.wb, nmIds);
        await this.handleMarketplaceThreats(user, wbProducts, priceMap, 'WB', keys.wb, summary);
      }
    }

    // --- Ozon Sub-cycle ---
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);
      if (ozonIds.length > 0) {
        const priceMap = await fetchOzonCurrentPrices(
          keys.ozon.clientId,
          keys.ozon.apiKey,
          ozonIds
        );
        await this.handleMarketplaceThreats(
          user,
          ozonProducts,
          priceMap,
          'Ozon',
          keys.ozon,
          summary
        );
      }
    }
  }

  /**
   * Scan threats and enact defense for a set of products
   */
  private async handleMarketplaceThreats(
    user: any,
    products: any[],
    priceMap: Map<number, number>,
    marketplace: 'WB' | 'Ozon',
    keys: any,
    summary: SentinelRunResult
  ): Promise<void> {
    for (const product of products) {
      const key =
        marketplace === 'WB' ? product.nm_id : parseInt(product.product_id.replace('ozon-', ''));
      const livePrice = priceMap.get(key);
      if (livePrice === undefined) continue;

      // --- Cooldown Check (10 mins) ---
      if (product.updated_at) {
        // const lastUpdate = new Date(product.updated_at);
        // const diffMs = Date.now() - lastUpdate.getTime();
        // Cooldown logic is deferred to ACTIONS phase if needed.
        // Currently we scan always on every cycle if price was fetched.
      }

      const scan = scanProductThreats(product, livePrice, marketplace);
      if (scan.hasThreats) {
        summary.threatsDetected += scan.threats.length;

        // Check if Stop-Loss violation is present
        const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);

        // Check for financial threats
        const erosionThreat = scan.threats.find(
          t => t.type === ThreatType.OZON_CARD_EROSION || t.type === ThreatType.MARGIN_BELOW_ZERO
        );

        if (stopLossThreat && user.protection_enabled) {
          // Trigger Defense for Stop-Loss!
          await this.executeDefense(
            user,
            product,
            livePrice,
            marketplace,
            keys,
            summary,
            stopLossThreat.type
          );
        } else if (erosionThreat && user.protection_enabled) {
          // Trigger Defense for Erosion if enabled (e.g. notify or auto-correct if mode supports it)
          // Currently we just notify for erosion unless it hits min_price (which is covered by stop-loss usually)
          // But strict mode might want to zero stock if profit < 0
          if (erosionThreat.severity === 'critical') {
            // For critical erosion (negative profit), we might want to defend too.
            // For now, let's notify.
            await this.notifyThreat(user, product, erosionThreat, marketplace);

            // Log it as action=notify?
            await logSentinelAction({
              user_id: user.id,
              product_id: product.product_id,
              product_title: product.title,
              detected_price: livePrice,
              min_price: product.min_price || 0,
              defense_action: 'notify',
              saved_amount: 0,
              marketplace,
              threat_type: erosionThreat.type,
              success: true,
            });
          } else {
            await this.notifyThreat(user, product, erosionThreat, marketplace);
          }
        }
      }

      // Update current_price in DB for observability
      await sql`
        UPDATE products SET current_price = ${livePrice}, updated_at = NOW() 
        WHERE id = ${product.id}
      `;
    }
  }

  /**
   * Execute defense action (Set price to min or set stock to 0)
   */
  private async executeDefense(
    user: any,
    product: any,
    livePrice: number,
    marketplace: 'WB' | 'Ozon',
    keys: any,
    summary: SentinelRunResult,
    threatType: string
  ): Promise<void> {
    const defenseMode = user.defense_mode || 'zero_stock';
    const minPrice = product.min_price;
    let success = false;
    let errorMsg = '';

    if (marketplace === 'WB') {
      if (defenseMode === 'zero_stock') {
        const res = await setWbZeroStock(keys, [product.vendor_code || String(product.nm_id)]);
        success = res.success;
        errorMsg = res.error || '';
      } else {
        const res = await setWbDefensePrice(keys, [{ nmId: product.nm_id, price: minPrice }]);
        success = res.success;
        errorMsg = res.error || '';
      }
    } else {
      const offerId = product.offer_id;
      const ozonId = parseInt(product.product_id.replace('ozon-', ''));
      if (defenseMode === 'zero_stock') {
        const res = await setOzonZeroStock(keys.clientId, keys.apiKey, [
          { productId: ozonId, offerId },
        ]);
        success = res.success;
        errorMsg = res.error || '';
      } else {
        const res = await setOzonDefensePrice(keys.clientId, keys.apiKey, [
          { productId: ozonId, offerId, price: minPrice },
        ]);
        success = res.success;
        errorMsg = res.error || '';
      }
    }

    // Always log the attempt
    summary.actionsTaken++;
    const savedAmount = Math.max(0, minPrice - livePrice);

    await logSentinelAction({
      user_id: user.id,
      product_id: product.product_id,
      product_title: product.title,
      detected_price: livePrice,
      min_price: minPrice,
      defense_action: defenseMode,
      saved_amount: savedAmount,
      marketplace,
      threat_type: threatType,
      success,
    });

    if (success) {
      // Notify User
      await this.notifyDefenseSuccess(user, product, livePrice, minPrice, defenseMode, marketplace);
    } else {
      console.error(`❌ Sentinel fail for ${product.product_id}: ${errorMsg}`);
      summary.errors.push(`Defense failed for ${product.product_id}: ${errorMsg}`);
    }
  }

  private async notifyThreat(
    user: any,
    product: any,
    threat: any,
    marketplace: string
  ): Promise<void> {
    const message =
      `⚠️ <b>Угроза прибыли!</b>\n\n` +
      `📦 ${product.title}\n` +
      `${marketplace === 'WB' ? '🟣' : '🔵'} ${marketplace}\n\n` +
      `🔍 ${threat.message}\n` +
      `💰 Текущая цена: ${threat.data.livePrice || product.current_price}₽`;

    await sendTelegramNotification(user.id, message);
  }

  private async notifyDefenseSuccess(
    user: any,
    product: any,
    livePrice: number,
    minPrice: number,
    mode: string,
    marketplace: string
  ): Promise<void> {
    const emoji = marketplace === 'WB' ? '🟣' : '🔵';
    const actionText =
      mode === 'zero_stock' ? 'Обнулены остатки' : `Цена возвращена к ${minPrice}₽`;

    const message =
      `🛡️ <b>Sentinel: Защита сработала!</b>\n\n` +
      `📦 ${product.title}\n` +
      `${emoji} ${marketplace}\n\n` +
      `🚨 Обнаружена цена: ${livePrice}₽\n` +
      `🔒 Лимит (Stop-Loss): ${minPrice}₽\n` +
      `⚔️ <b>Действие: ${actionText}</b>\n\n` +
      `✅ Товар защищён от убытков.`;

    await sendTelegramNotification(user.id, message);
  }
}

export const sentinelService = new SentinelService();
