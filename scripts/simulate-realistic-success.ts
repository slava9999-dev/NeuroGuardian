/**
 * Realistic Real-Time System Success Simulator
 *
 * Симулирует РЕАЛЬНЫЕ сценарии работы NeuroGUARDIAN
 * с корректными финансовыми расчётами
 */

interface RealisticConfig {
  durationDays: number;
  productsCount: number;
  avgRevenuePerProduct: number; // Средняя выручка на товар в месяц
  avgMarginPercent: number; // Средняя маржа (%)
  threatProbabilityPerDay: number; // Вероятность угрозы в день (0-1)
  apiReliability: number; // Надёжность API (0-1)
  iterations: number;
}

interface SimResult {
  threatsDetected: number;
  threatsBlocked: number;
  threatsMissed: number;
  avgSavedPerThreat: number;
  totalSaved: number;
  totalLost: number;
  systemCost: number;
  netBenefit: number;
  roi: number;
  detectionRate: number;
  blockRate: number;
  uptime: number;
  successProbability: number;
}

class RealisticSimulator {
  private config: RealisticConfig;

  constructor(config: RealisticConfig) {
    this.config = config;
  }

  async run(): Promise<SimResult> {
    console.log('🚀 Realistic System Simulation\n');
    console.log(`Configuration:`);
    console.log(`  Duration: ${this.config.durationDays} days`);
    console.log(`  Products: ${this.config.productsCount}`);
    console.log(`  Avg Revenue/Product: ${this.config.avgRevenuePerProduct.toLocaleString()}₽/мес`);
    console.log(`  Avg Margin: ${this.config.avgMarginPercent}%`);
    console.log(
      `  Threat Probability: ${(this.config.threatProbabilityPerDay * 100).toFixed(1)}%/день`
    );
    console.log(`  Iterations: ${this.config.iterations}\n`);

    const results: SimResult[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      if (i % 100 === 0 && i > 0) {
        console.log(`Progress: ${i}/${this.config.iterations}...`);
      }
      results.push(this.runIteration());
    }

    return this.aggregate(results);
  }

  private runIteration(): SimResult {
    const {
      durationDays,
      productsCount,
      avgRevenuePerProduct,
      avgMarginPercent,
      threatProbabilityPerDay,
      apiReliability,
    } = this.config;

    let threatsDetected = 0;
    let threatsBlocked = 0;
    let threatsMissed = 0;
    let totalSaved = 0;
    let totalLost = 0;
    let uptimeDays = 0;

    // Симуляция каждого дня
    for (let day = 0; day < durationDays; day++) {
      const apiWorking = Math.random() < apiReliability;

      if (apiWorking) {
        uptimeDays++;
      }

      // Для каждого товара проверяем вероятность угрозы
      for (let p = 0; p < productsCount; p++) {
        const threatOccurred = Math.random() < threatProbabilityPerDay;

        if (threatOccurred) {
          // Угроза произошла
          const dailyRevenue = avgRevenuePerProduct / 30;
          const dailyMargin = dailyRevenue * (avgMarginPercent / 100);

          // Потенциальные потери: 50-100% дневной маржи
          const potentialLoss = dailyMargin * (0.5 + Math.random() * 0.5);

          if (apiWorking) {
            // API работает — Sentinel может обнаружить
            const detected = Math.random() < 0.95; // 95% вероятность обнаружения

            if (detected) {
              threatsDetected++;

              // Попытка блокировки
              const blocked = Math.random() < 0.93; // 93% успешность

              if (blocked) {
                threatsBlocked++;
                totalSaved += potentialLoss;
              } else {
                totalLost += potentialLoss;
              }
            } else {
              // Не обнаружили
              threatsMissed++;
              totalLost += potentialLoss;
            }
          } else {
            // API не работает — угроза пропущена
            threatsMissed++;
            totalLost += potentialLoss;
          }
        }
      }
    }

    const systemCost = 990; // Подписка Pro
    const netBenefit = totalSaved - totalLost - systemCost;
    const roi = systemCost > 0 ? (netBenefit / systemCost) * 100 : 0;

    const totalThreats = threatsDetected + threatsMissed;
    const detectionRate = totalThreats > 0 ? (threatsDetected / totalThreats) * 100 : 100;
    const blockRate = threatsDetected > 0 ? (threatsBlocked / threatsDetected) * 100 : 0;
    const uptime = (uptimeDays / durationDays) * 100;

    const avgSavedPerThreat = threatsBlocked > 0 ? totalSaved / threatsBlocked : 0;

    // Вероятность успеха (взвешенная формула)
    const successProbability =
      Math.min(detectionRate, 100) * 0.3 +
      Math.min(blockRate, 100) * 0.4 +
      uptime * 0.2 +
      Math.min(Math.max(roi, 0) / 10, 10) * 0.1;

    return {
      threatsDetected,
      threatsBlocked,
      threatsMissed,
      avgSavedPerThreat,
      totalSaved,
      totalLost,
      systemCost,
      netBenefit,
      roi,
      detectionRate,
      blockRate,
      uptime,
      successProbability,
    };
  }

  private aggregate(results: SimResult[]): SimResult {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil(sorted.length * p) - 1;
      return sorted[Math.max(0, index)];
    };

    const avgResult: SimResult = {
      threatsDetected: Math.round(avg(results.map(r => r.threatsDetected))),
      threatsBlocked: Math.round(avg(results.map(r => r.threatsBlocked))),
      threatsMissed: Math.round(avg(results.map(r => r.threatsMissed))),
      avgSavedPerThreat: Math.round(avg(results.map(r => r.avgSavedPerThreat))),
      totalSaved: Math.round(avg(results.map(r => r.totalSaved))),
      totalLost: Math.round(avg(results.map(r => r.totalLost))),
      systemCost: 990,
      netBenefit: Math.round(avg(results.map(r => r.netBenefit))),
      roi: Math.round(avg(results.map(r => r.roi)) * 10) / 10,
      detectionRate: Math.round(avg(results.map(r => r.detectionRate)) * 10) / 10,
      blockRate: Math.round(avg(results.map(r => r.blockRate)) * 10) / 10,
      uptime: Math.round(avg(results.map(r => r.uptime)) * 10) / 10,
      successProbability: Math.round(avg(results.map(r => r.successProbability)) * 10) / 10,
    };

    const probArray = results.map(r => r.successProbability);
    const roiArray = results.map(r => r.roi);

    console.log('\n📊 SIMULATION RESULTS\n');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Threats Analysis (${this.config.durationDays} days):`);
    console.log(`  Total Threats: ${avgResult.threatsDetected + avgResult.threatsMissed}`);
    console.log(`  Detected: ${avgResult.threatsDetected} (${avgResult.detectionRate}%)`);
    console.log(`  Blocked: ${avgResult.threatsBlocked} (${avgResult.blockRate}%)`);
    console.log(`  Missed: ${avgResult.threatsMissed}\n`);

    console.log(`Financial Impact:`);
    console.log(`  Saved: ${avgResult.totalSaved.toLocaleString()}₽`);
    console.log(`  Lost: ${avgResult.totalLost.toLocaleString()}₽`);
    console.log(`  System Cost: ${avgResult.systemCost.toLocaleString()}₽`);
    console.log(`  Net Benefit: ${avgResult.netBenefit.toLocaleString()}₽`);
    console.log(`  Avg Saved/Threat: ${avgResult.avgSavedPerThreat.toLocaleString()}₽\n`);

    console.log(`ROI Analysis:`);
    console.log(`  Average: ${avgResult.roi}%`);
    console.log(`  P10 (pessimistic): ${Math.round(percentile(roiArray, 0.1) * 10) / 10}%`);
    console.log(`  P50 (median): ${Math.round(percentile(roiArray, 0.5) * 10) / 10}%`);
    console.log(`  P90 (optimistic): ${Math.round(percentile(roiArray, 0.9) * 10) / 10}%\n`);

    console.log(`System Reliability:`);
    console.log(`  Uptime: ${avgResult.uptime}%\n`);

    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`🎯 SUCCESS PROBABILITY: ${avgResult.successProbability}%\n`);
    console.log(`Confidence Intervals:`);
    console.log(`  P10: ${Math.round(percentile(probArray, 0.1) * 10) / 10}%`);
    console.log(`  P50: ${Math.round(percentile(probArray, 0.5) * 10) / 10}%`);
    console.log(`  P90: ${Math.round(percentile(probArray, 0.9) * 10) / 10}%\n`);

    // Интерпретация
    if (avgResult.successProbability >= 80) {
      console.log(`✅ EXCELLENT: Система высоконадёжна и прибыльна`);
    } else if (avgResult.successProbability >= 70) {
      console.log(`🟢 GOOD: Система работает хорошо`);
    } else if (avgResult.successProbability >= 60) {
      console.log(`🟡 MODERATE: Требуются улучшения`);
    } else {
      console.log(`🔴 POOR: Критические проблемы`);
    }

    if (avgResult.roi > 0) {
      console.log(
        `💰 Система окупается: каждый вложенный рубль приносит ${(avgResult.roi / 100 + 1).toFixed(2)}₽`
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
  const config: RealisticConfig = {
    durationDays: 30,
    productsCount: 50,
    avgRevenuePerProduct: 30000, // 30k₽/мес на товар
    avgMarginPercent: 20, // 20% маржа
    threatProbabilityPerDay: 0.05, // 5% вероятность угрозы в день
    apiReliability: 0.98, // 98% uptime
    iterations: 1000,
  };

  const simulator = new RealisticSimulator(config);
  await simulator.run();

  console.log('\n✅ Simulation completed!\n');
}

main().catch(console.error);
