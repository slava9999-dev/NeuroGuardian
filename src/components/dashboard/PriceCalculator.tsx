// ============================================
// NeuroGUARDIAN — Price Calculator Component
// Automatic minimum price calculation
// Version: 2.1.0 (Portal Fixed)
// ============================================

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Import constants and logic from shared service
import {
  OZON_CARD_CONFIG,
  calculateUnitEconomics,
  type UnitEconomicsInput,
} from '../../api-lib/services/unit-economics';

interface PriceCalculatorProps {
  marketplace: 'WB' | 'Ozon';
  onCalculated: (minPrice: number) => void;
  onClose: () => void;
}

export function PriceCalculator({ marketplace, onCalculated, onClose }: PriceCalculatorProps) {
  // State
  const [costPrice, setCostPrice] = useState<string>('');
  const [laborHours, setLaborHours] = useState<string>('');
  const [laborRate, setLaborRate] = useState<string>('200');
  const [logistics, setLogistics] = useState<string>(marketplace === 'Ozon' ? '80' : '50'); // Default FBS
  const [packaging, setPackaging] = useState<string>('15');
  const [adCost, setAdCost] = useState<string>('');
  const [targetMargin, setTargetMargin] = useState<string>('20');
  const [useOzonCard, setUseOzonCard] = useState<boolean>(true); // Default ON for Ozon
  const [category] = useState<string>('default'); // Simplified category selection

  // Calculate using the shared service logic
  const calculationResult = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
    const log = parseFloat(logistics) || 0;
    const pack = parseFloat(packaging) || 0;
    const ad = parseFloat(adCost) || 0;

    // Total 'Cost Price' input for the calculator
    const totalGoodsCost = cost + labor + ad;

    const input: UnitEconomicsInput = {
      price: 0, // Not used for 'recommendedMinPrice' calc
      costPrice: totalGoodsCost,
      marketplace,
      fulfillmentType: 'fbs',
      packagingCost: pack,
      targetMarginPercent: parseFloat(targetMargin) || 20,
      useOzonCard: marketplace === 'Ozon' && useOzonCard,
      category,
    };

    // We rely on the service's logic to get rates
    const stats = calculateUnitEconomics({ ...input, price: 1000 }); // dummy price

    // Fixed Costs from User Inputs:
    const fixedCosts = totalGoodsCost + log + pack;

    // Variable Rates from Service & Logic:
    const variableRate =
      stats.commissionRate +
      stats.acquiring / 1000 +
      (marketplace === 'Ozon' && useOzonCard
        ? OZON_CARD_CONFIG.discountPercent * OZON_CARD_CONFIG.adoptionRate
        : 0);

    const bankCommission = 0.01; // ~1% withdrawal
    const totalVariableRate = variableRate + bankCommission;

    if (totalVariableRate >= 1)
      return {
        price: 0,
        rates: { commission: 0, ozonCard: 0, acquiring: 0, variableTotal: 0 },
        breakdown: { goods: 0, logistics: 0, packaging: 0, margin: 0 },
      };

    const minPrice = fixedCosts / (1 - totalVariableRate);

    return {
      price: Math.ceil(minPrice / 10) * 10,
      rates: {
        commission: stats.commissionRate * 100,
        ozonCard:
          marketplace === 'Ozon' && useOzonCard
            ? OZON_CARD_CONFIG.discountPercent * OZON_CARD_CONFIG.adoptionRate * 100
            : 0,
        acquiring: (stats.acquiring / 1000) * 100,
        variableTotal: totalVariableRate * 100,
      },
      breakdown: {
        goods: totalGoodsCost,
        logistics: log,
        packaging: pack,
        margin: minPrice * (parseFloat(targetMargin) / 100),
      },
    };
  }, [
    costPrice,
    laborHours,
    laborRate,
    logistics,
    packaging,
    adCost,
    targetMargin,
    marketplace,
    useOzonCard,
    category,
  ]);

  const handleApply = () => {
    onCalculated(calculationResult.price);
    onClose();
  };

  // Use Portal to escape parent transforms
  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-10 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-800 sticky top-0 bg-[#1c1c1e]/95 backdrop-blur z-20">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🧮 Калькулятор
                <span
                  className={`px-2 py-0.5 rounded text-xs ${marketplace === 'WB' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}
                >
                  {marketplace}
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Расчет минимальной цены для маржи {targetMargin}%
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* 1. Основные расходы */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-stone-300 uppercase tracking-wider">
                📦 Расходы на товар
              </h3>

              <div>
                <label className="block text-sm text-stone-400 mb-2">
                  Закупка товара <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="2000"
                    autoFocus
                    className="w-full bg-stone-800 text-white rounded-lg pl-4 pr-10 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-lg font-medium"
                  />
                  <span className="absolute right-4 top-3.5 text-stone-500">₽</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Упаковка</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={packaging}
                      onChange={e => setPackaging(e.target.value)}
                      className="w-full bg-stone-800 text-white rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="absolute right-3 top-2 text-stone-500 text-sm">₽</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Логистика (ср.)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={logistics}
                      onChange={e => setLogistics(e.target.value)}
                      className="w-full bg-stone-800 text-white rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="absolute right-3 top-2 text-stone-500 text-sm">₽</span>
                  </div>
                </div>
              </div>

              {/* Доп. расходы (скрытые) */}
              <div className="bg-stone-800/30 rounded-lg p-3">
                <button
                  onClick={() => setAdCost(adCost ? '' : '200')}
                  className="flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors w-full"
                >
                  <span>{adCost ? '🔽' : '▶️'} Дополнительные расходы (работа, реклама)</span>
                </button>

                {adCost !== '' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-3 grid grid-cols-2 gap-4 pt-2 border-t border-stone-700/50"
                  >
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Реклама (на 1 шт)</label>
                      <input
                        type="number"
                        value={adCost}
                        onChange={e => setAdCost(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Работа (сборка)</label>
                      <div className="flex gap-2">
                        <input
                          placeholder="Часов"
                          type="number"
                          value={laborHours}
                          onChange={e => setLaborHours(e.target.value)}
                          className="w-1/2 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-sm text-white"
                        />
                        <input
                          placeholder="₽/час"
                          type="number"
                          value={laborRate}
                          onChange={e => setLaborRate(e.target.value)}
                          className="w-1/2 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-sm text-white"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </section>

            {/* 2. Маркетплейс */}
            <section className="space-y-4 pt-4 border-t border-stone-800">
              <h3 className="text-sm font-medium text-stone-300 uppercase tracking-wider">
                🏷️ Комиссии и Маржа
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Целевая маржа</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={targetMargin}
                      onChange={e => setTargetMargin(e.target.value)}
                      className="w-full bg-stone-800 text-white rounded-lg pl-4 pr-8 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="absolute right-3 top-2 text-stone-500">%</span>
                  </div>
                </div>

                <div className="flex items-end pb-2">
                  {marketplace === 'Ozon' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${useOzonCard ? 'bg-blue-500' : 'bg-stone-700'}`}
                        onClick={() => setUseOzonCard(!useOzonCard)}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${useOzonCard ? 'translate-x-4' : ''}`}
                        />
                      </div>
                      <span className="text-sm text-stone-300">Ozon Card</span>
                    </label>
                  )}
                </div>
              </div>

              {marketplace === 'Ozon' && useOzonCard && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-xs text-blue-300">
                  ℹ️ Учтена скрытая комиссия Ozon Card: <strong>~2%</strong> от выручки (5% скидка ×
                  40% покупателей)
                </div>
              )}
            </section>

            {/* ИТОГ */}
            <motion.div layout className="bg-stone-800/60 rounded-xl p-5 border border-stone-700">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-400">
                  <span>Расходы (товары + лог):</span>
                  <span>
                    {Math.round(
                      calculationResult.breakdown.goods +
                        calculationResult.breakdown.logistics +
                        calculationResult.breakdown.packaging
                    ).toLocaleString()}{' '}
                    ₽
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>
                    Комиссии ({calculationResult.rates.variableTotal.toFixed(1)}%):
                    <span className="block text-[10px] opacity-60">
                      Комиссия {calculationResult.rates.commission.toFixed(0)}% + Эквайринг{' '}
                      {calculationResult.rates.acquiring.toFixed(1)}% +
                      {marketplace === 'Ozon'
                        ? `Card ${calculationResult.rates.ozonCard.toFixed(1)}%`
                        : 'Банк 1%'}
                    </span>
                  </span>
                  <span className="text-amber-400">
                    ~
                    {Math.round(
                      calculationResult.price * (calculationResult.rates.variableTotal / 100)
                    ).toLocaleString()}{' '}
                    ₽
                  </span>
                </div>
                <div className="flex justify-between text-stone-400 pt-2 border-t border-stone-700/50">
                  <span>Желаемая прибыль:</span>
                  <span className="text-emerald-400">
                    ~
                    {Math.round(
                      calculationResult.price * (parseFloat(targetMargin) / 100 || 0)
                    ).toLocaleString()}{' '}
                    ₽
                  </span>
                </div>
              </div>

              <div className="border-t border-stone-600 pt-4 mt-3">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="block text-sm text-stone-400 mb-1">Рекомендуемая цена:</span>
                    <div className="text-3xl font-bold text-white tracking-tight">
                      {calculationResult.price > 0
                        ? calculationResult.price.toLocaleString()
                        : '---'}{' '}
                      <span className="text-lg text-stone-500">₽</span>
                    </div>
                  </div>
                  <button
                    onClick={handleApply}
                    disabled={!costPrice || calculationResult.price <= 0}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 disabled:text-stone-500 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
