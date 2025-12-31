// ============================================
// NeuroGUARDIAN — Sentinel Service
// 30-minute monitoring & price protection cycle
// Version: 2.1.0 | Date: December 2024
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
  updateWbPrices,
  updateOzonPrices,
  type MarketplaceApiKeys,
} from './marketplace.js';
import { scanProductThreats, ThreatType, type Threat } from './threat-detector.js'; // Threat renamed from ProductThreat if it was mismatch
import { logSentinelAction } from './database.js';
import { sendTelegramNotification } from './notifications.js';
import { priceShield, type PriceRule } from './price-shield.js';
import { getCompetitorPrice } from './competitor-monitor.js';
import type { DBUser, DBProduct } from '../lib/types.js';

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
      // We safely cast here because we know the schema matches DBUser
      const users = usersRes.rows as DBUser[];
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
    const user = userRes.rows[0] as DBUser;
    if (user) {
      await this.processUser(user, result);
    }

    return result;
  }

  /**
   * Process a single user's products
   */
  public async processUser(user: DBUser, summary: SentinelRunResult): Promise<void> {
    const keys = await getMarketplaceKeys(user.id);
    if (!keys.wb && !keys.ozon) return;

    // Get monitored products
    const productsRes = await sql`
      SELECT * FROM products 
      WHERE user_id = ${user.id} 
      AND (is_monitored = true OR min_price > 0)
    `;
    const products = productsRes.rows as DBProduct[];
    if (products.length === 0) return;

    // Get Active Price Rules (Smart Repricing)
    const rules = await priceShield.getRulesForUser(user.id);
    const rulesMap = new Map(rules.map(r => [r.product_id, r]));

    // --- WB Sub-cycle ---
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB');
      const nmIds = wbProducts.map(p => p.nm_id).filter((id): id is number => id !== null);
      if (nmIds.length > 0) {
        const { priceMap } = await fetchWbPrices(keys.wb, nmIds);
        await this.handleMarketplaceThreats(
          user,
          wbProducts,
          priceMap,
          'WB',
          keys.wb,
          summary,
          rulesMap
        );
      }
    }

    // --- Ozon Sub-cycle ---
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);
      if (ozonIds.length > 0 && keys.ozon) {
        // TS check for keys.ozon being truthy inside block
        const ozonKeys = keys.ozon;

        const priceMap = await fetchOzonCurrentPrices(ozonKeys.clientId, ozonKeys.apiKey, ozonIds);
        await this.handleMarketplaceThreats(
          user,
          ozonProducts,
          priceMap,
          'Ozon',
          ozonKeys,
          summary,
          rulesMap
        );
      }
    }
  }

  /**
   * Scan threats and enact defense for a set of products
   */
  private async handleMarketplaceThreats(
    user: DBUser,
    products: DBProduct[],
    priceMap: Map<number, number>,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    summary: SentinelRunResult,
    rulesMap: Map<string, PriceRule>
  ): Promise<void> {
    for (const product of products) {
      const key =
        marketplace === 'WB' ? product.nm_id : parseInt(product.product_id.replace('ozon-', ''));

      if (!key) continue;

      const livePrice = priceMap.get(key);
      if (livePrice === undefined) continue;

      // 1. SMART REPRICING (PriceShield)
      // Check if we have active rules for this product
      const rule = rulesMap.get(product.product_id);

      if (rule && rule.auto_adjust && rule.competitor_tracking && rule.competitor_nmids) {
        // Parse first competitor (v1 only supports single primary competitor)
        const competitors = rule.competitor_nmids.split(',').map(s => s.trim());
        if (competitors.length > 0) {
          const competitorId = parseInt(competitors[0]); // Assuming numeric ID for WB
          if (!isNaN(competitorId)) {
            const competitorPrice = await getCompetitorPrice(marketplace, competitorId);

            if (competitorPrice) {
              const repricing = priceShield.calculateOptimalPrice(livePrice, competitorPrice, rule);

              if (repricing.isChangeNeeded) {
                console.log(
                  `🛡️ PriceShield: Updating ${product.title} to ${repricing.newPrice}₽ (${repricing.reason})`
                );

                // Execute Repricing
                let updateSuccess = false;
                if (marketplace === 'WB' && product.nm_id && typeof keys === 'string') {
                  const res = await updateWbPrices(keys, [
                    { nmId: product.nm_id, price: repricing.newPrice },
                  ]);
                  updateSuccess = res.success;
                } else if (marketplace === 'Ozon' && typeof keys !== 'string') {
                  const res = await updateOzonPrices(keys.clientId, keys.apiKey, [
                    {
                      productId: parseInt(product.product_id.replace('ozon-', '')),
                      price: repricing.newPrice,
                    },
                  ]);
                  updateSuccess = res.success;
                }

                if (updateSuccess) {
                  summary.actionsTaken++;
                  // Log action
                  await logSentinelAction({
                    user_id: user.id,
                    product_id: product.product_id,
                    product_title: product.title,
                    detected_price: livePrice,
                    min_price: rule.min_price,
                    defense_action: 'smart_reprice',
                    saved_amount: 0, // Not a saving, but optimization
                    marketplace,
                    threat_type: 'competitor_match',
                    success: true,
                    details: { reason: repricing.reason, competitorPrice },
                  });
                }
              }
            }
          }
        }
      }

      // 2. REGULAR THREAT SCAN & DEFENSE
      // --- Cooldown Check (10 mins) ---
      if (product.updated_at) {
        // Cooldown deferred
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
          // Trigger Defense for Erosion if critical
          if (erosionThreat.severity === 'critical') {
            await this.notifyThreat(user, product, erosionThreat, marketplace);

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
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    summary: SentinelRunResult,
    threatType: string
  ): Promise<void> {
    const defenseMode = user.defense_mode || 'zero_stock';
    const minPrice = product.min_price;
    let success = false;
    let errorMsg = '';

    if (marketplace === 'WB') {
      // WB uses nmId or vendorCode. nmId is cleaner if available.
      // The DBProduct.nm_id is number | null
      const sku = product.nm_id ? String(product.nm_id) : product.product_id;

      if (defenseMode === 'zero_stock' && typeof keys === 'string') {
        const res = await setWbZeroStock(keys, [sku]);
        success = res.success;
        errorMsg = res.error || '';
      } else {
        if (product.nm_id && typeof keys === 'string') {
          const res = await setWbDefensePrice(keys, [{ nmId: product.nm_id, price: minPrice }]);
          success = res.success;
          errorMsg = res.error || '';
        } else {
          errorMsg = 'NM ID missing for WB defense';
          success = false;
        }
      }
    } else {
      const offerId = product.offer_id || product.product_id; // fallback to product_id if offer_id missing (usually offer_id is in product_id for some legacy imports)
      const ozonId = parseInt(product.product_id.replace('ozon-', ''));
      if (defenseMode === 'zero_stock' && typeof keys !== 'string') {
        const res = await setOzonZeroStock(keys.clientId, keys.apiKey, [
          { productId: ozonId, offerId },
        ]);
        success = res.success;
        errorMsg = res.error || '';
      } else if (typeof keys !== 'string') {
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
    user: DBUser,
    product: DBProduct,
    threat: Threat,
    marketplace: string
  ): Promise<void> {
    const message =
      `⚠️ <b>Угроза прибыли!</b>\n\n` +
      `📦 ${product.title}\n` +
      `${marketplace === 'WB' ? '🟣' : '🔵'} ${marketplace}\n\n` +
      `🔍 ${threat.message}\n` +
      `💰 Текущая цена: ${(threat.data as { livePrice?: number })?.livePrice || product.current_price}₽`;

    await sendTelegramNotification(user.id, message);
  }

  private async notifyDefenseSuccess(
    user: DBUser,
    product: DBProduct,
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
