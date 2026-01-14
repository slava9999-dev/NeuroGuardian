/**
 * Pessimistic (Conservative) System Simulator
 *
 * Максимально реалистичные параметры с учётом:
 * - Реальной частоты угроз
 * - Ложных срабатываний
 * - Упущенных продаж
 * - Задержек API
 * - Стоимости времени
 */

interface PessimisticConfig {
  durationDays: number;
  productsCount: number;
  avgRevenuePerProduct: number;
  avgMarginPercent: number;

  // Реалистичные параметры угроз
  realThreatProbability: number; // Реальная вероятность угрозы
  falseThreatProbability: number; // Ложные срабатывания

  // Реалистичная эффективность
  detectionRate: number; // С учётом блокировок API
  blockRate: number; // С учётом задержек

  // Побочные эффекты
  lostSalesDuringProtection: number; // Упущенные продажи при защите
  setupTimeCost: number; // Стоимость времени на настройку (₽)

  iterations: number;
}

interface PessimisticResult {
  // Угрозы
  realThreats: number;
  falsePositives: number;
  threatsDetected: number;
  threatsBlocked: number;
  threatsMissed: number;

  // Финансы
  savedFromThreats: number;
  lostToMissedThreats: number;
  lostToFalsePositives: number; // Упущенные продажи из-за ложных срабатываний
  setupCost: number;
  systemCost: number;

  totalSaved: number;
  totalLost: number;
  netBenefit: number;
  roi: number;

  // Метрики
  precision: number; // Точность (true positives / all positives)
  recall: number; // Полнота (detected / all threats)
  f1Score: number; // F1-мера
  successProbability: number;
}

class PessimisticSimulator {
  private config: PessimisticConfig;

  constructor(config: PessimisticConfig) {
    this.config = config;
  }

  async run(): Promise<PessimisticResult> {
    console.log('🔍 Pessimistic (Conservative) Simulation\n');
    console.log(`Configuration:`);
    console.log(`  Duration: ${this.config.durationDays} days`);
    console.log(`  Products: ${this.config.productsCount}`);
    console.log(
      `  Real Threat Probability: ${(this.config.realThreatProbability * 100).toFixed(2)}%/день`
    );
    console.log(
      `  False Positive Rate: ${(this.config.falseThreatProbability * 100).toFixed(2)}%/день`
    );
    console.log(`  Detection Rate: ${(this.config.detectionRate * 100).toFixed(1)}%`);
    console.log(`  Block Rate: ${(this.config.blockRate * 100).toFixed(1)}%`);
    console.log(`  Iterations: ${this.config.iterations}\n`);

    const results: PessimisticResult[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      if (i % 100 === 0 && i > 0) {
        console.log(`Progress: ${i}/${this.config.iterations}...`);
      }
      results.push(this.runIteration());
    }

    return this.aggregate(results);
  }

  private runIteration(): PessimisticResult {
    const {
      durationDays,
      productsCount,
      avgRevenuePerProduct,
      avgMarginPercent,
      realThreatProbability,
      falseThreatProbability,
      detectionRate,
      blockRate,
      lostSalesDuringProtection,
      setupTimeCost,
    } = this.config;

    let realThreats = 0;
    let falsePositives = 0;
    let threatsDetected = 0;
    let threatsBlocked = 0;
    let threatsMissed = 0;

    let savedFromThreats = 0;
    let lostToMissedThreats = 0;
    let lostToFalsePositives = 0;

    // Симуляция каждого дня
    for (let day = 0; day < durationDays; day++) {
      for (let p = 0; p < productsCount; p++) {
        const dailyRevenue = avgRevenuePerProduct / 30;
        const dailyMargin = dailyRevenue * (avgMarginPercent / 100);

        // 1. Реальная угроза
        const realThreatOccurred = Math.random() < realThreatProbability;

        if (realThreatOccurred) {
          realThreats++;

          // Потенциальные потери: 10-30% дневной маржи (обнаруживаем быстрее)
          const potentialLoss = dailyMargin * (0.1 + Math.random() * 0.2);

          const detected = Math.random() < detectionRate;

          if (detected) {
            threatsDetected++;

            const blocked = Math.random() < blockRate;

            if (blocked) {
              threatsBlocked++;
              savedFromThreats += potentialLoss;

              // Побочный эффект: упущенные продажи во время защиты
              lostToFalsePositives += dailyMargin * lostSalesDuringProtection * 0.5;
            } else {
              // Обнаружили, но не успели заблокировать
              lostToMissedThreats += potentialLoss;
            }
          } else {
            // Не обнаружили
            threatsMissed++;
            lostToMissedThreats += potentialLoss;
          }
        }

        // 2. Ложное срабатывание (нет угрозы, но система думает что есть)
        const falsePositiveOccurred = Math.random() < falseThreatProbability;

        if (falsePositiveOccurred && !realThreatOccurred) {
          falsePositives++;

          // Упущенные продажи: обнулили остаток, но угрозы не было
          const lostSales = dailyMargin * lostSalesDuringProtection;
          lostToFalsePositives += lostSales;
        }
      }
    }

    const systemCost = 990;
    const setupCost = setupTimeCost;

    const totalSaved = savedFromThreats;
    const totalLost = lostToMissedThreats + lostToFalsePositives + setupCost;
    const netBenefit = totalSaved - totalLost - systemCost;
    const roi = systemCost > 0 ? (netBenefit / systemCost) * 100 : 0;

    // Метрики качества
    const truePositives = threatsBlocked;
    const allPositives = threatsDetected + falsePositives;
    const allThreats = realThreats;

    const precision = allPositives > 0 ? (truePositives / allPositives) * 100 : 0;
    const recall = allThreats > 0 ? (threatsDetected / allThreats) * 100 : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Вероятность успеха (с учётом precision/recall)
    const successProbability =
      f1Score * 0.4 + // 40% — качество детекции
      Math.min(Math.max(roi, 0) / 5, 20) * 0.3 + // 30% — ROI (макс 20 баллов)
      Math.min((netBenefit / 1000) * 10, 30) * 0.3; // 30% — абсолютная выгода

    return {
      realThreats,
      falsePositives,
      threatsDetected,
      threatsBlocked,
      threatsMissed,
      savedFromThreats,
      lostToMissedThreats,
      lostToFalsePositives,
      setupCost,
      systemCost,
      totalSaved,
      totalLost,
      netBenefit,
      roi,
      precision,
      recall,
      f1Score,
      successProbability,
    };
  }

  private aggregate(results: PessimisticResult[]): PessimisticResult {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil(sorted.length * p) - 1;
      return sorted[Math.max(0, index)];
    };

    const avgResult: PessimisticResult = {
      realThreats: Math.round(avg(results.map(r => r.realThreats))),
      falsePositives: Math.round(avg(results.map(r => r.falsePositives))),
      threatsDetected: Math.round(avg(results.map(r => r.threatsDetected))),
      threatsBlocked: Math.round(avg(results.map(r => r.threatsBlocked))),
      threatsMissed: Math.round(avg(results.map(r => r.threatsMissed))),
      savedFromThreats: Math.round(avg(results.map(r => r.savedFromThreats))),
      lostToMissedThreats: Math.round(avg(results.map(r => r.lostToMissedThreats))),
      lostToFalsePositives: Math.round(avg(results.map(r => r.lostToFalsePositives))),
      setupCost: Math.round(avg(results.map(r => r.setupCost))),
      systemCost: 990,
      totalSaved: Math.round(avg(results.map(r => r.totalSaved))),
      totalLost: Math.round(avg(results.map(r => r.totalLost))),
      netBenefit: Math.round(avg(results.map(r => r.netBenefit))),
      roi: Math.round(avg(results.map(r => r.roi)) * 10) / 10,
      precision: Math.round(avg(results.map(r => r.precision)) * 10) / 10,
      recall: Math.round(avg(results.map(r => r.recall)) * 10) / 10,
      f1Score: Math.round(avg(results.map(r => r.f1Score)) * 10) / 10,
      successProbability: Math.round(avg(results.map(r => r.successProbability)) * 10) / 10,
    };

    const probArray = results.map(r => r.successProbability);
    const roiArray = results.map(r => r.roi);

    console.log('\n📊 PESSIMISTIC SIMULATION RESULTS\n');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Threats Analysis (${this.config.durationDays} days):`);
    console.log(`  Real Threats: ${avgResult.realThreats}`);
    console.log(`  False Positives: ${avgResult.falsePositives}`);
    console.log(`  Detected: ${avgResult.threatsDetected} (Recall: ${avgResult.recall}%)`);
    console.log(`  Blocked: ${avgResult.threatsBlocked} (Precision: ${avgResult.precision}%)`);
    console.log(`  Missed: ${avgResult.threatsMissed}`);
    console.log(`  F1-Score: ${avgResult.f1Score}%\n`);

    console.log(`Financial Impact:`);
    console.log(`  Saved from Threats: ${avgResult.savedFromThreats.toLocaleString()}₽`);
    console.log(`  Lost to Missed Threats: ${avgResult.lostToMissedThreats.toLocaleString()}₽`);
    console.log(`  Lost to False Positives: ${avgResult.lostToFalsePositives.toLocaleString()}₽`);
    console.log(`  Setup Cost: ${avgResult.setupCost.toLocaleString()}₽`);
    console.log(`  System Cost: ${avgResult.systemCost.toLocaleString()}₽`);
    console.log(`  ─────────────────────────`);
    console.log(`  Total Saved: ${avgResult.totalSaved.toLocaleString()}₽`);
    console.log(`  Total Lost: ${avgResult.totalLost.toLocaleString()}₽`);
    console.log(`  Net Benefit: ${avgResult.netBenefit.toLocaleString()}₽\n`);

    console.log(`ROI Analysis:`);
    console.log(`  Average: ${avgResult.roi}%`);
    console.log(`  P10 (pessimistic): ${Math.round(percentile(roiArray, 0.1) * 10) / 10}%`);
    console.log(`  P50 (median): ${Math.round(percentile(roiArray, 0.5) * 10) / 10}%`);
    console.log(`  P90 (optimistic): ${Math.round(percentile(roiArray, 0.9) * 10) / 10}%\n`);

    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`🎯 SUCCESS PROBABILITY: ${avgResult.successProbability}%\n`);
    console.log(`Confidence Intervals:`);
    console.log(`  P10: ${Math.round(percentile(probArray, 0.1) * 10) / 10}%`);
    console.log(`  P50: ${Math.round(percentile(probArray, 0.5) * 10) / 10}%`);
    console.log(`  P90: ${Math.round(percentile(probArray, 0.9) * 10) / 10}%\n`);

    // Интерпретация
    if (avgResult.successProbability >= 70) {
      console.log(`✅ GOOD: Система работает даже в пессимистичном сценарии`);
    } else if (avgResult.successProbability >= 50) {
      console.log(`🟡 MODERATE: Система окупается, но требует оптимизации`);
    } else if (avgResult.successProbability >= 30) {
      console.log(`🟠 MARGINAL: Система на грани окупаемости`);
    } else {
      console.log(`🔴 POOR: Система не окупается в пессимистичном сценарии`);
    }

    if (avgResult.netBenefit > 0) {
      console.log(`💰 Чистая выгода: ${avgResult.netBenefit.toLocaleString()}₽/мес`);
      console.log(
        `📅 Окупаемость: ${Math.ceil(avgResult.systemCost / avgResult.netBenefit)} месяцев`
      );
    } else {
      console.log(`⚠️ Система не окупается при текущих параметрах`);
    }

    return avgResult;
  }
}

// ============================================
// ЗАПУСК
// ============================================

async function main() {
  const config: PessimisticConfig = {
    durationDays: 30,
    productsCount: 50,
    avgRevenuePerProduct: 30000,
    avgMarginPercent: 20,

    // Консервативные параметры
    realThreatProbability: 0.015, // 1.5%/день (реалистично)
    falseThreatProbability: 0.005, // 0.5%/день (ложные срабатывания)

    detectionRate: 0.8, // 80% (с учётом блокировок API)
    blockRate: 0.75, // 75% (с учётом задержек)

    lostSalesDuringProtection: 0.15, // 15% упущенных продаж при защите
    setupTimeCost: 3000, // 3000₽ (2 часа × 1500₽/час)

    iterations: 1000,
  };

  const simulator = new PessimisticSimulator(config);
  await simulator.run();

  console.log('\n✅ Pessimistic simulation completed!\n');
}

main().catch(console.error);
