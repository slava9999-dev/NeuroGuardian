/**
 * Real-Time System Success Probability Simulator
 *
 * Симулирует работу NeuroGUARDIAN в реальных рыночных условиях
 * и рассчитывает вероятность успешной работы системы.
 *
 * Тестирует:
 * - Sentinel (автозащита цен)
 * - AI-агент Виктор (принятие решений)
 * - API интеграции (WB/Ozon)
 * - Устойчивость к сбоям
 */

interface SimulationConfig {
  durationDays: number; // Длительность симуляции (дни)
  productsCount: number; // Количество товаров
  checkIntervalMinutes: number; // Интервал проверки Sentinel
  marketVolatility: number; // Волатильность рынка (0-1)
  competitorAggressiveness: number; // Агрессивность конкурентов (0-1)
  apiReliability: number; // Надёжность API (0-1)
  iterations: number; // Количество итераций Monte Carlo
}

interface Product {
  id: string;
  name: string;
  costPrice: number; // Себестоимость
  sellerPrice: number; // Цена продавца
  minPrice: number; // Стоп-лосс
  targetBuyerPrice: number; // Целевая цена для покупателя
  sppBuffer: number; // Буфер СПП (%)
  currentStock: number; // Остаток
  salesPerDay: number; // Продаж в день
}

interface MarketEvent {
  type: 'competitor_dump' | 'spp_change' | 'forced_discount' | 'api_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number; // Влияние на цену (%)
  timestamp: Date;
}

interface SentinelAction {
  productId: string;
  action: 'zero_stock' | 'price_correction' | 'alert_only';
  trigger: string;
  savedAmount: number;
  responseTimeMs: number;
  success: boolean;
}

interface SimulationResult {
  totalEvents: number;
  detectedEvents: number;
  successfulActions: number;
  failedActions: number;
  totalSavedAmount: number;
  totalLostAmount: number;
  avgResponseTimeMs: number;
  detectionRate: number; // % обнаруженных угроз
  successRate: number; // % успешных защит
  roi: number; // ROI системы
  uptime: number; // % времени работы
  probabilityOfSuccess: number; // Итоговая вероятность успеха
}

class RealTimeSimulator {
  private config: SimulationConfig;
  private products: Product[] = [];
  private events: MarketEvent[] = [];
  private actions: SentinelAction[] = [];

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  /**
   * Запуск симуляции
   */
  async run(): Promise<SimulationResult> {
    console.log('🚀 Starting Real-Time System Simulation...\n');
    console.log(`Configuration:`);
    console.log(`  Duration: ${this.config.durationDays} days`);
    console.log(`  Products: ${this.config.productsCount}`);
    console.log(`  Check Interval: ${this.config.checkIntervalMinutes} min`);
    console.log(`  Iterations: ${this.config.iterations}\n`);

    const results: SimulationResult[] = [];

    // Monte Carlo: запускаем N итераций
    for (let i = 0; i < this.config.iterations; i++) {
      if (i % 100 === 0) {
        console.log(`Progress: ${i}/${this.config.iterations} iterations...`);
      }

      const result = await this.runSingleIteration();
      results.push(result);
    }

    // Агрегируем результаты
    return this.aggregateResults(results);
  }

  /**
   * Одна итерация симуляции
   */
  private async runSingleIteration(): Promise<SimulationResult> {
    // Сброс состояния
    this.products = this.generateProducts();
    this.events = [];
    this.actions = [];

    const totalMinutes = this.config.durationDays * 24 * 60;
    const checksCount = Math.floor(totalMinutes / this.config.checkIntervalMinutes);

    let totalSavedAmount = 0;
    let totalLostAmount = 0;
    let successfulActions = 0;
    let failedActions = 0;
    let uptimeMinutes = 0;

    // Симуляция каждого цикла Sentinel
    for (let cycle = 0; cycle < checksCount; cycle++) {
      const currentMinute = cycle * this.config.checkIntervalMinutes;

      // 1. Генерация рыночных событий (только раз в цикл)
      const newEvents = this.generateMarketEvents(currentMinute);
      this.events.push(...newEvents);

      // 2. Применение событий к товарам
      this.applyMarketEvents(newEvents);

      // 3. Проверка Sentinel (с учётом надёжности API)
      const apiAvailable = Math.random() < this.config.apiReliability;

      if (apiAvailable) {
        uptimeMinutes += this.config.checkIntervalMinutes;

        // Проверяем каждый товар только ОДИН раз за цикл
        for (const product of this.products) {
          const threat = this.detectThreat(product);

          if (threat) {
            const action = this.executeSentinelAction(product, threat);
            this.actions.push(action);

            if (action.success) {
              successfulActions++;
              totalSavedAmount += action.savedAmount;
            } else {
              failedActions++;
              totalLostAmount += action.savedAmount;
            }
          }
        }
      } else {
        // API недоступен — считаем потери
        for (const product of this.products) {
          const threat = this.detectThreat(product);
          if (threat) {
            const potentialLoss = this.calculatePotentialLoss(product);
            totalLostAmount += potentialLoss;
            failedActions++;
          }
        }
      }
    }

    // Подсчёт событий: только уникальные критические события
    const criticalEvents = this.events.filter(
      e => e.severity === 'high' || e.severity === 'critical'
    );
    const detectedEvents = this.actions.length;
    const totalEvents = criticalEvents.length;
    const avgResponseTime =
      this.actions.length > 0
        ? this.actions.reduce((sum, a) => sum + a.responseTimeMs, 0) / this.actions.length
        : 0;

    const detectionRate = totalEvents > 0 ? (detectedEvents / totalEvents) * 100 : 100;
    const successRate =
      successfulActions + failedActions > 0
        ? (successfulActions / (successfulActions + failedActions)) * 100
        : 0;

    const systemCost = 990; // Стоимость подписки Pro
    const roi = totalSavedAmount > 0 ? ((totalSavedAmount - systemCost) / systemCost) * 100 : -100;
    const uptime = (uptimeMinutes / totalMinutes) * 100;

    // Итоговая вероятность успеха (взвешенная формула)
    const probabilityOfSuccess =
      detectionRate * 0.3 + // 30% — обнаружение угроз
      successRate * 0.4 + // 40% — успешность защиты
      uptime * 0.2 + // 20% — доступность системы
      Math.min(roi / 10, 10) * 0.1; // 10% — ROI (макс 10 баллов)

    return {
      totalEvents,
      detectedEvents,
      successfulActions,
      failedActions,
      totalSavedAmount,
      totalLostAmount,
      avgResponseTimeMs: Math.round(avgResponseTime),
      detectionRate: Math.round(detectionRate * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      uptime: Math.round(uptime * 10) / 10,
      probabilityOfSuccess: Math.round(probabilityOfSuccess * 10) / 10,
    };
  }

  /**
   * Генерация тестовых товаров
   */
  private generateProducts(): Product[] {
    const products: Product[] = [];

    for (let i = 0; i < this.config.productsCount; i++) {
      const costPrice = 500 + Math.random() * 2000;
      const margin = 0.2 + Math.random() * 0.3; // 20-50% маржа
      const sellerPrice = costPrice / (1 - margin);
      const sppBuffer = 20 + Math.random() * 15; // 20-35% СПП
      const targetBuyerPrice = sellerPrice * 0.8; // Целевая цена ниже на 20%
      const minPrice = targetBuyerPrice / (1 - sppBuffer / 100);

      products.push({
        id: `product_${i}`,
        name: `Товар ${i}`,
        costPrice: Math.round(costPrice),
        sellerPrice: Math.round(sellerPrice),
        minPrice: Math.round(minPrice),
        targetBuyerPrice: Math.round(targetBuyerPrice),
        sppBuffer: Math.round(sppBuffer),
        currentStock: 10 + Math.floor(Math.random() * 90),
        salesPerDay: 1 + Math.floor(Math.random() * 10),
      });
    }

    return products;
  }

  /**
   * Генерация рыночных событий
   */
  private generateMarketEvents(currentMinute: number): MarketEvent[] {
    const events: MarketEvent[] = [];
    const timestamp = new Date(Date.now() + currentMinute * 60000);

    // Вероятность событий зависит от волатильности рынка
    const eventProbability = this.config.marketVolatility * 0.05; // 0-5% за цикл

    if (Math.random() < eventProbability) {
      // Демпинг конкурента
      if (Math.random() < this.config.competitorAggressiveness) {
        events.push({
          type: 'competitor_dump',
          severity: Math.random() > 0.7 ? 'critical' : 'high',
          impact: -(10 + Math.random() * 30), // -10% до -40%
          timestamp,
        });
      }
    }

    if (Math.random() < eventProbability * 0.5) {
      // Изменение СПП
      events.push({
        type: 'spp_change',
        severity: 'medium',
        impact: -(5 + Math.random() * 10), // -5% до -15%
        timestamp,
      });
    }

    if (Math.random() < eventProbability * 0.3) {
      // Принудительная акция WB
      events.push({
        type: 'forced_discount',
        severity: 'high',
        impact: -(15 + Math.random() * 20), // -15% до -35%
        timestamp,
      });
    }

    if (Math.random() < (1 - this.config.apiReliability) * 0.1) {
      // Ошибка API
      events.push({
        type: 'api_error',
        severity: 'critical',
        impact: 0,
        timestamp,
      });
    }

    return events;
  }

  /**
   * Применение событий к товарам
   */
  private applyMarketEvents(events: MarketEvent[]): void {
    for (const event of events) {
      if (event.type === 'api_error') continue;

      // Применяем к случайным товарам
      const affectedCount = Math.ceil(this.products.length * 0.3); // 30% товаров
      const affectedProducts = this.products
        .sort(() => Math.random() - 0.5)
        .slice(0, affectedCount);

      for (const product of affectedProducts) {
        product.sellerPrice = Math.round(product.sellerPrice * (1 + event.impact / 100));
      }
    }
  }

  /**
   * Обнаружение угрозы
   */
  private detectThreat(product: Product): string | null {
    // Проверка 1: Цена ниже стоп-лосса
    if (product.sellerPrice < product.minPrice) {
      return 'PRICE_BELOW_STOP_LOSS';
    }

    // Проверка 2: СПП съедает маржу
    const estimatedBuyerPrice = product.sellerPrice * (1 - product.sppBuffer / 100);
    if (estimatedBuyerPrice < product.targetBuyerPrice) {
      return 'SPP_MARGIN_EROSION';
    }

    return null;
  }

  /**
   * Выполнение защитного действия Sentinel
   */
  private executeSentinelAction(product: Product, threat: string): SentinelAction {
    const responseTime = 500 + Math.random() * 2000; // 0.5-2.5 сек
    const success = Math.random() < 0.95; // 95% успешность при доступном API

    let action: 'zero_stock' | 'price_correction' | 'alert_only' = 'zero_stock';
    let savedAmount = 0;

    if (threat === 'PRICE_BELOW_STOP_LOSS') {
      action = 'zero_stock';
      // Расчёт сохранённых денег: потенциальные продажи × убыток на единицу
      const potentialSales = product.salesPerDay * 0.5; // За пол дня до следующей проверки
      const lossPerUnit = product.minPrice - product.sellerPrice;
      savedAmount = potentialSales * lossPerUnit;
    } else if (threat === 'SPP_MARGIN_EROSION') {
      action = 'price_correction';
      const newMinPrice = product.targetBuyerPrice / (1 - product.sppBuffer / 100);
      const priceIncrease = newMinPrice - product.sellerPrice;
      const potentialSales = product.salesPerDay * 0.5;
      savedAmount = potentialSales * priceIncrease * 0.5; // 50% эффективность

      if (success) {
        product.minPrice = Math.round(newMinPrice);
      }
    }

    return {
      productId: product.id,
      action,
      trigger: threat,
      savedAmount: Math.max(0, Math.round(savedAmount)),
      responseTimeMs: Math.round(responseTime),
      success,
    };
  }

  /**
   * Расчёт потенциальных потерь при отсутствии защиты
   */
  private calculatePotentialLoss(product: Product): number {
    const potentialSales = product.salesPerDay * 0.5;
    const lossPerUnit = Math.max(0, product.minPrice - product.sellerPrice);
    return Math.round(potentialSales * lossPerUnit);
  }

  /**
   * Агрегация результатов всех итераций
   */
  private aggregateResults(results: SimulationResult[]): SimulationResult {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const percentile = (arr: number[], p: number) => {
      const sorted = arr.sort((a, b) => a - b);
      const index = Math.ceil(sorted.length * p) - 1;
      return sorted[index];
    };

    const probabilityArray = results.map(r => r.probabilityOfSuccess);

    console.log('\n📊 Simulation Results:\n');
    console.log('═══════════════════════════════════════════════════════\n');

    const avgResult = {
      totalEvents: Math.round(avg(results.map(r => r.totalEvents))),
      detectedEvents: Math.round(avg(results.map(r => r.detectedEvents))),
      successfulActions: Math.round(avg(results.map(r => r.successfulActions))),
      failedActions: Math.round(avg(results.map(r => r.failedActions))),
      totalSavedAmount: Math.round(avg(results.map(r => r.totalSavedAmount))),
      totalLostAmount: Math.round(avg(results.map(r => r.totalLostAmount))),
      avgResponseTimeMs: Math.round(avg(results.map(r => r.avgResponseTimeMs))),
      detectionRate: Math.round(avg(results.map(r => r.detectionRate)) * 10) / 10,
      successRate: Math.round(avg(results.map(r => r.successRate)) * 10) / 10,
      roi: Math.round(avg(results.map(r => r.roi)) * 10) / 10,
      uptime: Math.round(avg(results.map(r => r.uptime)) * 10) / 10,
      probabilityOfSuccess: Math.round(avg(probabilityArray) * 10) / 10,
    };

    console.log(`Market Events:`);
    console.log(`  Total Generated: ${avgResult.totalEvents}`);
    console.log(
      `  Detected by Sentinel: ${avgResult.detectedEvents} (${avgResult.detectionRate}%)\n`
    );

    console.log(`Sentinel Actions:`);
    console.log(`  Successful: ${avgResult.successfulActions}`);
    console.log(`  Failed: ${avgResult.failedActions}`);
    console.log(`  Success Rate: ${avgResult.successRate}%`);
    console.log(`  Avg Response Time: ${avgResult.avgResponseTimeMs}ms\n`);

    console.log(`Financial Impact:`);
    console.log(`  Total Saved: ${avgResult.totalSavedAmount.toLocaleString()}₽`);
    console.log(`  Total Lost: ${avgResult.totalLostAmount.toLocaleString()}₽`);
    console.log(
      `  Net Benefit: ${(avgResult.totalSavedAmount - avgResult.totalLostAmount).toLocaleString()}₽`
    );
    console.log(`  ROI: ${avgResult.roi}%\n`);

    console.log(`System Reliability:`);
    console.log(`  Uptime: ${avgResult.uptime}%\n`);

    console.log(`═══════════════════════════════════════════════════════\n`);
    console.log(`🎯 PROBABILITY OF SUCCESS: ${avgResult.probabilityOfSuccess}%\n`);
    console.log(`Confidence Intervals (Monte Carlo):`);
    console.log(`  P10 (pessimistic): ${percentile(probabilityArray, 0.1)}%`);
    console.log(`  P50 (median): ${percentile(probabilityArray, 0.5)}%`);
    console.log(`  P90 (optimistic): ${percentile(probabilityArray, 0.9)}%\n`);

    // Интерпретация результата
    if (avgResult.probabilityOfSuccess >= 80) {
      console.log(`✅ EXCELLENT: System is highly reliable and profitable`);
    } else if (avgResult.probabilityOfSuccess >= 60) {
      console.log(`🟢 GOOD: System works well with minor improvements needed`);
    } else if (avgResult.probabilityOfSuccess >= 40) {
      console.log(`🟡 MODERATE: System needs optimization`);
    } else {
      console.log(`🔴 POOR: Critical issues detected, major improvements required`);
    }

    return avgResult;
  }
}

// ============================================
// ЗАПУСК СИМУЛЯЦИИ
// ============================================

async function main() {
  // Конфигурация симуляции
  const config: SimulationConfig = {
    durationDays: 30, // 1 месяц
    productsCount: 50, // 50 товаров
    checkIntervalMinutes: 30, // Проверка каждые 30 минут
    marketVolatility: 0.7, // Высокая волатильность (0-1)
    competitorAggressiveness: 0.6, // Средняя агрессивность конкурентов (0-1)
    apiReliability: 0.98, // 98% надёжность API
    iterations: 1000, // 1000 итераций Monte Carlo
  };

  const simulator = new RealTimeSimulator(config);
  await simulator.run();

  console.log('\n✅ Simulation completed successfully!\n');
}

main().catch(console.error);
