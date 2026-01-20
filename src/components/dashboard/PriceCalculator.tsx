// ============================================
// NeuroGUARDIAN — Price Calculator Component V6.1 (Human)
// Aesthetic: Clear, Focused, Touch-Friendly
// ============================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Calculator, Info } from 'lucide-react';

// Import constants and logic from shared service
import { OZON_CARD_CONFIG, calculateUnitEconomics } from '../../api-lib/services/unit-economics';

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
  const [storageDays, setStorageDays] = useState<string>('30');
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
    const days = parseFloat(storageDays) || 30;
    const tax = (parseFloat(taxRate) || 0) / 100;
    const marketing = (parseFloat(marketingRate) || 0) / 100;

    // Total 'Cost Price' input for the calculator
    const totalGoodsCost = cost + labor + ad;

    // Get rates from the service
    const stats = calculateUnitEconomics({
      price: 1000,
      costPrice: totalGoodsCost,
      marketplace,
      fulfillmentType: 'fbs',
      packagingCost: pack,
      targetMarginPercent: margin,
      useOzonCard: marketplace === 'Ozon' && useOzonCard,
      category,
      avgStorageDays: days,
      taxRate: tax,
      marketingRate: marketing,
    });

    // Storage cost calculation
    const storageCostPerDay = marketplace === 'WB' ? 0.08 : 0.75; // ₽/л/день
    const storageCost = Math.round(storageCostPerDay * days);

    // Fixed Costs from User Inputs:
    const fixedCosts = totalGoodsCost + log + pack + storageCost;

    // Variable Rates
    const commissionRate = stats.commissionRate;
    const acquiringRate = marketplace === 'Ozon' ? 0.015 : 0;
    const sppRate = marketplace === 'WB' ? 0.08 : 0.05;
    const ozonCardRate =
      marketplace === 'Ozon' && useOzonCard
        ? OZON_CARD_CONFIG.discountPercent * OZON_CARD_CONFIG.adoptionRate
        : 0;

    const bankCommission = 0.01; // ~1% withdrawal
    const totalVariableRate =
      commissionRate + acquiringRate + sppRate + ozonCardRate + bankCommission + tax + marketing;

    // Target Margin Rate
    const targetMarginRate = margin / 100;

    // Build warnings array
    const warnings: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];

    // Check if calculation is possible
    if (totalVariableRate + targetMarginRate >= 1) {
      return {
        price: 0,
        breakEvenPrice: 0,
        rates: {
          commission: 0,
          ozonCard: 0,
          acquiring: 0,
          spp: 0,
          tax: 0,
          marketing: 0,
          bank: 0,
          variableTotal: 0,
        },
        breakdown: {
          goods: 0,
          logistics: 0,
          packaging: 0,
          storage: 0,
          margin: 0,
          profit: 0,
        },
        warnings: [],
        error: 'Комиссии превышают 100%',
      };
    }

    // Break-even Price (margin = 0)
    const breakEvenPrice = Math.ceil(fixedCosts / (1 - totalVariableRate));

    // Recommended Price (with target margin)
    const minPrice = Math.ceil(fixedCosts / (1 - totalVariableRate - targetMarginRate));

    // Calculate expected profit at recommended price
    const expectedProfit = minPrice * targetMarginRate;

    // Real costs at recommended price
    const priceCommission = Math.round(minPrice * commissionRate);
    const priceAcquiring = Math.round(minPrice * acquiringRate);
    const priceSpp = Math.round(minPrice * sppRate);
    const priceOzonCard = Math.round(minPrice * ozonCardRate);
    const priceTax = Math.round(minPrice * tax);
    const priceMarketing = Math.round(minPrice * marketing);

    // Warnings
    if (marketplace === 'Ozon' && useOzonCard && ozonCardRate > 0) {
      const ozonCardCost = Math.round(minPrice * ozonCardRate);
      warnings.push({
        type: 'warning',
        message: `Ozon Card съедает ~${ozonCardCost}₽ с заказа (5% × 40% покупателей)`,
      });
    }

    if (days > 45) {
      warnings.push({
        type: days > 60 ? 'critical' : 'warning',
        message:
          days > 60
            ? `⚠️ ${days} дней на складе! Тариф хранения удвоен!`
            : `${days} дней на складе — через ${60 - days} дней тариф удвоится`,
      });
    }

    if (margin < 15) {
      warnings.push({
        type: 'info',
        message: `Маржа ${margin}% — рискованно при возвратах и акциях`,
      });
    }

    return {
      price: Math.ceil(minPrice / 10) * 10,
      breakEvenPrice: Math.ceil(breakEvenPrice / 10) * 10,
      rates: {
        commission: commissionRate * 100,
        ozonCard: ozonCardRate * 100,
        acquiring: acquiringRate * 100,
        spp: sppRate * 100,
        tax: tax * 100,
        marketing: marketing * 100,
        bank: bankCommission * 100,
        variableTotal: totalVariableRate * 100,
      },
      breakdown: {
        goods: totalGoodsCost,
        logistics: log,
        packaging: pack,
        storage: storageCost,
        commission: priceCommission,
        acquiring: priceAcquiring,
        spp: priceSpp,
        ozonCard: priceOzonCard,
        tax: priceTax,
        marketing: priceMarketing,
        margin: margin,
        profit: Math.round(expectedProfit),
      },
      warnings,
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
    storageDays,
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
        className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Container */}
        <motion.div
          className="relative w-full sm:max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.2 }}
          onDragEnd={handleDragEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Calculator className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Калькулятор</h2>
                <p className="text-xs text-slate-500 font-medium">Юнит-экономика {marketplace}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-8 bg-slate-50/50">
            {/* 1. Main Input: Purchasing Price */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex justify-between">
                <span>Закупочная цена</span>
                <span className="text-indigo-600 cursor-help" title="Цена товара у поставщика">
                  ?
                </span>
              </label>
              <div className="relative group">
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white text-3xl font-bold text-slate-900 px-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-200"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl pointer-events-none">
                  ₽
                </span>
              </div>
            </div>

            {/* 2. Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                  Логистика
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={logistics}
                    onChange={e => setLogistics(e.target.value)}
                    className="w-full text-lg font-bold text-slate-900 outline-none placeholder:text-slate-200"
                    placeholder="0"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                    ₽
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                  Склад
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={storageDays}
                    onChange={e => setStorageDays(e.target.value)}
                    className="w-full text-lg font-bold text-slate-900 outline-none placeholder:text-slate-200"
                    placeholder="30"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                    дн
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                  Маржа
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={targetMargin}
                    onChange={e => setTargetMargin(e.target.value)}
                    className="w-full text-lg font-bold text-slate-900 outline-none placeholder:text-slate-200"
                    placeholder="20"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                    %
                  </span>
                </div>
              </div>

              {/* Ozon Card Toggle included in grid if Ozon */}
              {marketplace === 'Ozon' && (
                <div className="col-span-3 flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <span className="text-sm font-bold text-blue-700">Использовать Ozon Card</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={useOzonCard}
                      onChange={() => setUseOzonCard(!useOzonCard)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}
            </div>

            {/* 3. Advanced Toggle */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors w-full p-2 hover:bg-slate-100 rounded-lg group"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>Дополнительные расходы</span>
                <span className="ml-auto text-xs font-normal text-slate-400 group-hover:text-indigo-400">
                  Налоги, реклама, упаковка
                </span>
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          Упаковка
                        </label>
                        <input
                          type="number"
                          value={packaging}
                          onChange={e => setPackaging(e.target.value)}
                          className="w-full font-bold text-slate-700 outline-none text-sm"
                          placeholder="15 ₽"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          Налог
                        </label>
                        <input
                          type="number"
                          value={taxRate}
                          onChange={e => setTaxRate(e.target.value)}
                          className="w-full font-bold text-slate-700 outline-none text-sm"
                          placeholder="7 %"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          Реклама
                        </label>
                        <input
                          type="number"
                          value={adCost}
                          onChange={e => setAdCost(e.target.value)}
                          className="w-full font-bold text-slate-700 outline-none text-sm"
                          placeholder="0 ₽"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          Маркетинг (ДРР)
                        </label>
                        <input
                          type="number"
                          value={marketingRate}
                          onChange={e => setMarketingRate(e.target.value)}
                          className="w-full font-bold text-slate-700 outline-none text-sm"
                          placeholder="10 %"
                        />
                      </div>
                      <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-100 flex gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                            Работа (Часы)
                          </label>
                          <input
                            type="number"
                            value={laborHours}
                            onChange={e => setLaborHours(e.target.value)}
                            className="w-full font-bold text-slate-700 outline-none text-sm"
                            placeholder="0 ч"
                          />
                        </div>
                        <div className="flex-1 border-l border-slate-100 pl-4">
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                            Ставка (₽/ч)
                          </label>
                          <input
                            type="number"
                            value={laborRate}
                            onChange={e => setLaborRate(e.target.value)}
                            className="w-full font-bold text-slate-700 outline-none text-sm"
                            placeholder="200 ₽"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. Results Card */}
            {calculationResult.price > 0 && !calculationResult.error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {/* Main Result */}
                <div className="bg-white rounded-2xl p-5 shadow-lg shadow-indigo-100 border border-indigo-50">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Рекомендуемая цена
                      </p>
                      <p className="text-3xl font-black text-indigo-600 tracking-tight">
                        {calculationResult.price.toLocaleString()}
                        <span className="text-lg ml-1 text-indigo-300">₽</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Чистая прибыль
                      </p>
                      <p className="text-xl font-bold text-emerald-500">
                        +{Math.round(calculationResult.breakdown.profit).toLocaleString()} ₽
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between text-xs font-medium text-slate-400">
                    <span>Точка 0: {calculationResult.breakEvenPrice} ₽</span>
                    <span>Комиссии: ~{Math.round(calculationResult.rates.variableTotal)}%</span>
                  </div>
                </div>

                {/* Detailed Cost Breakdown */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                    Разбивка расходов
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        label: 'Товар + работа',
                        value: calculationResult.breakdown.goods || 0,
                        color: 'bg-slate-400',
                      },
                      {
                        label: 'Логистика',
                        value: calculationResult.breakdown.logistics || 0,
                        color: 'bg-orange-400',
                      },
                      {
                        label: 'Хранение',
                        value: calculationResult.breakdown.storage || 0,
                        color: 'bg-amber-400',
                      },
                      {
                        label: 'Упаковка',
                        value: calculationResult.breakdown.packaging || 0,
                        color: 'bg-yellow-400',
                      },
                      {
                        label: `Комиссия ${marketplace}`,
                        value: calculationResult.breakdown.commission || 0,
                        color: 'bg-rose-400',
                      },
                      ...(marketplace === 'Ozon'
                        ? [
                            {
                              label: 'Эквайринг 1.5%',
                              value: calculationResult.breakdown.acquiring || 0,
                              color: 'bg-pink-400',
                            },
                            ...((calculationResult.breakdown.ozonCard || 0) > 0
                              ? [
                                  {
                                    label: 'Ozon Card',
                                    value: calculationResult.breakdown.ozonCard || 0,
                                    color: 'bg-blue-400',
                                  },
                                ]
                              : []),
                          ]
                        : []),
                      {
                        label: `SPP ${marketplace === 'WB' ? '8%' : '5%'}`,
                        value: calculationResult.breakdown.spp || 0,
                        color: 'bg-purple-400',
                      },
                      {
                        label: `Налог ${taxRate}%`,
                        value: calculationResult.breakdown.tax || 0,
                        color: 'bg-indigo-400',
                      },
                      {
                        label: `Маркетинг ${marketingRate}%`,
                        value: calculationResult.breakdown.marketing || 0,
                        color: 'bg-cyan-400',
                      },
                    ]
                      .filter(item => item.value > 0)
                      .map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="text-slate-500 flex-1">{item.label}</span>
                          <span className="font-bold text-slate-700">
                            {item.value.toLocaleString()} ₽
                          </span>
                        </div>
                      ))}
                    <div className="flex items-center gap-2 text-xs pt-2 border-t border-slate-100 mt-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-600 font-semibold flex-1">Ваша прибыль</span>
                      <span className="font-bold text-emerald-600">
                        {calculationResult.breakdown.profit.toLocaleString()} ₽
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {calculationResult.warnings && calculationResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    {calculationResult.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                          warning.type === 'critical'
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : warning.type === 'warning'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {calculationResult.error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2">
                <Info className="w-5 h-5 shrink-0" />
                {calculationResult.error}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 bg-white border-t border-slate-100">
            <button
              onClick={handleApply}
              disabled={!costPrice || calculationResult.price <= 0}
              className="w-full btn-premium bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Применить {calculationResult.price > 0 ? `${calculationResult.price} ₽` : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
