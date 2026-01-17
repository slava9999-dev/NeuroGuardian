import { db, users, products, sentinelLogs, systemFlags } from '../infrastructure/database/db.js';
import { eq, and, sql as drizzleSql, inArray } from 'drizzle-orm';

import { logSentinelAction } from '../api-lib/services/database.js';
import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import { SentinelPriceMonitor } from './PriceMonitor.js';
import { ThreatDetector, ThreatType, type Threat } from './ThreatDetector.js';
import { SentinelDefenseExecutor } from './DefenseExecutor.js';
import { SentinelReportGenerator } from './ReportGenerator.js';
import { SentinelAlertSender } from './AlertSender.js';
import type { SentinelRunResult, UserCycleResult } from './types.js';
import { priceShield, type PriceRule } from './PriceShield.js';
import { getCompetitorPrice } from '../api-lib/services/competitor-monitor.js';
import { priceParserService } from '../api-lib/core-services/PriceParserService.js';
import { logger } from '../api-lib/lib/logger.js';

export class SentinelOrchestrator {
  private priceMonitor: SentinelPriceMonitor;
  private threatDetector: ThreatDetector;
  private defenseExecutor: SentinelDefenseExecutor;
  private reportGenerator: SentinelReportGenerator;
  private alertSender: SentinelAlertSender;

  constructor() {
    this.priceMonitor = new SentinelPriceMonitor();
    this.threatDetector = new ThreatDetector();
    this.defenseExecutor = new SentinelDefenseExecutor();
    this.reportGenerator = new SentinelReportGenerator();
    this.alertSender = new SentinelAlertSender();
  }

  /**
   * Run a full cycle for all users
   */
  async runCycle(): Promise<SentinelRunResult> {
    // Check Emergency Stop using Drizzle
    try {
      const stopFlag = await db.query.systemFlags.findFirst({
        where: eq(systemFlags.key, 'sentinel_emergency_stop'),
      });

      if (stopFlag?.valueBool) {
        logger.warn('Sentinel emergency stop active, cycle aborted');
        return {
          usersProcessed: 0,
          threatsDetected: 0,
          actionsTaken: 0,
          errors: ['EMERGENCY STOP ACTIVE'],
          productsScanned: { wb: 0, ozon: 0 },
        };
      }
    } catch {
      // Ignore if logs table not ready or schema mismatch during migration
    }

    const result: SentinelRunResult = {
      usersProcessed: 0,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
      productsScanned: { wb: 0, ozon: 0 },
    };

    try {
      const activeUsers = await db.query.users.findMany({
        where: and(
          eq(users.isActive, true),
          drizzleSql`(${users.protectionEnabled} = true OR ${users.subscriptionActive} = true)`
        ),
      });

      const legacyUsers = activeUsers.map(u => ({
        ...u,
        first_name: u.firstName,
        protection_enabled: u.protectionEnabled,
        subscription_active: u.subscriptionActive,
      })) as unknown as DBUser[];

      result.usersProcessed = legacyUsers.length;
      logger.info('Sentinel cycle started', { usersCount: legacyUsers.length });

      for (const user of legacyUsers) {
        const userResult: UserCycleResult = {
          userId: Number(user.id),
          telegramId: Number(user.id),
          firstName: user.first_name || undefined,
          productsScanned: { wb: 0, ozon: 0 },
          threatsDetected: 0,
          actionsTaken: 0,
          errors: [],
          defenseDetails: [],
        };

        try {
          logger.info(`Processing User: ${user.first_name || user.id} (${user.id})`);
          await this.processUser(user, result, userResult);

          const report = this.reportGenerator.generateUserReport(user, userResult);
          if (report) {
            await this.alertSender.sendReport(user, report);
          }
        } catch (err) {
          logger.error('User processing failed', err, { userId: user.id });
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.errors.push(`User ${user.id} processing failed: ${errorMsg}`);

          try {
            await db.insert(sentinelLogs).values({
              userId: String(user.id),
              productId: 'SYSTEM',
              action: 'PROCESS_USER',
              newValue: JSON.stringify({ error: errorMsg }),
              details: 'SYSTEM_ERROR',
              marketplace: 'ALL',
            });
          } catch (logErr) {
            logger.error('Failed to log system error to DB', logErr);
          }

          // Alert admin immediately on user processing failure
          await this.alertSender.sendCriticalError(`Processing User ${user.id}`, err);

          // INDUSTRIAL UPGRADE: Handle API Auth Failures
          if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            logger.warn(`Auth failure for user ${user.id}, flagging account`, { userId: user.id });
            await db.execute(drizzleSql`
              UPDATE marketplace_accounts 
              SET is_active = false, updated_at = NOW() 
              WHERE user_id = ${user.id}
            `);
            await this.alertSender.sendAuthAlert(user);
          }
        }
      }

      await this.sendCycleSummary(result);
    } catch (err) {
      result.errors.push(`Critical cycle error: ${err}`);
      await this.alertSender.sendCriticalError('Sentinel Cycle Critical Failure', err);
    }

    return result;
  }

  /**
   * Run for a specific user
   */
  async runForUser(
    userId: string | number,
    options: { limit?: number; skipDigitalVision?: boolean } = {}
  ): Promise<SentinelRunResult> {
    const result: SentinelRunResult = {
      usersProcessed: 1,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
      productsScanned: { wb: 0, ozon: 0 },
    };

    const user = await db.query.users.findFirst({
      where: eq(users.id, String(userId)),
    });

    if (user) {
      const legacyUser = {
        ...user,
        first_name: user.firstName,
        protection_enabled: user.protectionEnabled,
      } as unknown as DBUser;
      await this.processUser(legacyUser, result, undefined, options);
    }
    return result;
  }

  private async processUser(
    user: DBUser,
    summary: SentinelRunResult,
    userResult?: UserCycleResult,
    options: { limit?: number; skipDigitalVision?: boolean } = {}
  ): Promise<void> {
    const monitoredProducts = await db.query.products.findMany({
      columns: { id: true },
      where: and(
        eq(products.userId, String(user.id)),
        drizzleSql`(${products.isMonitored} = true OR ${products.minPrice} > 0)`
      ),
      limit: options.limit,
    });

    const productIds = monitoredProducts.map(p => p.id);
    if (productIds.length === 0) return;

    const CHUNK_SIZE = 5;
    const allProducts: DBProduct[] = [];

    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      try {
        const rows = await db.query.products.findMany({
          where: inArray(products.id, chunk),
        });

        const legacyRows = rows.map(r => ({
          ...r,
          product_id: r.productId,
          nm_id: r.nmId,
          current_price: r.currentPrice,
          min_price: r.minPrice,
          current_stock: r.currentStock,
          account_id: r.accountId,
          target_buyer_price: r.targetBuyerPrice,
          spp_buffer_percent: r.sppBufferPercent,
          auto_adjust_min_price: r.autoAdjustMinPrice,
          estimated_buyer_price: r.estimatedBuyerPrice,
          marketplace_discount_percent: r.marketplaceDiscountPercent,
          updated_at: r.updatedAt,
        })) as unknown as DBProduct[];

        allProducts.push(...legacyRows);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.error('Error fetching product chunk', error, { chunkIds: chunk });
        summary.errors.push(`Failed to fetch product chunk for User ${user.id}: ${error.message}`);
      }
    }

    if (allProducts.length === 0) return;

    const prices = await this.priceMonitor.fetchAll(user, allProducts);
    const contextErrors = prices.errors.map(err => `[User ${user.id}] ${err}`);
    summary.errors.push(...contextErrors);
    if (userResult) userResult.errors.push(...prices.errors);

    if (summary.productsScanned) {
      summary.productsScanned.wb += prices.wb.size;
      summary.productsScanned.ozon += prices.ozon.size;
    }
    if (userResult) {
      userResult.productsScanned.wb = prices.wb.size;
      userResult.productsScanned.ozon = prices.ozon.size;
    }

    const rules = await priceShield.getRulesForUser(user.id);
    const rulesMap = new Map<string, PriceRule>();
    for (const rule of rules) {
      rulesMap.set(rule.product_id, rule);
    }

    const PRODUCT_BATCH_SIZE = 3;
    for (let i = 0; i < allProducts.length; i += PRODUCT_BATCH_SIZE) {
      const productBatch = allProducts.slice(i, i + PRODUCT_BATCH_SIZE);

      await Promise.all(
        productBatch.map(async product => {
          try {
            const marketplace = product.marketplace as 'WB' | 'Ozon';
            const key =
              marketplace === 'WB'
                ? Number(product.nm_id)
                : parseInt(product.product_id.replace('ozon-', ''));

            const priceMap = marketplace === 'WB' ? prices.wb : prices.ozon;
            const livePrice = priceMap.get(key);

            if (!livePrice) return;

            // --- Digital Vision Update ---
            if (!options.skipDigitalVision) {
              const lastUpdate = product.updated_at ? new Date(product.updated_at).getTime() : 0;
              const shouldRefreshRealPrice =
                !product.estimated_buyer_price || Date.now() - lastUpdate > 12 * 60 * 60 * 1000;

              if (shouldRefreshRealPrice) {
                try {
                  const sku =
                    marketplace === 'WB'
                      ? String(product.nm_id)
                      : product.product_id.replace('ozon-', '');
                  const realPriceInfo =
                    marketplace === 'WB'
                      ? await priceParserService.getWbRealPrice(sku)
                      : await priceParserService.getOzonRealPrice(sku);

                  if (realPriceInfo.buyerPrice > 0) {
                    const discountPercent =
                      realPriceInfo.sellerPrice > 0
                        ? ((realPriceInfo.sellerPrice - realPriceInfo.buyerPrice) /
                            realPriceInfo.sellerPrice) *
                          100
                        : 0;

                    await db
                      .update(products)
                      .set({
                        estimatedBuyerPrice: realPriceInfo.buyerPrice,
                        marketplaceDiscountPercent: String(Math.round(discountPercent)),
                        updatedAt: new Date(),
                      })
                      .where(eq(products.id, product.id));

                    product.estimated_buyer_price = realPriceInfo.buyerPrice;
                    product.marketplace_discount_percent = discountPercent;
                  }
                } catch (e) {
                  logger.warn(`Failed to update buyer price for ${product.product_id}`, {
                    error: e,
                  });
                }
              }
            }

            // A. Smart Repricing
            const rule = rulesMap.get(product.product_id);
            if (rule && rule.auto_adjust && rule.competitor_tracking && rule.competitor_nmids) {
              try {
                const competitors = rule.competitor_nmids.split(',').map((s: string) => s.trim());
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
                        await this.defenseExecutor.executeSmartReprice(
                          user,
                          product,
                          livePrice,
                          repricing.newPrice,
                          marketplace,
                          summary,
                          { reason: repricing.reason, competitorPrice },
                          userResult
                        );
                      }
                    }
                  }
                }
              } catch (e) {
                logger.error('PriceShield repricing error', e, { productId: product.product_id });
              }
            }

            // B. SPP Buffer Auto-Adjustment
            if (
              product.auto_adjust_min_price &&
              product.target_buyer_price &&
              product.target_buyer_price > 0
            ) {
              const sppBufferPercent = product.spp_buffer_percent ?? 25;
              const calculatedMinPrice = Math.ceil(
                product.target_buyer_price / (1 - sppBufferPercent / 100)
              );

              if (product.min_price < calculatedMinPrice) {
                try {
                  await db
                    .update(products)
                    .set({ minPrice: calculatedMinPrice, updatedAt: new Date() })
                    .where(eq(products.id, product.id));
                  product.min_price = calculatedMinPrice;
                } catch (e) {
                  logger.warn('Failed to auto-adjust min_price', {
                    productId: product.id,
                    error: e,
                  });
                }
              }
            }

            // C. Threat Detection
            const scan = this.threatDetector.scanProductThreats(product, livePrice, marketplace);
            if (scan.hasThreats) {
              summary.threatsDetected += scan.threats.length;
              if (userResult) userResult.threatsDetected += scan.threats.length;

              const stopLossThreat = scan.threats.find(
                (t: Threat) => t.type === ThreatType.COMPETITOR_PRICE_DROP
              );
              if (stopLossThreat && user.protection_enabled) {
                await this.defenseExecutor.executeDefense(
                  user,
                  product,
                  livePrice,
                  marketplace,
                  summary,
                  stopLossThreat.type,
                  userResult
                );
              } else {
                try {
                  await logSentinelAction({
                    user_id: user.id,
                    product_id: product.product_id,
                    product_title: product.title,
                    detected_price: livePrice,
                    min_price: product.min_price || 0,
                    defense_action: 'MONITOR_ONLY',
                    saved_amount: 0,
                    marketplace,
                    threat_type: scan.threats[0].type,
                    success: true,
                    details: { threats: scan.threats },
                  });
                } catch {
                  // Ignore logging errors
                }
              }
            }

            // 4. Update Price in DB
            const priceDiff = Math.abs(livePrice - (product.current_price || 0));
            const isSignificantChange = priceDiff / (product.current_price || 1) > 0.01;

            if (isSignificantChange || product.current_price === 0) {
              await db
                .update(products)
                .set({ currentPrice: livePrice, updatedAt: new Date() })
                .where(eq(products.id, product.id));
            }
          } catch (err) {
            logger.error(`Failed to process product ${product.product_id}`, err);
          }
        })
      );
    }
  }

  private async sendCycleSummary(result: SentinelRunResult): Promise<void> {
    const hasActions = result.actionsTaken > 0;
    const hasErrors = result.errors.length > 0;
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
    const totalScanned = (result.productsScanned?.wb || 0) + (result.productsScanned?.ozon || 0);

    const message = [
      `🎩 ИТОГИ ЦИКЛА: ${time} (МСК)`,
      hasErrors ? '🛑 Есть ошибки' : hasActions ? '⚔️ Защита сработала!' : '🟢 Система штатно',
      ``,
      `👥 Магазинов: ${result.usersProcessed}`,
      `📦 Проверено: ${totalScanned}`,
      `⚠️ Угроз: ${result.threatsDetected}`,
      hasActions ? `⚔️ Отражено: ${result.actionsTaken}` : '',
      hasErrors ? `❌ Ошибок: ${result.errors.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.alertSender.sendAdminSummary(message);
  }
}

export const sentinelOrchestrator = new SentinelOrchestrator();
