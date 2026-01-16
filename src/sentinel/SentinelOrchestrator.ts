import { sql, logSentinelAction } from '../api-lib/services/database.js';
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
    // Check Emergency Stop
    try {
      const flagsRes =
        await sql`SELECT value_bool FROM system_flags WHERE key = 'sentinel_emergency_stop'`;
      if (flagsRes.rows[0]?.value_bool) {
        logger.warn('Sentinel emergency stop active, cycle aborted');
        return {
          usersProcessed: 0,
          threatsDetected: 0,
          actionsTaken: 0,
          errors: ['EMERGENCY STOP ACTIVE'],
          productsScanned: { wb: 0, ozon: 0 },
          defenseDetails: [],
        };
      }
    } catch {
      // Table might not exist yet, ignore
      logger.debug('System flags check skipped (table missing)');
    }

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

      logger.info('Sentinel cycle started', { usersCount: users.length });

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

          // Log to database even if it's a general processing failure
          try {
            await sql`
              INSERT INTO sentinel_logs (user_id, product_id, success, details, threat_type, defense_action, marketplace)
              VALUES (${user.id}, 'SYSTEM', false, ${JSON.stringify({ error: errorMsg })}, 'SYSTEM_ERROR', 'PROCESS_USER', 'ALL')
            `;
          } catch (logErr) {
            logger.error('Failed to log system error to DB', logErr);
          }

          // Alert admin immediately on user processing failure
          await this.alertSender.sendCriticalError(`Processing User ${user.id}`, err);
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
  async runForUser(userId: number): Promise<SentinelRunResult> {
    const result: SentinelRunResult = {
      usersProcessed: 1,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
      productsScanned: { wb: 0, ozon: 0 },
    };

    const userRes = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = userRes.rows[0] as DBUser;
    if (user) {
      await this.processUser(user, result);
    }
    return result;
  }

  private async processUser(
    user: DBUser,
    summary: SentinelRunResult,
    userResult?: UserCycleResult
  ): Promise<void> {
    // AUDIT-FIX: Fetch product IDs first, then fetch details in chunks to avoid MTU issues on VPN

    // 1. Get all relevant IDs first (lightweight query)
    const idRes = await sql`
      SELECT id FROM products 
      WHERE user_id::text = ${user.id}::text 
      AND (is_monitored = true OR min_price > 0)
    `;

    // Explicitly cast to number[] assuming id is serial/number.
    const productIds: number[] = (idRes.rows as { id: number }[]).map(r => r.id);

    if (productIds.length === 0) return;

    // chunk size 5 is safer for unstable MTU/VPN connections
    const CHUNK_SIZE = 5;
    const products: DBProduct[] = [];

    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      try {
        logger.debug('Fetching products chunk', {
          chunkIndex: Math.floor(i / CHUNK_SIZE) + 1,
          itemCount: chunk.length,
        });

        // AUDIT-FIX: Select ONLY required columns to minimize packet size for VPN/MTU stability
        // Use ANY() for safe parameterization of ID list
        const chunkRes = await sql`
                        SELECT id, user_id, product_id, nm_id, title, current_price, min_price, 
                                current_stock, marketplace, is_monitored, account_id,
                                target_buyer_price, spp_buffer_percent, auto_adjust_min_price,
                                estimated_buyer_price, marketplace_discount_percent, updated_at
                        FROM products 
                        WHERE id = ANY(${chunk})
                    `;
        const rows = (chunkRes as unknown as { rows: DBProduct[] }).rows;

        if (rows) {
          products.push(...rows);
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.error('Error fetching product chunk', error, { chunkIds: chunk });
        const errorMsg = error.message;
        summary.errors.push(`Failed to fetch product chunk for User ${user.id}: ${errorMsg}`);

        // Log to database
        try {
          await sql`
            INSERT INTO sentinel_logs (user_id, product_id, success, details, threat_type, defense_action, marketplace)
            VALUES (${user.id}, 'SYSTEM_CHUNK', false, ${JSON.stringify({ error: `Chunk fetch failed: ${errorMsg}`, chunk })}, 'SYSTEM_ERROR', 'FETCH_CHUNK', 'ALL')
          `;
        } catch (logErr) {
          const lErr = logErr instanceof Error ? logErr : new Error(String(logErr));
          logger.warn('Failed to log chunk error to DB', { error: lErr });
        }
      }
    }

    if (products.length === 0) return;

    // 1. Fetch Prices
    const prices = await this.priceMonitor.fetchAll(user, products);

    // Accumulate stats / errors with User Context
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

    // 2. Process each product (Price Logic + Threats + Defense)
    // Use smaller parallel batches to avoid overloading marketplace APIs but speed up processing
    const PRODUCT_BATCH_SIZE = 3;
    let processedCount = 0;

    for (let i = 0; i < products.length; i += PRODUCT_BATCH_SIZE) {
      const productBatch = products.slice(i, i + PRODUCT_BATCH_SIZE);

      await Promise.all(
        productBatch.map(async product => {
          processedCount++;
          if (processedCount % 5 === 0 || processedCount === 1) {
            logger.debug(
              `[User ${user.id}] Processing product ${processedCount}/${products.length}`,
              {
                product: product.title || 'Unknown',
                mp: product.marketplace,
              }
            );
          }

          const marketplace = product.marketplace as 'WB' | 'Ozon';
          const key =
            marketplace === 'WB'
              ? Number(product.nm_id)
              : parseInt(product.product_id.replace('ozon-', ''));

          const priceMap = marketplace === 'WB' ? prices.wb : prices.ozon;
          const livePrice = priceMap.get(key);

          if (!livePrice) return;

          // --- Digital Vision Update ---
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
                logger.debug(`[BuyerPrice] ${product.product_id}: ${realPriceInfo.buyerPrice}₽`);
                const discountPercent =
                  realPriceInfo.sellerPrice > 0
                    ? ((realPriceInfo.sellerPrice - realPriceInfo.buyerPrice) /
                        realPriceInfo.sellerPrice) *
                      100
                    : 0;

                await sql`
                UPDATE products 
                SET estimated_buyer_price = ${realPriceInfo.buyerPrice},
                    marketplace_discount_percent = ${Math.round(discountPercent)},
                    updated_at = NOW()
                WHERE id = ${product.id}
              `;
                // Update local reference for subsequent logic
                product.estimated_buyer_price = realPriceInfo.buyerPrice;
                product.marketplace_discount_percent = discountPercent;
              }
            } catch (e) {
              logger.warn(`Failed to update buyer price for ${product.product_id}`, { error: e });
              // Do not fail the cycle for this non-critical enhancement
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
              summary.errors.push(`PriceShield error for ${product.product_id}: ${String(e)}`);
            }
          }

          // B. SPP Buffer Auto-Adjustment (Smart Stop-Loss)
          const targetBuyerPrice = product.target_buyer_price;
          const sppBufferPercent = product.spp_buffer_percent ?? 25;
          const autoAdjustEnabled = product.auto_adjust_min_price;

          if (autoAdjustEnabled && targetBuyerPrice && targetBuyerPrice > 0) {
            // Formula: min_price = target_buyer_price / (1 - spp_buffer_percent / 100)
            const calculatedMinPrice = Math.ceil(targetBuyerPrice / (1 - sppBufferPercent / 100));

            if (product.min_price < calculatedMinPrice) {
              logger.info('SPP Buffer: Adjusting min_price', {
                productId: product.product_id,
                oldMinPrice: product.min_price,
                newMinPrice: calculatedMinPrice,
                targetBuyerPrice,
                sppBufferPercent,
              });

              try {
                await sql`
                UPDATE products 
                SET min_price = ${calculatedMinPrice}, updated_at = NOW() 
                WHERE id = ${product.id}
              `;
                product.min_price = calculatedMinPrice;
              } catch (e) {
                logger.warn('Failed to auto-adjust min_price', { productId: product.id, error: e });
                summary.errors.push(`SPP Buffer error for ${product.product_id}: ${String(e)}`);
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
            const erosionThreat = scan.threats.find(
              (t: Threat) =>
                t.type === ThreatType.OZON_CARD_EROSION || t.type === ThreatType.MARGIN_BELOW_ZERO
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
              // Log threat even if no action taken (Aura/Monitor mode)
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
              } catch (e) {
                logger.warn('Failed to log monitor threat', { productId: product.id, error: e });
              }

              if (
                erosionThreat &&
                user.protection_enabled &&
                erosionThreat.severity === 'critical'
              ) {
                await this.alertSender.sendThreatAlert(user, product, erosionThreat, marketplace);
              }
            }
          }

          // 4. Update Price in DB
          const priceDiff = Math.abs(livePrice - product.current_price);
          const isSignificantChange = priceDiff / product.current_price > 0.01;

          if (isSignificantChange || product.current_price === 0) {
            try {
              await sql`UPDATE products SET current_price = ${livePrice}, updated_at = NOW() WHERE id = ${product.id}`;
            } catch (e) {
              logger.warn('Failed to update price in DB', { productId: product.id, error: e });
              summary.errors.push(`DB Update failed for ${product.product_id}`);
            }
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
      second: '2-digit',
      timeZone: 'Europe/Moscow',
    });
    const wbScanned = result.productsScanned?.wb || 0;
    const ozonScanned = result.productsScanned?.ozon || 0;
    const totalScanned = wbScanned + ozonScanned;

    let statusEmoji = '🟢',
      statusText = 'Система штатно';
    if (hasErrors) {
      statusEmoji = '🛑';
      statusText = 'Есть ошибки';
    } else if (hasActions) {
      statusEmoji = '⚔️';
      statusText = 'Защита сработала!';
    }

    // Detailed error formatting
    let errorDetails = '';
    if (hasErrors) {
      errorDetails =
        `\n📋 Детали ошибок:\n` +
        result.errors
          .slice(0, 5)
          .map(e => `• ${e}`)
          .join('\n');
      if (result.errors.length > 5) {
        errorDetails += `\n...и еще ${result.errors.length - 5} ошибок`;
      }
    }

    const message = [
      `🎩 ИТОГИ ЦИКЛА`,
      `⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} ${statusText}`,
      ``,
      `👥 Магазинов: ${result.usersProcessed}`,
      `📦 Проверено: ${totalScanned} (WB: ${wbScanned}, Ozon: ${ozonScanned})`,
      `⚠️ Угроз: ${result.threatsDetected}`,
      hasActions ? `⚔️ Отражено: ${result.actionsTaken}` : '',
      hasErrors ? `❌ Ошибок: ${result.errors.length}` : '',
      errorDetails,
      ``,
      `💡 Следующая проверка через 30 минут`,
    ]
      .filter(Boolean)
      .join('\n');

    await this.alertSender.sendAdminSummary(message);
  }
}

export const sentinelOrchestrator = new SentinelOrchestrator();
