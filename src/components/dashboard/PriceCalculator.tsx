// ============================================
// NeuroGUARDIAN — Price Calculator Component
// Automatic minimum price calculation
// Version: 3.0.0 (Fullscreen Modal)
// ============================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';

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
  /** Initial cost price to pre-fill */
  initialCostPrice?: number;
}

export function PriceCalculator({
  marketplace,
  onCalculated,
  onClose,
  initialCostPrice,
}: PriceCalculatorProps) {
  // State
  const [costPrice, setCostPrice] = useState<string>(initialCostPrice?.toString() || '');
  const [laborHours, setLaborHours] = useState<string>('');
  const [laborRate, setLaborRate] = useState<string>('200');
  const [logistics, setLogistics] = useState<string>(marketplace === 'Ozon' ? '80' : '50');
  const [packaging, setPackaging] = useState<string>('15');
  const [adCost, setAdCost] = useState<string>('');
  const [targetMargin, setTargetMargin] = useState<string>('20');
  const [useOzonCard, setUseOzonCard] = useState<boolean>(true);
  const [category] = useState<string>('default');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Calculate using the shared service logic
  const calculationResult = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
    const log = parseFloat(logistics) || 0;
    const pack = parseFloat(packaging) || 0;
    const ad = parseFloat(adCost) || 0;
    const margin = parseFloat(targetMargin) || 20;

    // Total 'Cost Price' input for the calculator
    const totalGoodsCost = cost + labor + ad;

    const input: UnitEconomicsInput = {
      price: 0,
      costPrice: totalGoodsCost,
      marketplace,
      fulfillmentType: 'fbs',
      packagingCost: pack,
      targetMarginPercent: margin,
      useOzonCard: marketplace === 'Ozon' && useOzonCard,
      category,
    };

    // We rely on the service's logic to get rates
    const stats = calculateUnitEconomics({ ...input, price: 1000 });

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

    // Target Margin Rate
    const targetMarginRate = margin / 100;

    // Check if calculation is possible
    if (totalVariableRate + targetMarginRate >= 1) {
      return {
        price: 0,
        breakEvenPrice: 0,
        rates: { commission: 0, ozonCard: 0, acquiring: 0, variableTotal: 0 },
        breakdown: { goods: 0, logistics: 0, packaging: 0, margin: 0, profit: 0 },
        error: 'Слишком высокие комиссии или маржа',
      };
    }

    // Break-even Price (margin = 0)
    const breakEvenPrice = Math.ceil(fixedCosts / (1 - totalVariableRate));

    // Recommended Price (with target margin)
    // Formula: Price = FixedCosts / (1 - VariableRate - MarginRate)
    const minPrice = Math.ceil(fixedCosts / (1 - totalVariableRate - targetMarginRate));

    // Calculate expected profit at recommended price
    const expectedProfit = minPrice * targetMarginRate;

    return {
      price: Math.ceil(minPrice / 10) * 10, // Round up to nearest 10
      breakEvenPrice: Math.ceil(breakEvenPrice / 10) * 10,
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
        margin: margin,
        profit: Math.round(expectedProfit),
      },
      error: null,
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

  const handleApply = useCallback(() => {
    if (calculationResult.price > 0) {
      onCalculated(calculationResult.price);
      onClose();
    }
  }, [calculationResult.price, onCalculated, onClose]);

  // Swipe to close handler
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
    },
    [onClose]
  );

  // Modal content
  const modalContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key="calculator-modal"
        className="fixed inset-0 z-[9999] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Fullscreen Modal Container */}
        <motion.div
          className="relative flex flex-col w-full h-full max-h-[100dvh] bg-[#0c0c0e] z-10 overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
        >
          {/* Drag indicator */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-stone-600 rounded-full" />
          </div>

          {/* Header - Fixed */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-[#0c0c0e]/95 backdrop-blur-sm">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🧮 Калькулятор цены
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    marketplace === 'WB'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {marketplace}
                </span>
              </h2>
              <p className="text-sm text-stone-400 mt-0.5">
                Рассчитайте минимальную цену для маржи {targetMargin}%
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-all text-lg"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
            {/* 1. Cost Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                📦 Расходы на товар
              </h3>

              {/* Main cost input */}
              <div>
                <label className="block text-sm text-stone-400 mb-2">
                  Закупка товара <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="2000"
                    autoFocus
                    className="w-full bg-stone-800/80 text-white rounded-xl pl-4 pr-12 py-4 focus:ring-2 focus:ring-amber-500 outline-none text-xl font-semibold border border-stone-700 focus:border-amber-500"
                  />
                  <span className="absolute right-4 top-4 text-stone-500 text-lg">₽</span>
                </div>
              </div>

              {/* Grid: Packaging & Logistics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Упаковка</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={packaging}
                      onChange={e => setPackaging(e.target.value)}
                      className="w-full bg-stone-800/80 text-white rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-amber-500 outline-none border border-stone-700 focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-3 text-stone-500">₽</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Логистика</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={logistics}
                      onChange={e => setLogistics(e.target.value)}
                      className="w-full bg-stone-800/80 text-white rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-amber-500 outline-none border border-stone-700 focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-3 text-stone-500">₽</span>
                  </div>
                </div>
              </div>

              {/* Advanced settings collapsible */}
              <div className="bg-stone-800/30 rounded-xl overflow-hidden border border-stone-700/50">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm text-stone-400 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {showAdvanced ? '🔽' : '▶️'} Дополнительные расходы
                  </span>
                  <span className="text-xs text-stone-500">работа, реклама</span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 space-y-4 border-t border-stone-700/50"
                    >
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-stone-500 mb-1 block">
                            Реклама (на 1 шт)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={adCost}
                              onChange={e => setAdCost(e.target.value)}
                              placeholder="0"
                              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-stone-500 mb-1 block">
                            Работа (сборка)
                          </label>
                          <div className="flex gap-2">
                            <input
                              placeholder="Час"
                              type="number"
                              inputMode="numeric"
                              value={laborHours}
                              onChange={e => setLaborHours(e.target.value)}
                              className="w-1/2 bg-stone-900 border border-stone-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                            <input
                              placeholder="₽/ч"
                              type="number"
                              inputMode="numeric"
                              value={laborRate}
                              onChange={e => setLaborRate(e.target.value)}
                              className="w-1/2 bg-stone-900 border border-stone-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* 2. Margin & Settings Section */}
            <section className="space-y-4 pt-4 border-t border-stone-800">
              <h3 className="text-sm font-semibold text-stone-300 uppercase tracking-wider">
                🎯 Маржа и комиссии
              </h3>

              <div className="flex items-center gap-4">
                {/* Target Margin */}
                <div className="flex-1">
                  <label className="block text-sm text-stone-400 mb-2">Целевая маржа</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={targetMargin}
                      onChange={e => setTargetMargin(e.target.value)}
                      min="1"
                      max="80"
                      className="w-full bg-stone-800/80 text-white rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-amber-500 outline-none border border-stone-700 focus:border-amber-500 text-lg font-semibold"
                    />
                    <span className="absolute right-3 top-3 text-stone-500">%</span>
                  </div>
                </div>

                {/* Ozon Card Toggle */}
                {marketplace === 'Ozon' && (
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        className={`w-12 h-7 rounded-full p-1 transition-colors ${
                          useOzonCard ? 'bg-blue-500' : 'bg-stone-700'
                        }`}
                        onClick={() => setUseOzonCard(!useOzonCard)}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full shadow-md"
                          animate={{ x: useOzonCard ? 20 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </div>
                      <span className="text-sm text-stone-300">Ozon Card</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Ozon Card Info */}
              {marketplace === 'Ozon' && useOzonCard && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-300 flex items-start gap-2">
                  <span>ℹ️</span>
                  <span>
                    Скидка Ozon Card: <strong>~2%</strong> от выручки (5% скидка × 40% покупателей)
                  </span>
                </div>
              )}

              {/* Commission Info */}
              <div className="bg-stone-800/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Комиссия {marketplace}</span>
                  <span className="text-stone-300">
                    {calculationResult.rates.commission.toFixed(0)}%
                  </span>
                </div>
                {calculationResult.rates.ozonCard > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Ozon Card (ср.)</span>
                    <span className="text-blue-400">
                      {calculationResult.rates.ozonCard.toFixed(1)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Эквайринг</span>
                  <span className="text-stone-300">
                    {calculationResult.rates.acquiring.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-stone-700">
                  <span className="text-stone-300 font-medium">Всего переменных</span>
                  <span className="text-amber-400 font-semibold">
                    {calculationResult.rates.variableTotal.toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Result Section */}
            <section className="space-y-4 pt-4 border-t border-stone-800">
              <h3 className="text-sm font-semibold text-stone-300 uppercase tracking-wider">
                💰 Результат расчёта
              </h3>

              {calculationResult.error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                  ⚠️ {calculationResult.error}
                </div>
              ) : (
                <div className="bg-stone-800/60 rounded-xl p-5 border border-stone-700 space-y-4">
                  {/* Breakdown */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-stone-400">
                      <span>Себестоимость товара:</span>
                      <span>
                        {Math.round(calculationResult.breakdown.goods).toLocaleString()} ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-400">
                      <span>Логистика + упаковка:</span>
                      <span>
                        {Math.round(
                          calculationResult.breakdown.logistics +
                            calculationResult.breakdown.packaging
                        ).toLocaleString()}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-400">
                      <span>Комиссии (~{calculationResult.rates.variableTotal.toFixed(0)}%):</span>
                      <span className="text-amber-400">
                        ~
                        {Math.round(
                          calculationResult.price * (calculationResult.rates.variableTotal / 100)
                        ).toLocaleString()}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-400 pt-2 border-t border-stone-700/50">
                      <span>Ваша прибыль ({calculationResult.breakdown.margin}%):</span>
                      <span className="text-emerald-400 font-medium">
                        ~{calculationResult.breakdown.profit.toLocaleString()} ₽
                      </span>
                    </div>
                  </div>

                  {/* Break-even reference */}
                  {calculationResult.breakEvenPrice > 0 && (
                    <div className="text-xs text-stone-500 flex items-center gap-2">
                      <span>📊</span>
                      <span>
                        Точка безубыточности: {calculationResult.breakEvenPrice.toLocaleString()} ₽
                      </span>
                    </div>
                  )}

                  {/* Main Result */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-4">
                    <div className="text-sm text-amber-400/80 mb-1">Рекомендуемая цена:</div>
                    <div className="text-4xl font-bold text-white tracking-tight">
                      {calculationResult.price > 0
                        ? calculationResult.price.toLocaleString()
                        : '---'}
                      <span className="text-xl text-stone-400 ml-2">₽</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer - Fixed, safe area padding */}
          <div className="px-5 py-4 border-t border-stone-800 bg-[#0c0c0e] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              onClick={handleApply}
              disabled={!costPrice || calculationResult.price <= 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500 disabled:cursor-not-allowed text-white rounded-xl py-4 font-bold text-lg transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.98]"
            >
              {calculationResult.price > 0
                ? `Применить ${calculationResult.price.toLocaleString()} ₽`
                : 'Введите закупочную цену'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Use Portal to render at document root
  return createPortal(modalContent, document.body);
}
