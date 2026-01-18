// ============================================
// NeuroGUARDIAN — Price Calculator Component
// Automatic minimum price calculation
// Version: 4.0.0 (Human UI)
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
  const [taxRate, setTaxRate] = useState<string>('7');
  const [marketingRate, setMarketingRate] = useState<string>('10');

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
    const tax = (parseFloat(taxRate) || 0) / 100;
    const marketing = (parseFloat(marketingRate) || 0) / 100;
    const totalVariableRate = variableRate + bankCommission + tax + marketing;

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
    taxRate,
    marketingRate,
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
        className="fixed inset-0 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Fullscreen Modal Container */}
        <motion.div
          className="relative flex flex-col w-full h-full max-h-dvh bg-slate-50 z-10 overflow-hidden"
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
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header - Fixed */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-xs">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                🧮 Калькулятор
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                    marketplace === 'WB'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {marketplace}
                </span>
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Рассчитайте минимальную цену для маржи {targetMargin}%
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all text-lg"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
            {/* 1. Cost Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                📦 Расходы
              </h3>

              {/* Main cost input */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="block text-sm font-medium text-slate-500 mb-2">
                  Закупка <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="2000"
                    autoFocus
                    className="w-full bg-slate-50 text-slate-900 rounded-xl pl-4 pr-12 py-4 focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-bold border-transparent focus:bg-white transition-all"
                  />
                  <span className="absolute right-4 top-4 text-slate-400 text-lg">₽</span>
                </div>
              </div>

              {/* Grid: Packaging & Logistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                  <label className="block text-sm font-medium text-slate-500 mb-2">Упаковка</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={packaging}
                      onChange={e => setPackaging(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 rounded-xl pl-4 pr-8 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs">₽</span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                  <label className="block text-sm font-medium text-slate-500 mb-2">Логистика</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={logistics}
                      onChange={e => setLogistics(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 rounded-xl pl-4 pr-8 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs">₽</span>
                  </div>
                </div>
              </div>

              {/* Advanced settings collapsible */}
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <span className="flex items-center gap-2">
                    {showAdvanced ? '🔽' : '▶️'} Доп. расходы
                  </span>
                  <span className="text-xs text-slate-400">налоги, реклама, работа</span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-slate-50/50"
                    >
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-bold">
                            Налог (%)
                          </label>
                          <input
                            type="number"
                            value={taxRate}
                            onChange={e => setTaxRate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-bold">
                            Маркетинг % (ДРР)
                          </label>
                          <input
                            type="number"
                            value={marketingRate}
                            onChange={e => setMarketingRate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="pt-2 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-bold">
                            Реклама (на 1 шт)
                          </label>

                          <div className="relative">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={adCost}
                              onChange={e => setAdCost(e.target.value)}
                              placeholder="0"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-bold">
                            Работа (сборка)
                          </label>
                          <div className="flex gap-2">
                            <input
                              placeholder="Час"
                              type="number"
                              inputMode="numeric"
                              value={laborHours}
                              onChange={e => setLaborHours(e.target.value)}
                              className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <input
                              placeholder="₽/ч"
                              type="number"
                              inputMode="numeric"
                              value={laborRate}
                              onChange={e => setLaborRate(e.target.value)}
                              className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
            <section className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                🎯 Маржа и комиссии
              </h3>

              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                {/* Target Margin */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-500 mb-2">
                    Целевая маржа
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={targetMargin}
                      onChange={e => setTargetMargin(e.target.value)}
                      min="1"
                      max="80"
                      className="w-full bg-slate-50 text-slate-900 rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* Ozon Card Toggle */}
                {marketplace === 'Ozon' && (
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        className={`w-12 h-7 rounded-full p-1 transition-colors ${
                          useOzonCard ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                        onClick={() => setUseOzonCard(!useOzonCard)}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full shadow-md"
                          animate={{ x: useOzonCard ? 20 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-500">Ozon Card</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Commission Info */}
              <div className="bg-slate-100/50 rounded-xl p-4 space-y-2 border border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Комиссия {marketplace}</span>
                  <span className="text-slate-900 font-bold">
                    {calculationResult.rates.commission.toFixed(0)}%
                  </span>
                </div>
                {calculationResult.rates.ozonCard > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Ozon Card (ср.)</span>
                    <span className="text-blue-600 font-bold">
                      {calculationResult.rates.ozonCard.toFixed(1)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Эквайринг</span>
                  <span className="text-slate-900 font-bold">
                    {calculationResult.rates.acquiring.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-bold">Всего переменных</span>
                  <span className="text-orange-500 font-black">
                    {calculationResult.rates.variableTotal.toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Result Section */}
            <section className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                💰 Результат
              </h3>

              {calculationResult.error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-600 font-medium text-sm flex items-center gap-2">
                  <span>⚠️</span> {calculationResult.error}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                  {/* Breakdown */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Себестоимость товара:</span>
                      <span className="font-semibold text-slate-700">
                        {Math.round(calculationResult.breakdown.goods).toLocaleString()} ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Логистика + упаковка:</span>
                      <span className="font-semibold text-slate-700">
                        {Math.round(
                          calculationResult.breakdown.logistics +
                            calculationResult.breakdown.packaging
                        ).toLocaleString()}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Комиссии (~{calculationResult.rates.variableTotal.toFixed(0)}%):</span>
                      <span className="font-semibold text-orange-500">
                        ~
                        {Math.round(
                          calculationResult.price * (calculationResult.rates.variableTotal / 100)
                        ).toLocaleString()}{' '}
                        ₽
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-100">
                      <span className="font-bold text-slate-700">
                        Прибыль ({calculationResult.breakdown.margin}%):
                      </span>
                      <span className="text-emerald-600 font-black text-lg">
                        ~{calculationResult.breakdown.profit.toLocaleString()} ₽
                      </span>
                    </div>
                  </div>

                  {/* Break-even reference */}
                  {calculationResult.breakEvenPrice > 0 && (
                    <div className="text-xs text-slate-400 flex items-center gap-2 font-medium">
                      <span>📊</span>
                      <span>Точка 0: {calculationResult.breakEvenPrice.toLocaleString()} ₽</span>
                    </div>
                  )}

                  {/* Main Result */}
                  <div className="bg-linear-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                      Рекомендуемая цена
                    </div>
                    <div className="text-4xl font-black text-indigo-900 tracking-tight">
                      {calculationResult.price > 0
                        ? calculationResult.price.toLocaleString()
                        : '---'}
                      <span className="text-xl text-indigo-300 ml-2 font-bold">₽</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer - Fixed */}
          <div className="px-5 py-4 border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <button
              onClick={handleApply}
              disabled={!costPrice || calculationResult.price <= 0}
              className="w-full bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl py-4 font-bold text-lg transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
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
