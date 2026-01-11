import { sql } from '../api-lib/services/database.js';
import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import { SentinelPriceMonitor } from './PriceMonitor.js';
import { ThreatDetector, ThreatType } from './ThreatDetector.js';
import { SentinelDefenseExecutor } from './DefenseExecutor.js';
import { SentinelReportGenerator } from './ReportGenerator.js';
import { SentinelAlertSender } from './AlertSender.js';
import type { SentinelRunResult, UserCycleResult } from './types.js';
import { priceShield, type PriceRule } from '../api-lib/services/price-shield.js';
import { getCompetitorPrice } from '../api-lib/services/competitor-monitor.js';

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

          const report = this.reportGenerator.generateUserReport(user, userResult);
          if (report) {
            await this.alertSender.sendReport(user, report);
          }
        } catch (err) {
          const errorMsg = `Error processing user ${user.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      await this.sendCycleSummary(result);
    } catch (err) {
      result.errors.push(`Critical cycle error: ${err}`);
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
    const productsRes = await sql`
      SELECT * FROM products 
      WHERE user_id = ${user.id} 
      AND (is_monitored = true OR min_price > 0)
    `;
    const products = productsRes.rows as DBProduct[];

    if (products.length === 0) return;

    // 1. Fetch Prices
    const prices = await this.priceMonitor.fetchAll(user, products);

    // Accumulate stats / errors
    summary.errors.push(...prices.errors);
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
    for (const product of products) {
      const marketplace = product.marketplace as 'WB' | 'Ozon';
      const key =
        marketplace === 'WB'
          ? Number(product.nm_id)
          : parseInt(product.product_id.replace('ozon-', ''));

      const priceMap = marketplace === 'WB' ? prices.wb : prices.ozon;
      const livePrice = priceMap.get(key);

      if (!livePrice) continue;

      // A. Smart Repricing
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
          console.error(`❌ PriceShield error for ${product.product_id}:`, e);
        }
      }

      // B. Threat Detection
      const scan = this.threatDetector.scanProductThreats(product, livePrice, marketplace);

      if (scan.hasThreats) {
        summary.threatsDetected += scan.threats.length;
        if (userResult) userResult.threatsDetected += scan.threats.length;

        const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);
        const erosionThreat = scan.threats.find(
          t => t.type === ThreatType.OZON_CARD_EROSION || t.type === ThreatType.MARGIN_BELOW_ZERO
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
        } else if (
          erosionThreat &&
          user.protection_enabled &&
          erosionThreat.severity === 'critical'
        ) {
          await this.alertSender.sendThreatAlert(user, product, erosionThreat, marketplace);
          // Also log action (notify) - We might want to move this to AlertSender or DefenseExecutor logic?
          // Keeping it implicit or just acknowledging we sent an alert.
          // Original code calls logSentinelAction here.
          // Let's assume sending the alert IS the action.
        }
      }

      // Update current price in database
      await sql`UPDATE products SET current_price = ${livePrice}, updated_at = NOW() WHERE id = ${product.id}`;
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

    await this.alertSender.sendAdminSummary(message);
  }
}

export const sentinelOrchestrator = new SentinelOrchestrator();
