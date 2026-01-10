// ============================================
// NeuroGUARDIAN — Sentinel Service
// 30-minute monitoring & price protection cycle
// Version: 2.2.0 | Date: January 2026
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
import { scanProductThreats, ThreatType, type Threat } from './threat-detector.js';
import { logSentinelAction } from './database.js';
import { sendAlert, notificationService } from './notifications.js';
import { priceShield, type PriceRule } from './price-shield.js';
import { getCompetitorPrice } from './competitor-monitor.js';
import type { DBUser, DBProduct } from '../lib/types.js';
import type { AlertUrgency } from './notifications.js';

export interface SentinelRunResult {
  usersProcessed: number;
  threatsDetected: number;
  actionsTaken: number;
  errors: string[];
  productsScanned?: { wb: number; ozon: number };
  defenseDetails?: Array<{ product: string; action: string; marketplace: string }>;
}

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

    try {
      const usersRes = await sql`
        SELECT * FROM users 
        WHERE (protection_enabled = true OR subscription_active = true)
        AND is_active = true
      `;
      const users = usersRes.rows as DBUser[];
      result.usersProcessed = users.length;

      console.log(`🛡️ Sentinel Cycle: Processing ${users.length} users...`);

      for (const user of users) {
        const userResult: UserCycleResult = {
          userId: user.id,
          telegramId: user.id,
          firstName: user.first_name || undefined,
          productsScanned: { wb: 0, ozon: 0 },
          threatsDetected: 0,
          actionsTaken: 0,
          defenseDetails: [],
          errors: [],
        };

        try {
          await this.processUser(user, result, userResult);

          if (userResult.productsScanned.wb > 0 || userResult.productsScanned.ozon > 0) {
            await this.sendUserReport(user, userResult);
          }
        } catch (err) {
          const errorMsg = `Error processing user ${user.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Send summary to admin after all users processed
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
   * Process a single user's products (Unified method)
   */
  public async processUser(
    user: DBUser,
    summary: SentinelRunResult,
    userResult?: UserCycleResult
  ): Promise<void> {
    const keys = await getMarketplaceKeys(user.id);
    if (!keys.wb && !keys.ozon) return;

    const productsRes = await sql`
      SELECT * FROM products 
      WHERE user_id = ${user.id} 
      AND (is_monitored = true OR min_price > 0)
    `;
    const products = productsRes.rows as DBProduct[];

    if (products.length === 0) return;

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
        if (summary.productsScanned) summary.productsScanned.wb += wbProducts.length;
        if (userResult) userResult.productsScanned.wb = wbProducts.length;

        try {
          const { priceMap, error } = await fetchWbPrices(keys.wb, nmIds);
          if (error) {
            const msg = `WB API Error (User ${user.id}): ${error}`;
            summary.errors.push(msg);
            if (userResult) userResult.errors.push(msg);
          }

          await this.handleMarketplaceThreats(
            user,
            wbProducts,
            priceMap,
            'WB',
            keys.wb,
            summary,
            rulesMap,
            userResult
          );
        } catch (err) {
          const msg = `WB Cycle Error (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`;
          summary.errors.push(msg);
          if (userResult) userResult.errors.push(msg);
        }
      }
    }

    // --- Ozon Sub-cycle ---
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);

      if (ozonIds.length > 0) {
        if (summary.productsScanned) summary.productsScanned.ozon += ozonProducts.length;
        if (userResult) userResult.productsScanned.ozon = ozonProducts.length;

        const ozonKeys = keys.ozon;
        let ozonPriceMap = new Map<number, number>();

        try {
          ozonPriceMap = await fetchOzonCurrentPrices(ozonKeys.clientId, ozonKeys.apiKey, ozonIds);
        } catch (err) {
          const msg = `Ozon API Error (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`;
          summary.errors.push(msg);
          if (userResult) userResult.errors.push(msg);
        }

        if (ozonPriceMap.size === 0) {
          for (const product of ozonProducts) {
            if (product.current_price && product.current_price > 0) {
              const ozonId = parseInt(product.product_id.replace('ozon-', ''));
              if (ozonId) ozonPriceMap.set(ozonId, product.current_price);
            }
          }
        }

        await this.handleMarketplaceThreats(
          user,
          ozonProducts,
          ozonPriceMap,
          'Ozon',
          ozonKeys,
          summary,
          rulesMap,
          userResult
        );
      }
    }
  }

  private async handleMarketplaceThreats(
    user: DBUser,
    products: DBProduct[],
    priceMap: Map<number, number>,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    summary: SentinelRunResult,
    rulesMap: Map<string, PriceRule>,
    userResult?: UserCycleResult
  ): Promise<void> {
    for (const product of products) {
      const key =
        marketplace === 'WB'
          ? Number(product.nm_id)
          : Number(product.product_id.replace('ozon-', ''));
      const livePrice = priceMap.get(key);
      if (!livePrice) continue;

      // 1. Smart Repricing
      const rule = rulesMap.get(product.product_id);
      if (rule && rule.auto_adjust && rule.competitor_tracking && rule.competitor_nmids) {
        try {
          const competitors = rule.competitor_nmids.split(',').map(s => s.trim());
          if (competitors.length > 0) {
            const competitorId = parseInt(competitors[0]);
            if (!isNaN(competitorId)) {
              const competitorPrice = await getCompetitorPrice(marketplace, competitorId);
              if (competitorPrice) {
                const repricing = priceShield.calculateOptimalPrice(
                  livePrice,
                  competitorPrice,
                  rule
                );
                if (repricing.isChangeNeeded) {
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
                    if (userResult) {
                      userResult.actionsTaken++;
                      userResult.defenseDetails.push({
                        product: product.title,
                        action: 'smart_reprice',
                        marketplace,
                        savedAmount: 0,
                      });
                    }
                    await logSentinelAction({
                      user_id: user.id,
                      product_id: product.product_id,
                      product_title: product.title,
                      detected_price: livePrice,
                      min_price: rule.min_price,
                      defense_action: 'smart_reprice',
                      saved_amount: 0,
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
        } catch (e) {
          console.error(`❌ PriceShield error for ${product.product_id}:`, e);
        }
      }

      // 2. Regular Threat Scan
      const scan = scanProductThreats(product, livePrice, marketplace);
      if (scan.hasThreats) {
        summary.threatsDetected += scan.threats.length;
        if (userResult) userResult.threatsDetected += scan.threats.length;

        // COMPETITOR_PRICE_DROP = price dropped below min_price (stop-loss trigger)
        // This is the threat type defined in threat-detector.ts for stop-loss violations
        const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);
        const erosionThreat = scan.threats.find(
          t => t.type === ThreatType.OZON_CARD_EROSION || t.type === ThreatType.MARGIN_BELOW_ZERO
        );

        if (stopLossThreat && user.protection_enabled) {
          await this.executeDefense(
            user,
            product,
            livePrice,
            marketplace,
            keys,
            summary,
            stopLossThreat.type,
            userResult
          );
        } else if (
          erosionThreat &&
          user.protection_enabled &&
          erosionThreat.severity === 'critical'
        ) {
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
      }

      await sql`UPDATE products SET current_price = ${livePrice}, updated_at = NOW() WHERE id = ${product.id}`;
    }
  }

  private async executeDefense(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon',
    keys: string | NonNullable<MarketplaceApiKeys['ozon']>,
    summary: SentinelRunResult,
    threatType: string,
    userResult?: UserCycleResult
  ): Promise<void> {
    const defenseMode = user.defense_mode || 'price_correction';
    const minPrice = product.min_price;
    let success = false;
    let errorMsg = '';

    if (minPrice > livePrice * 5 && minPrice > 10000) {
      const msg = `⛔ Defense Aborted: min_price (${minPrice}) is suspiciously high vs live (${livePrice}) for ${product.title}.`;
      summary.errors.push(msg);
      if (userResult) userResult.errors.push(msg);
      return;
    }

    try {
      if (marketplace === 'WB' && typeof keys === 'string') {
        const nmId = product.nm_id;
        if (!nmId) throw new Error('Missing nmId for WB');
        if (defenseMode === 'zero_stock') {
          const res = await setWbZeroStock(keys, [String(nmId)]);
          success = res.success;
          errorMsg = res.error || '';
        } else {
          const res = await setWbDefensePrice(keys, [{ nmId, price: minPrice }]);
          success = res.success;
          errorMsg = res.error || '';
        }
      } else if (marketplace === 'Ozon' && typeof keys !== 'string') {
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
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    const savedAmount = Math.max(0, minPrice - livePrice);
    if (success) {
      summary.actionsTaken++;
      if (userResult) {
        userResult.actionsTaken++;
        userResult.defenseDetails.push({
          product: product.title,
          action: defenseMode,
          marketplace,
          savedAmount,
        });
      }
      if (summary.defenseDetails) {
        summary.defenseDetails.push({ product: product.title, action: defenseMode, marketplace });
      }
      await this.notifyDefenseSuccess(user, product, livePrice, minPrice, defenseMode, marketplace);
    } else {
      const msg = `Defense failed for ${product.product_id}: ${errorMsg}`;
      summary.errors.push(msg);
      if (userResult) userResult.errors.push(msg);
    }

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
  }

  private async notifyThreat(
    user: DBUser,
    product: DBProduct,
    threat: Threat,
    marketplace: string
  ): Promise<void> {
    await sendAlert({
      type: 'sentinel_alert',
      urgency: threat.severity as AlertUrgency,
      product: {
        name: product.title,
        marketplace,
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
        marketplace,
        externalId: product.nm_id ? String(product.nm_id) : product.product_id,
        userId: user.id,
      },
      analysis: {
        currentPrice: livePrice,
        recommendedPrice: minPrice,
        reason: `Защита: ${mode === 'zero_stock' ? 'остаток→0' : 'цена↑'}`,
        action: mode,
      },
    });
  }

  /**
   * Send report to user based on their notifications_mode setting
   * 'all' (default) = send every 30 minutes
   * 'threats_only' = only when threats/actions/errors occur
   */
  private async sendUserReport(user: DBUser, userResult: UserCycleResult): Promise<void> {
    const totalScanned = userResult.productsScanned.wb + userResult.productsScanned.ozon;
    if (totalScanned === 0) return;

    const hasThreats = userResult.threatsDetected > 0;
    const hasActions = userResult.actionsTaken > 0;
    const hasErrors = userResult.errors.length > 0;
    const hasSomething = hasThreats || hasActions || hasErrors;

    // Check user's notification preference (default: 'all')
    const notificationsMode = user.notifications_mode || 'all';

    if (notificationsMode === 'threats_only' && !hasSomething) {
      // User chose to only receive notifications when something happens
      console.log(`✅ User ${user.id}: All OK, notifications_mode=threats_only (skipping)`);
      return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    let statusEmoji = '🟢',
      statusText = 'Всё в порядке';
    if (hasErrors) {
      statusEmoji = '🔴';
      statusText = 'Есть ошибки';
    } else if (hasActions) {
      statusEmoji = '⚔️';
      statusText = 'Защита сработала!';
    } else if (hasThreats) {
      statusEmoji = '🟡';
      statusText = 'Угрозы обнаружены';
    }

    const message = [
      `🛡️ *Отчёт по магазину*`,
      `⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `📦 Проверено: ${totalScanned}`,
      hasThreats ? `⚠️ Угроз: ${userResult.threatsDetected}` : '',
      hasActions ? `⚔️ Защищено: ${userResult.actionsTaken}` : '',
      hasErrors ? `❌ Ошибок: ${userResult.errors.length}` : '',
      ``,
      `_Следующая проверка через 30 мин_`,
    ]
      .filter(Boolean)
      .join('\n');
    await notificationService.sendTelegramNotification(user.id, message);
  }

  /**
   * Send cycle summary to ADMIN
   * Always sends to keep admin informed about system status
   */
  private async sendCycleSummary(result: SentinelRunResult): Promise<void> {
    const hasActions = result.actionsTaken > 0;
    const hasErrors = result.errors.length > 0;

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
    const wbScanned = result.productsScanned?.wb || 0;
    const ozonScanned = result.productsScanned?.ozon || 0;
    const totalScanned = wbScanned + ozonScanned;

    let statusEmoji = '🟢',
      statusText = 'Система штатно';
    if (hasErrors) {
      statusEmoji = '🔴';
      statusText = 'Есть ошибки';
    } else if (hasActions) {
      statusEmoji = '⚔️';
      statusText = 'Защита сработала!';
    }

    const message = [
      `🎩 ИТОГИ ЦИКЛА`,
      `⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `👥 Магазинов: ${result.usersProcessed}`,
      `📦 Товаров: ${totalScanned}`,
      hasActions ? `⚔️ Отражено: ${result.actionsTaken}` : '',
      hasErrors ? `❌ Ошибок: ${result.errors.length}` : '',
      ``,
      `💡 Следующая проверка через 30 минут`,
    ]
      .filter(Boolean)
      .join('\n');
    await notificationService.sendAlertToAdmin({ type: 'sentinel_alert', urgency: 'low', message });
  }
}

export const sentinelService = new SentinelService();
