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

      // 3. Send summary notification to admin
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
    logger.debug(`[Sentinel] processUser called for user ${user.id}`);
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
        // Track products scanned
        if (summary.productsScanned) {
          summary.productsScanned.wb += wbProducts.length;
        }
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
        // Track products scanned
        if (summary.productsScanned) {
          summary.productsScanned.ozon += ozonProducts.length;
        }
        // TS check for keys.ozon being truthy inside block
        const ozonKeys = keys.ozon;

        const priceMap = await fetchOzonCurrentPrices(ozonKeys.clientId, ozonKeys.apiKey, ozonIds);
        logger.debug(
          `[Sentinel] Ozon Prices fetched: size=${priceMap.size}, keys=[${Array.from(priceMap.keys())}]`
        );
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
    logger.debug(`[Sentinel] handleMarketplaceThreats for ${products.length} products`);
    for (const product of products) {
      const key =
        marketplace === 'WB' ? product.nm_id : parseInt(product.product_id.replace('ozon-', ''));

      if (!key) continue;

      logger.debug(`[Sentinel] Loop: product=${product.product_id} key=${key}`);
      const livePrice = priceMap.get(key);
      logger.debug(`[Sentinel] Loop: livePrice=${livePrice} (type=${typeof livePrice})`);
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
   * БОЕВОЙ РЕЖИМ: Отправляет ВСЕГДА после каждого цикла
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

    // 1. ПОЛУЧАЕМ РЕАЛЬНЫЕ ДАННЫЕ ИЗ БАЗЫ (Global Truth)
    let totalSellers = 0;
    let totalProducts = 0;
    let wbProducts = 0;
    let ozonProducts = 0;

    try {
      // Считаем сколько ВСЕГО товаров на защите прямо сейчас
      const stats = await sql`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE subscription_active = true OR protection_enabled = true) as total_sellers,
          (SELECT COUNT(*) FROM products WHERE is_monitored = true) as total_products,
          (SELECT COUNT(*) FROM products WHERE is_monitored = true AND marketplace = 'WB') as wb_products,
          (SELECT COUNT(*) FROM products WHERE is_monitored = true AND marketplace = 'OZON') as ozon_products
      `;

      if (stats.rows.length > 0) {
        totalSellers = parseInt(stats.rows[0].total_sellers || '0');
        totalProducts = parseInt(stats.rows[0].total_products || '0'); // Твои 33 товара будут здесь
        wbProducts = parseInt(stats.rows[0].wb_products || '0');
        ozonProducts = parseInt(stats.rows[0].ozon_products || '0');
      }
    } catch (e) {
      console.warn('DB Stats failed, using cycle stats:', e);
      totalProducts = (result.productsScanned?.wb || 0) + (result.productsScanned?.ozon || 0);
    }

    // 2. ОПРЕДЕЛЯЕМ СТАТУС (Боевой режим)
    let statusEmoji = '🟢';
    let statusText = 'Система работает штатно';

    if (result.errors.length > 0) {
      statusEmoji = '🔴';
      statusText = 'Требует внимания';
    } else if (result.actionsTaken > 0) {
      statusEmoji = '🛡️';
      statusText = 'Активная защита срабатывала';
    } else if (result.threatsDetected > 0) {
      statusEmoji = '🟡';
      statusText = 'Есть предупреждения';
    }

    // 3. ФОРМИРУЕМ ОТЧЁТ (Элитный стиль)
    const lines = [
      `🎩 *Отчёт от управляющего*`,
      `📅 ${date} | ⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `📊 *Текущий масштаб:*`,
      `👥 Магазинов на защите: ${totalSellers}`,
    ];

    if (totalProducts > 0) {
      lines.push(`📦 Товаров под контролем: ${totalProducts}`);
      if (wbProducts > 0) lines.push(`   ├ 🟣 Wildberries: ${wbProducts}`);
      if (ozonProducts > 0) lines.push(`   └ 🔵 Ozon: ${ozonProducts}`);
    } else {
      lines.push(`📦 Товаров: 0 (Ожидание синхронизации)`);
    }

    lines.push(``);

    // Секция инцидентов (только если были)
    if (result.threatsDetected > 0 || result.actionsTaken > 0 || result.errors.length > 0) {
      lines.push(`📝 *События за последние 30 мин:*`);
      if (result.threatsDetected > 0)
        lines.push(`⚠️ Угроз зафиксировано: ${result.threatsDetected}`);
      if (result.actionsTaken > 0) lines.push(`⚔️ Отражено атак: ${result.actionsTaken}`);
    }

    // Defense details if any
    if (result.defenseDetails && result.defenseDetails.length > 0) {
      lines.push(``);
      lines.push(`🛡️ *Защита сработала на:*`);
      for (const detail of result.defenseDetails.slice(0, 3)) {
        const mpEmoji = detail.marketplace === 'WB' ? '🟣' : '🔵';
        lines.push(`${mpEmoji} ${detail.product.substring(0, 30)}...`);
      }
      if (result.defenseDetails.length > 3) {
        lines.push(`_...и ещё ${result.defenseDetails.length - 3} товаров_`);
      }
    }

    // Footer
    lines.push(``);
    lines.push(`💡 _Следующая проверка через 30 мин_`);

    const message = lines.filter(Boolean).join('\n');

    // Send to admin
    await notificationService.sendAlertToAdmin({
      type: 'sentinel_alert',
      urgency: result.errors.length > 0 ? 'high' : result.actionsTaken > 0 ? 'medium' : 'low',
      message,
    });

    logger.debug(
      `[Sentinel] Cycle summary sent: ${totalProducts} products, ${result.threatsDetected} threats`
    );
  }
}

export const sentinelService = new SentinelService();
