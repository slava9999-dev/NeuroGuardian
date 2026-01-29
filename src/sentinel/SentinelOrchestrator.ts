import {
  db,
  users,
  products,
  sentinelLogs,
  systemFlags,
  marketplaceAccounts,
} from '../infrastructure/database/db.js';
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
import { browserEyes } from './BrowserEyes.js'; // Real browser for accurate buyer price
import { sentinelPriceReporter } from './PriceReporter.js';
import { notificationService } from '../api-lib/services/notifications.js';
import { logger } from '../api-lib/lib/logger.js';
import { MarketplaceService } from '../api-lib/core-services/MarketplaceService.js';

export class SentinelOrchestrator {
  private priceMonitor: SentinelPriceMonitor;
  private threatDetector: ThreatDetector;
  private defenseExecutor: SentinelDefenseExecutor;
  private reportGenerator: SentinelReportGenerator;
  private alertSender: SentinelAlertSender;
  private marketplaceService: MarketplaceService;

  constructor() {
    this.priceMonitor = new SentinelPriceMonitor();
    this.threatDetector = new ThreatDetector();
    this.defenseExecutor = new SentinelDefenseExecutor();
    this.reportGenerator = new SentinelReportGenerator();
    this.alertSender = new SentinelAlertSender();
    this.marketplaceService = new MarketplaceService();
  }

  /**
   * Returns list of active users for task orchestration
   */
  async getActiveUserIds(): Promise<number[]> {
    const activeUsers = await db.query.users.findMany({
      where: and(
        eq(users.isActive, true),
        drizzleSql`(${users.protectionEnabled} = true OR ${users.subscriptionActive} = true)`
      ),
      columns: { id: true },
    });
    return activeUsers.map(u => Number(u.id));
  }

  /**
   * Run a full cycle for all users
   */
  async runCycle(
    options: { limit?: number; skipDigitalVision?: boolean; sendPriceReport?: boolean } = {}
  ): Promise<SentinelRunResult> {
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
          await this.processUser(user, result, userResult, options);

          const report = this.reportGenerator.generateUserReport(user, userResult);

          if (report && userResult.threatsDetected > 0) {
            // SILENCE LOGIC: Don't send identical summary if threat count matches last reported state
            const lastReport = await db.execute(drizzleSql`
              SELECT details FROM sentinel_logs 
              WHERE user_id = ${user.id} AND threat_type = 'CYCLE_SUMMARY' 
              ORDER BY created_at DESC LIMIT 1
            `);

            const lastCount =
              lastReport.length > 0
                ? JSON.parse(lastReport[0].details as string).threatsDetected
                : -1;

            if (userResult.threatsDetected !== lastCount || options.sendPriceReport) {
              await this.alertSender.sendReport(user, report);

              // Log this summary state
              await db.insert(sentinelLogs).values({
                userId: String(user.id),
                productId: 'SYSTEM',
                productTitle: 'Cycle Summary',
                detectedPrice: 0,
                minPrice: 0,
                defenseAction: 'SUMMARY_SENT',
                savedAmount: 0,
                marketplace: 'ALL',
                threatType: 'CYCLE_SUMMARY',
                success: true,
                details: JSON.stringify({ threatsDetected: userResult.threatsDetected }),
              });
            } else {
              logger.info(
                `Skipping summary for user ${user.id} - threat count unchanged (${lastCount})`
              );
            }
          }
        } catch (err) {
          logger.error('User processing failed', err, { userId: user.id });
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.errors.push(`User ${user.id} processing failed: ${errorMsg}`);

          try {
            await db.insert(sentinelLogs).values({
              userId: String(user.id),
              productId: 'SYSTEM',
              productTitle: 'System Error',
              detectedPrice: 0,
              minPrice: 0,
              defenseAction: 'SYSTEM_ERROR',
              savedAmount: 0,
              marketplace: 'ALL',
              threatType: 'PROCESS_USER_ERROR',
              success: false,
              details: JSON.stringify({ error: errorMsg }),
            });
          } catch (logErr) {
            logger.error('Failed to log system error to DB', logErr);
          }

          // Alert admin immediately on user processing failure
          await this.alertSender.sendCriticalError(`Processing User ${user.id}`, err);

          // INDUSTRIAL UPGRADE: Handle API Auth & Crypto Failures
          if (
            errorMsg.includes('401') ||
            errorMsg.includes('Unauthorized') ||
            errorMsg.includes('Unsupported state') ||
            errorMsg.includes('bad decrypt') ||
            errorMsg.includes('authentication data') ||
            errorMsg.includes('not configured')
          ) {
            logger.warn(`Auth/Crypto failure for user ${user.id}, flagging account`, {
              userId: user.id,
            });

            // Soft disable accounts to prevent log spam, but notify user clearly
            await db.execute(drizzleSql`
              UPDATE marketplace_accounts 
              SET is_active = false, updated_at = NOW() 
              WHERE user_id = ${user.id}
            `);

            await this.alertSender.sendAlert({
              type: 'auth_error',
              urgency: 'high',
              message:
                '🔐 <b>Обновление безопасности</b>\n\nТребуется повторный ввод API-ключей из-за смены алгоритмов шифрования.\n\nСистема приостановлена для вашей безопасности.',
              product: {
                name: 'System Security',
                marketplace: 'ALL',
                externalId: 'security-update',
                userId: Number(user.id),
              },
            });
          }
        }
      }

      // After processing, send summary
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
    options: { limit?: number; skipDigitalVision?: boolean; sendPriceReport?: boolean } = {}
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
    options: { limit?: number; skipDigitalVision?: boolean; sendPriceReport?: boolean } = {}
  ): Promise<void> {
    const monitoredProducts = await db
      .select({ id: products.id })
      .from(products)
      .leftJoin(marketplaceAccounts, eq(products.accountId, marketplaceAccounts.id))
      .where(
        and(
          eq(products.userId, String(user.id)),
          drizzleSql`(${products.isMonitored} = true OR ${products.minPrice} > 0)`,
          drizzleSql`(${products.accountId} IS NULL OR ${marketplaceAccounts.isActive} = true)`
        )
      )
      .limit(options.limit || 2000);

    const productIds = monitoredProducts.map(p => p.id);
    if (productIds.length === 0) return;

    // BATTLE MODE: Increased chunk size for better performance
    const CHUNK_SIZE = 25;
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
          competitor_url: r.competitorUrl,
          competitor_price: r.competitorPrice,
          price_strategy: r.priceStrategy,
        })) as unknown as DBProduct[];

        allProducts.push(...legacyRows);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.error('Error fetching product chunk', error, { chunkIds: chunk });
        const errorMsg = `Failed to fetch product chunk for User ${user.id}: ${error.message}`;
        summary.errors.push(errorMsg);
        if (userResult) userResult.errors.push(errorMsg);
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

    // BATTLE MODE: Optimized processing batch size
    const PRODUCT_BATCH_SIZE = 10;
    const priceUpdates: Array<{ id: number; currentPrice: number }> = [];

    // 3. Hunter Mode (Aggressive Repricing)
    // Run this BEFORE standard checks to ensure we are competitive first
    // Use the mapped products but we need to ensure we access new fields via 'any' casting for now
    await this.processCompetitorsHunter(Number(user.id), allProducts, Date.now());

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

            // SANITY CHECK: Ignore 0/invalid prices from API glitches
            if (livePrice === undefined || (livePrice === 0 && (product.current_price || 0) > 0)) {
              return;
            }

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

                  // --- INDUSTRIAL AGENT LOGIC: DIGITAL VISION FIRST ---
                  // We ALWAYS start with Digital Vision (BrowserEyes) to see what the customer sees.
                  // Only if that fails do we fallback to API.

                  let buyerPrice = 0;
                  let originalPrice = 0;

                  try {
                    // 1. Digital Vision Check
                    const url =
                      marketplace === 'WB'
                        ? `https://www.wildberries.ru/catalog/${sku}/detail.aspx`
                        : `https://www.ozon.ru/product/${sku}/`;

                    const eyeResult = await browserEyes.gazeAtProduct(marketplace, url);
                    buyerPrice = eyeResult?.buyerPrice ?? 0;
                    originalPrice = eyeResult?.originalPrice ?? 0;

                    if (buyerPrice > 0) {
                      logger.info(
                        `[Sentinel Agent] Digital Vision Success for ${sku}: ${buyerPrice}₽ (Seller: ${product.current_price}₽)`
                      );
                    }
                  } catch (eyeError) {
                    logger.warn(
                      `[Sentinel Agent] Digital Vision interrupted for ${sku}, engaging Fallback Protocols`,
                      {
                        error: eyeError,
                      }
                    );
                    buyerPrice = 0;
                  }

                  // 2. Fallback Protocol: API Parser
                  if (buyerPrice === 0) {
                    try {
                      const realPriceInfo =
                        marketplace === 'WB'
                          ? await priceParserService.getWbRealPrice(sku)
                          : await priceParserService.getOzonRealPrice(sku);

                      buyerPrice = realPriceInfo.buyerPrice;
                      originalPrice =
                        (realPriceInfo as unknown as { originalPrice?: number }).originalPrice || 0;

                      if (buyerPrice > 0) {
                        logger.info(
                          `[Sentinel Agent] API Fallback Success for ${sku}: ${buyerPrice}₽`
                        );
                      }
                    } catch (error) {
                      logger.warn(`[Sentinel Agent] All pricing protocols failed for ${sku}`, {
                        error,
                      });
                    }
                  }

                  // Update DB if we got valid price
                  if (buyerPrice > 0) {
                    const discountPercent =
                      originalPrice > 0 ? ((originalPrice - buyerPrice) / originalPrice) * 100 : 0;

                    await db
                      .update(products)
                      .set({
                        estimatedBuyerPrice: buyerPrice,
                        marketplaceDiscountPercent: String(Math.round(discountPercent)),
                        updatedAt: new Date(),
                      })
                      .where(eq(products.id, product.id));

                    product.estimated_buyer_price = buyerPrice;
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

              // Log threats to history database (non-blocking)
              this.threatDetector
                .logThreatsToHistory(String(user.id), scan.threats, marketplace)
                .catch(() => {
                  /* Ignore logging errors */
                });

              // --- IMMEDIATE ALERTING ---
              // For ANY threat, send immediate Telegram alerts with action buttons
              // SILENCE LOGIC: Don't alert if user acknowledged this specific threat in the last 6 hours
              for (const threat of scan.threats) {
                const ackCheck = await db.execute(drizzleSql`
                  SELECT 1 FROM ops_events 
                  WHERE user_id = ${user.id} 
                    AND external_id = ${product.product_id}
                    AND event_type = 'alert_acknowledged'
                    AND created_at > NOW() - INTERVAL '6 hours'
                  LIMIT 1
                `);

                if (ackCheck.length > 0) {
                  logger.debug(
                    `[Sentinel] Skipping alert for ${product.product_id} - already acknowledged in last 6h`
                  );
                  continue;
                }

                // Send detailed threat alert with action buttons via AlertSender
                this.alertSender.sendThreatAlert(user, product, threat, marketplace).catch(err => {
                  logger.error(`Failed to send immediate threat alert for ${product.id}`, err);
                });
              }

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
                  userResult,
                  { requireConfirmation: true } // HARDCODED: ALWAYS ASK FOR CONFIRMATION
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

            // 4. Collect Price for Bulk Update
            const priceDiff = Math.abs(livePrice - (product.current_price || 0));
            const isSignificantChange = priceDiff / (product.current_price || 1) > 0.01;

            if (isSignificantChange || product.current_price === 0) {
              priceUpdates.push({ id: product.id, currentPrice: livePrice });
            }
          } catch (err) {
            logger.error(`Failed to process product ${product.product_id}`, err);
          }
        })
      );
    }

    // BATTLE MODE: Execute bulk price updates
    if (priceUpdates.length > 0) {
      try {
        logger.debug(`[Sentinel] Executing bulk updates for ${priceUpdates.length} products`);
        for (const update of priceUpdates) {
          await db
            .update(products)
            .set({ currentPrice: update.currentPrice, updatedAt: new Date() })
            .where(eq(products.id, update.id));
        }
      } catch (err) {
        logger.error('Bulk price update failed', err);
      }
    }

    // === SENTINEL PRICE REPORT ===
    if (options.sendPriceReport) {
      try {
        const freshProducts = await db.query.products.findMany({
          where: and(
            eq(products.userId, String(user.id)),
            drizzleSql`(${products.isMonitored} = true OR ${products.minPrice} > 0)`
          ),
        });

        // Map Drizzle camelCase to DBProduct snake_case
        const mapped = freshProducts.map(p => ({
          ...p,
          min_price: p.minPrice,
          current_price: p.currentPrice,
          estimated_buyer_price: p.estimatedBuyerPrice,
          product_id: p.productId,
          nm_id: p.nmId,
          offer_id: (p as Record<string, unknown>).offerId as string | null,
          is_monitored: p.isMonitored,
          marketplace: p.marketplace,
          title: p.title,
        })) as unknown as DBProduct[];

        const report = await sentinelPriceReporter.generateDetailedReport(mapped);

        const breaches = mapped.filter(
          p =>
            (p.current_price || 0) > 0 &&
            (p.min_price || 0) > 0 &&
            (p.current_price || 0) < (p.min_price || 0)
        );

        let replyMarkup: Record<string, unknown> | undefined = undefined;
        if (breaches.length > 0) {
          replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: `🚨 Исправить цены (${breaches.length} шт)`,
                  callback_data: `sentinel_fix_prices:${user.id}`,
                },
              ],
            ],
          };
        }

        await notificationService.sendRawMessage(Number(user.id), report, replyMarkup);
      } catch (e) {
        logger.error('Failed to send periodic price report', e);
      }
    }
  }

  /**
   * Hunter Mode: Analyze competitors and adjust prices dynamically
   */
  private async processCompetitorsHunter(
    userId: number,
    productsList: DBProduct[],
    startTime: number
  ) {
    // Filter active hunters
    const hunters = productsList.filter(p => p.competitor_url && p.is_monitored);

    if (hunters.length === 0) return;

    logger.info(`[Hunter] Checking ${hunters.length} competitors for user ${userId}`);

    // Limit concurrency to avoid overloading proxies/LLM
    const chunkSize = 3;
    for (let i = 0; i < hunters.length; i += chunkSize) {
      // Watchdog
      if (Date.now() - startTime > 45000) {
        logger.warn('[Hunter] Time budget exceeded, skipping remaining competitors');
        break;
      }

      const chunk = hunters.slice(i, i + chunkSize);
      await Promise.all(chunk.map(p => this.huntOneProduct(userId, p)));
    }
  }

  private async huntOneProduct(userId: number, product: DBProduct) {
    if (!product.competitor_url) return;

    try {
      const mp = product.competitor_url.includes('ozon') ? 'Ozon' : 'WB';
      // 1. Check Competitor Price using BrowserEyes (real browser)
      const eyesResult = await browserEyes.gazeAtProduct(mp, product.competitor_url);

      if (!eyesResult || !eyesResult.buyerPrice) {
        return;
      }

      const compPrice = eyesResult.buyerPrice;

      // 2. Update DB Knowledge (using schema imports)
      if (compPrice !== product.competitor_price) {
        await db
          .update(products)
          .set({ competitorPrice: compPrice, updatedAt: new Date() })
          .where(eq(products.id, product.id));
      }

      // 3. Strategy Execution
      const strategy = product.price_strategy || 'passive';

      if (strategy.startsWith('aggressive')) {
        const parts = strategy.split(':');
        const diff = parts.length > 1 ? parseInt(parts[1]) : 10;

        const myTargetPrice = compPrice - diff;
        const myMinPrice = product.min_price || 0;

        // Compare BUYER prices (roughly)
        const myCurrentBuyerPrice = product.estimated_buyer_price || product.current_price;

        if (myCurrentBuyerPrice > myTargetPrice) {
          // Drop price
          const delta = myCurrentBuyerPrice - myTargetPrice;
          let newSellerPrice = (product.current_price || 0) - delta;

          if (newSellerPrice >= myMinPrice) {
            // Safe
          } else {
            newSellerPrice = myMinPrice;
          }

          // Only update if change is significant (> 0.5%)
          if (
            Math.abs(newSellerPrice - (product.current_price || 0)) / (product.current_price || 1) >
            0.005
          ) {
            if (newSellerPrice > myMinPrice) {
              logger.info(
                `[Hunter] Undercutting! ${product.product_id}: ${myCurrentBuyerPrice} -> ${myTargetPrice}`
              );

              const sku =
                mp === 'WB'
                  ? Number(product.nm_id)
                  : parseInt(product.product_id.replace('ozon-', ''));
              if (!sku || isNaN(sku)) return;

              await this.marketplaceService.updatePrices(userId, mp, [
                { id: sku, price: newSellerPrice },
              ]);

              await notificationService.sendRawMessage(
                userId,
                `⚔️ **Hunter Attack!**\n\n` +
                  `Снизил цену на **${product.title}**\n` +
                  `📉 ${myCurrentBuyerPrice}₽ -> **~${myTargetPrice}₽** (SELLER: ${newSellerPrice}₽)\n` +
                  `🎯 Конкурент: ${compPrice}₽\n` +
                  `🔗 <a href="${product.competitor_url}">Товар конкурента</a>`,
                undefined // no markup
              );
            } else {
              // Hit Stop Loss
              if ((product.current_price || 0) > myMinPrice * 1.01) {
                // Drop to min price
                const sku =
                  mp === 'WB'
                    ? Number(product.nm_id)
                    : parseInt(product.product_id.replace('ozon-', ''));
                if (!sku || isNaN(sku)) return;

                await this.marketplaceService.updatePrices(userId, mp, [
                  { id: sku, price: myMinPrice },
                ]);

                await notificationService.sendRawMessage(
                  userId,
                  `🛡️ **Sentinel Defense**\n\n` +
                    `Конкурент демпингует (${compPrice}₽)!\n` +
                    `Снизил до **Stop Loss (${myMinPrice}₽)**.\n` +
                    `Ниже нельзя.`,
                  undefined
                );
              }
            }
          }
        }
      }
    } catch (e) {
      logger.error(`[Hunter] Error processing product ${product.product_id}`, e);
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
      `🚀 *МОНИТОРИНГ: СТАТУС ЦИКЛА*`,
      `🕒 Время выполнения: ${time} (МСК)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 *ОПЕРАЦИОННАЯ СВОДКА:*`,
      `├─ Статус: ${hasErrors ? '🔴 КРИТИЧНО' : hasActions ? '🛡️ ЗАЩИТА АКТИВНА' : '🟢 ШТАТНО'}`,
      `├─ Пользователей: ${result.usersProcessed}`,
      `├─ SKU в проверке: ${totalScanned}`,
      `└─ Рисков выявлено: ${result.threatsDetected}`,
      ``,
      hasActions ? `⚡ *ОТРАЖЕНО АТАК:* ${result.actionsTaken}` : '',
      hasErrors ? `⚠️ *ОШИБОК СИСТЕМЫ:* ${result.errors.length}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
    ]
      .filter(line => line !== '')
      .join('\n');

    if (hasErrors) {
      const errorDetails = result.errors
        .slice(0, 5)
        .map(e => `   └ _${e}_`)
        .join('\n');
      await this.alertSender.sendAdminSummary(
        `${message}\n\n🔍 *ЖУРНАЛ ОШИБОК:* \n${errorDetails}`
      );
    } else {
      await this.alertSender.sendAdminSummary(message);
    }
  }
}

export const sentinelOrchestrator = new SentinelOrchestrator();
