// ============================================
// NeuroGUARDIAN — Sentinel Service
// 30-minute monitoring & price protection cycle
// Version: 2.1.0 | Date: December 2024
// ============================================

import { sql } from './database.js';
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
import { sendAlert, notificationService } from './notifications.js';
import { priceShield, type PriceRule } from './price-shield.js';
import { getCompetitorPrice } from './competitor-monitor.js';
import { logger } from '../lib/index.js';
import type { DBUser, DBProduct } from '../lib/types.js';

export interface SentinelRunResult {
  usersProcessed: number;
  threatsDetected: number;
  actionsTaken: number;
  errors: string[];
  // Extended stats for reporting
  productsScanned?: { wb: number; ozon: number };
  defenseDetails?: Array<{ product: string; action: string; marketplace: string }>;
}

// Per-user results for individual reports
export interface UserCycleResult {
  userId: number;
  telegramId: number;
  firstName?: string;
  productsScanned: { wb: number; ozon: number };
  threatsDetected: number;
  actionsTaken: number;
  defenseDetails: Array<{
    product: string;
    action: string;
    marketplace: string;
    savedAmount: number;
  }>;
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
      productsScanned: { wb: 0, ozon: 0 },
      defenseDetails: [],
    };

    // Track per-user results for individual reports
    const userResults: UserCycleResult[] = [];

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

      // 2. Process users sequentially with individual tracking
      for (const user of users) {
        // Create per-user result tracker
        const userResult: UserCycleResult = {
          userId: user.id,
          telegramId: user.id, // In DBUser, id IS the Telegram user ID
          firstName: user.first_name || undefined,
          productsScanned: { wb: 0, ozon: 0 },
          threatsDetected: 0,
          actionsTaken: 0,
          defenseDetails: [],
          errors: [],
        };

        try {
          console.log(`🛡️ Sentinel: Processing user ${user.id}...`);
          await this.processUserWithTracking(user, result, userResult);
          console.log(
            `✅ Sentinel: User ${user.id} processed. Actions: ${userResult.actionsTaken}, Errors: ${userResult.errors.length}`
          );

          // Send PERSONAL report to this user
          await this.sendUserReport(user, userResult);

          // Small delay between users to prevent DB connection reset
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          const errorMsg = `Error processing user ${user.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
          userResult.errors.push(errorMsg);
        }

        userResults.push(userResult);
      }

      // 3. Send admin summary (aggregated across all users)
      await this.sendCycleSummary(result);
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
    const rulesMap = new Map<string, PriceRule>();
    for (const rule of rules) {
      rulesMap.set(rule.product_id, rule);
    }

    // --- WB Sub-cycle ---
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB');
      const nmIds = wbProducts.map(p => p.nm_id).filter((id): id is number => id !== null);
      if (nmIds.length > 0) {
        if (summary.productsScanned) {
          summary.productsScanned.wb += wbProducts.length;
        }
        const { priceMap, error } = await fetchWbPrices(keys.wb, nmIds);

        if (error) {
          summary.errors.push(`WB API Error (User ${user.id}): ${error}`);
        }

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
        // Track products scanned
        if (summary.productsScanned) {
          summary.productsScanned.ozon += ozonProducts.length;
        }
        // TS check for keys.ozon being truthy inside block
        const ozonKeys = keys.ozon;

        let ozonPriceMap = new Map<number, number>();
        let ozonError: string | undefined;

        try {
          const result = await fetchOzonCurrentPrices(ozonKeys.clientId, ozonKeys.apiKey, ozonIds);
          // fetchOzonCurrentPrices returns Map<number, number> directly based on its signature
          ozonPriceMap = result;
        } catch (err) {
          ozonError = err instanceof Error ? err.message : String(err);
        }

        // WORKAROUND: If API failed or returned empty, use DB prices
        // Per commit 9b55371: Ozon Prices API returns 404, use current_price from DB
        if (ozonPriceMap.size === 0) {
          console.log(`⚠️ Ozon API returned no prices, using DB prices as fallback`);
          for (const product of ozonProducts) {
            if (product.current_price && product.current_price > 0) {
              const ozonId = parseInt(product.product_id.replace('ozon-', ''));
              if (ozonId) {
                ozonPriceMap.set(ozonId, product.current_price);
              }
            }
          }
          console.log(`💾 Using ${ozonPriceMap.size} prices from DB for Ozon`);
        }

        if (ozonError) {
          summary.errors.push(`Ozon API Error (User ${user.id}): ${ozonError}`);
        }

        logger.debug(
          `[Sentinel] Ozon Prices fetched: size=${ozonPriceMap.size}, keys=[${Array.from(ozonPriceMap.keys())}]`
        );

        await this.handleMarketplaceThreats(
          user,
          ozonProducts,
          ozonPriceMap,
          'Ozon',
          ozonKeys,
          summary,
          rulesMap
        );
      }
    }
  }

  /**
   * Process a single user with per-user tracking
   * Wraps processUser but also tracks individual stats for personal reports
   */
  private async processUserWithTracking(
    user: DBUser,
    globalSummary: SentinelRunResult,
    userResult: UserCycleResult
  ): Promise<void> {
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

    // Get Active Price Rules
    const rules = await priceShield.getRulesForUser(user.id);
    const rulesMap = new Map<string, PriceRule>();
    for (const rule of rules) {
      rulesMap.set(rule.product_id, rule);
    }

    // --- Ozon Sub-cycle ---
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);

      if (ozonIds.length > 0) {
        // Track per-user stats
        userResult.productsScanned.ozon = ozonProducts.length;
        if (globalSummary.productsScanned) {
          globalSummary.productsScanned.ozon += ozonProducts.length;
        }

        const ozonKeys = keys.ozon;
        let ozonPriceMap = new Map<number, number>();

        try {
          ozonPriceMap = await fetchOzonCurrentPrices(ozonKeys.clientId, ozonKeys.apiKey, ozonIds);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          userResult.errors.push(`Ozon API: ${errorMsg}`);
          globalSummary.errors.push(`Ozon API Error (User ${user.id}): ${errorMsg}`);
        }

        // Fallback to DB prices if API failed
        if (ozonPriceMap.size === 0) {
          for (const product of ozonProducts) {
            if (product.current_price && product.current_price > 0) {
              const ozonId = parseInt(product.product_id.replace('ozon-', ''));
              if (ozonId) ozonPriceMap.set(ozonId, product.current_price);
            }
          }
        }

        await this.handleMarketplaceThreatsWithTracking(
          user,
          ozonProducts,
          ozonPriceMap,
          'Ozon',
          ozonKeys,
          globalSummary,
          userResult,
          rulesMap
        );
      }
    }

    // --- WB Sub-cycle ---
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB');
      const nmIds = wbProducts.map(p => p.nm_id).filter((id): id is number => id !== null);

      if (nmIds.length > 0) {
        userResult.productsScanned.wb = wbProducts.length;
        if (globalSummary.productsScanned) {
          globalSummary.productsScanned.wb += wbProducts.length;
        }

        let wbPriceMap = new Map<number, number>();

        try {
          const result = await fetchWbPrices(keys.wb, nmIds);
          wbPriceMap = result.priceMap;
          if (result.error) {
            userResult.errors.push(`WB API warning: ${result.error}`);
            // Don't clutter global summary with warnings unless critical
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          userResult.errors.push(`WB API: ${errorMsg}`);
          globalSummary.errors.push(`WB API Error (User ${user.id}): ${errorMsg}`);
        }

        await this.handleMarketplaceThreatsWithTracking(
          user,
          wbProducts,
          wbPriceMap,
          'WB',
          keys.wb,
          globalSummary,
          userResult,
          rulesMap
        );
      }
    }
  }

  /**
   * Handle threats with per-user tracking
   */
  private async handleMarketplaceThreatsWithTracking(
    user: DBUser,
    products: DBProduct[],
    priceMap: Map<number, number>,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    globalSummary: SentinelRunResult,
    userResult: UserCycleResult,
    _rulesMap: Map<string, PriceRule>
  ): Promise<void> {
    for (const product of products) {
      const key =
        marketplace === 'WB'
          ? Number(product.nm_id)
          : Number(product.product_id.replace('ozon-', ''));
      const livePrice = priceMap.get(key);

      if (!livePrice) continue;

      // Scan for threats
      const scan = scanProductThreats(product, livePrice, marketplace);

      if (scan.hasThreats) {
        globalSummary.threatsDetected += scan.threats.length;
        userResult.threatsDetected += scan.threats.length;

        const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);

        if (stopLossThreat && user.protection_enabled) {
          // Execute defense and track
          const defenseResult = await this.executeDefenseWithTracking(
            user,
            product,
            livePrice,
            marketplace,
            keys,
            globalSummary,
            userResult,
            stopLossThreat.type
          );

          if (defenseResult.success) {
            userResult.defenseDetails.push({
              product: product.title,
              action: user.defense_mode || 'price_correction',
              marketplace,
              savedAmount: defenseResult.savedAmount,
            });
          }
        }
      }

      // Update price in DB
      await sql`
        UPDATE products SET current_price = ${livePrice}, updated_at = NOW() 
        WHERE id = ${product.id}
      `;
    }
  }

  /**
   * Execute defense with per-user tracking
   */
  private async executeDefenseWithTracking(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    globalSummary: SentinelRunResult,
    userResult: UserCycleResult,
    threatType: string
  ): Promise<{ success: boolean; savedAmount: number }> {
    const defenseMode = user.defense_mode || 'price_correction';
    const minPrice = product.min_price;
    let success = false;
    let errorMsg = '';

    if (marketplace === 'Ozon' && typeof keys !== 'string') {
      const ozonId = parseInt(product.product_id.replace('ozon-', ''));
      const offerId = product.offer_id || product.product_id;

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

    const savedAmount = Math.max(0, minPrice - livePrice);

    // Log action
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
      globalSummary.actionsTaken++;
      userResult.actionsTaken++;

      // Track defense in global summary
      if (globalSummary.defenseDetails) {
        globalSummary.defenseDetails.push({
          product: product.title,
          action: defenseMode,
          marketplace,
        });
      }

      // Notify user about successful defense
      await this.notifyDefenseSuccess(user, product, livePrice, minPrice, defenseMode, marketplace);
    } else {
      const errText = `Defense failed for ${product.product_id}: ${errorMsg}`;
      globalSummary.errors.push(errText);
      userResult.errors.push(errText);
    }

    return { success, savedAmount };
  }

  /**
   * Send personal report to individual user
   */
  private async sendUserReport(user: DBUser, userResult: UserCycleResult): Promise<void> {
    // Skip if no products scanned (user has no monitored products)
    const totalScanned = userResult.productsScanned.wb + userResult.productsScanned.ozon;
    if (totalScanned === 0) return;

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    // Determine status
    let statusEmoji = '🟢';
    let statusText = 'Всё в порядке';

    if (userResult.errors.length > 0) {
      statusEmoji = '🔴';
      statusText = 'Есть ошибки';
    } else if (userResult.actionsTaken > 0) {
      statusEmoji = '⚔️';
      statusText = 'Защита сработала!';
    } else if (userResult.threatsDetected > 0) {
      statusEmoji = '🟡';
      statusText = 'Обнаружены угрозы';
    }

    const lines = [
      `🛡️ *Отчёт по вашему магазину*`,
      `⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `📦 Проверено товаров: ${totalScanned}`,
    ];

    if (userResult.threatsDetected > 0) {
      lines.push(`⚠️ Угроз: ${userResult.threatsDetected}`);
    }

    if (userResult.actionsTaken > 0) {
      lines.push(`⚔️ Отражено атак: ${userResult.actionsTaken}`);

      // Add defense details
      if (userResult.defenseDetails.length > 0) {
        lines.push(``);
        lines.push(`🛡️ *Защита:*`);
        for (const detail of userResult.defenseDetails.slice(0, 3)) {
          const action = detail.action === 'zero_stock' ? 'остаток→0' : 'цена↑';
          const saved = detail.savedAmount > 0 ? ` (+${detail.savedAmount}₽)` : '';
          lines.push(`• ${detail.product.substring(0, 25)}... ${action}${saved}`);
        }
        if (userResult.defenseDetails.length > 3) {
          lines.push(`_...и ещё ${userResult.defenseDetails.length - 3}_`);
        }
      }
    }

    if (userResult.errors.length > 0) {
      lines.push(``);
      lines.push(`❌ Ошибок: ${userResult.errors.length}`);
    }

    lines.push(``);
    lines.push(`_Следующая проверка через 30 мин_`);

    const message = lines.join('\n');
    console.log(`📡 Sentinel: Sending report to user ${user.id} (Scanned: ${totalScanned})`);

    // Send to THIS user specifically
    await notificationService.sendTelegramNotification(user.id, message);
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
    logger.debug(`[Sentinel] handleMarketplaceThreats for ${products.length} products`);
    for (const product of products) {
      const key =
        marketplace === 'WB'
          ? Number(product.nm_id)
          : Number(product.product_id.replace('ozon-', ''));
      const livePrice = priceMap.get(key);

      logger.debug(
        `[Sentinel] Loop: product=${product.product_id} key=${key} livePrice=${livePrice} (type=${typeof livePrice})`
      );

      if (!livePrice) continue;

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
          // Only notify for CRITICAL erosion threats (real negative margin)
          // Don't spam users with medium/high severity estimated warnings
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
          }
          // For non-critical threats, just log but DON'T notify (no spam)
        }
      }

      // Update current_price in DB for observability
      logger.debug(`[Sentinel] Updating DB for product ${product.id} price ${livePrice}`);
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
      // Track defense for summary
      if (summary.defenseDetails) {
        summary.defenseDetails.push({
          product: product.title,
          action: defenseMode,
          marketplace,
        });
      }
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
    await sendAlert({
      type: 'sentinel_alert',
      urgency: threat.severity as any,
      product: {
        name: product.title,
        marketplace: marketplace,
        externalId: product.nm_id ? String(product.nm_id) : product.product_id,
        userId: user.id,
      },
      message: threat.message,
      data: {
        livePrice: (threat.data as { livePrice?: number })?.livePrice || product.current_price,
      },
    });
  }

  private async notifyDefenseSuccess(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    minPrice: number,
    mode: string,
    marketplace: string
  ): Promise<void> {
    await sendAlert({
      type: 'price_protection',
      urgency: 'high',
      product: {
        name: product.title,
        marketplace: marketplace,
        externalId: product.nm_id ? String(product.nm_id) : product.product_id,
        userId: user.id,
      },
      analysis: {
        currentPrice: livePrice,
        recommendedPrice: minPrice,
        reason: `Защита сработала: ${mode === 'zero_stock' ? 'обнуление остатков' : 'возврат цены'}`,
        action: mode,
      },
    });
  }

  /**
   * Send cycle summary notification to admin
   * БОЕВОЙ РЕЖИМ: Отчет на основе РЕАЛЬНЫХ данных текущего цикла
   */
  private async sendCycleSummary(result: SentinelRunResult): Promise<void> {
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
    const date = now.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Moscow',
    });

    // 1. СТАТИСТИКА ИЗ ТЕКУЩЕГО ЦИКЛА (Real Truth)
    const usersProcessed = result.usersProcessed || 0;
    const wbScanned = result.productsScanned?.wb || 0;
    const ozonScanned = result.productsScanned?.ozon || 0;
    const totalScanned = wbScanned + ozonScanned;

    // 2. ОПРЕДЕЛЯЕМ СТАТУС (Боевой режим)
    let statusEmoji = '🟢';
    let statusText = 'Система работает штатно';

    if (result.errors.length > 0) {
      statusEmoji = '🔴';
      statusText = 'Есть критические ошибки';
    } else if (result.actionsTaken > 0) {
      statusEmoji = '⚔️';
      statusText = 'Активная защита сработала';
    } else if (result.threatsDetected > 0) {
      statusEmoji = '🟡';
      statusText = 'Зафиксированы угрозы';
    } else if (totalScanned === 0 && usersProcessed > 0) {
      statusEmoji = '⚪';
      statusText = 'Нет данных для проверки';
    } else if (usersProcessed === 0) {
      statusEmoji = '💤';
      statusText = 'Нет активных защит';
    }

    // 3. ФОРМИРУЕМ ОТЧЁТ (Улучшенный формат)
    const lines = [
      `🎩 *ОТЧЁТ ОТ УПРАВЛЯЮЩЕГО*`,
      `📅 ${date} • ⏰ ${time}`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 *Результаты проверки:*`,
    ];

    // Пользователи и товары
    lines.push(`👥 Магазинов: ${usersProcessed}`);

    if (totalScanned > 0) {
      lines.push(`📦 Товаров: ${totalScanned}`);
      if (ozonScanned > 0) lines.push(`   � Ozon: ${ozonScanned}`);
      if (wbScanned > 0) lines.push(`   � WB: ${wbScanned}`);
    } else if (usersProcessed > 0) {
      lines.push(`📦 Товаров: 0`);
      lines.push(`   _⚠️ Проверьте настройки мониторинга_`);
    }

    // Секция событий
    if (result.threatsDetected > 0 || result.actionsTaken > 0 || result.errors.length > 0) {
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📝 *События:*`);

      if (result.actionsTaken > 0) {
        const plural =
          result.actionsTaken === 1 ? 'атака' : result.actionsTaken < 5 ? 'атаки' : 'атак';
        lines.push(`⚔️ Отражено: ${result.actionsTaken} ${plural}`);
      }

      if (result.threatsDetected > 0) {
        const plural =
          result.threatsDetected === 1 ? 'угроза' : result.threatsDetected < 5 ? 'угрозы' : 'угроз';
        lines.push(`⚠️ Обнаружено: ${result.threatsDetected} ${plural}`);
      }

      if (result.errors.length > 0) {
        lines.push(`❌ Ошибок: ${result.errors.length}`);
        // Показываем первую ошибку для диагностики
        const firstError = result.errors[0].split(':').slice(0, 2).join(':');
        lines.push(`   _${firstError.substring(0, 45)}..._`);
      }
    }

    // Defense details (конкретика по защите)
    if (result.defenseDetails && result.defenseDetails.length > 0) {
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🛡️ *Защищённые товары:*`);
      for (const detail of result.defenseDetails.slice(0, 5)) {
        const mpEmoji = detail.marketplace === 'WB' ? '🟣' : '🔵';
        const actionText = detail.action === 'zero_stock' ? '📦 Остаток→0' : '💰 Цена↑';
        const productName =
          detail.product.length > 30 ? detail.product.substring(0, 27) + '...' : detail.product;
        lines.push(`${mpEmoji} ${productName}`);
        lines.push(`   ${actionText}`);
      }
      if (result.defenseDetails.length > 5) {
        lines.push(`   _...и ещё ${result.defenseDetails.length - 5} товаров_`);
      }
    }

    // Footer
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`💡 _Следующая проверка через 30 минут_`);

    const message = lines.filter(Boolean).join('\n');

    // Отправляем админу
    await notificationService.sendAlertToAdmin({
      type: 'sentinel_alert',
      urgency: result.errors.length > 0 ? 'high' : result.actionsTaken > 0 ? 'medium' : 'low',
      message,
    });

    logger.debug(
      `[Sentinel] Real-time cycle summary sent: ${totalScanned} products scanned for ${usersProcessed} users`
    );
  }
}

export const sentinelService = new SentinelService();
