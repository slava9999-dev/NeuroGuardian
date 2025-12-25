// ============================================
// NeuroGUARDIAN — Price Calculator Component
// Automatic minimum price calculation
// ============================================

import { useState } from 'react';

interface PriceCalculatorProps {
  marketplace: 'WB' | 'Ozon';
  onCalculated: (minPrice: number) => void;
  onClose: () => void;
}

export function PriceCalculator({ marketplace, onCalculated, onClose }: PriceCalculatorProps) {
  const [costPrice, setCostPrice] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [laborRate, setLaborRate] = useState('200');
  const [logistics, setLogistics] = useState('300');
  const [packaging, setPackaging] = useState('100');
  const [adCost, setAdCost] = useState('200');

  // Commission rates
  const commissionRate = marketplace === 'Ozon' ? 0.15 : 0.15; // 15%
  const bankCommission = 0.02; // 2%

  const calculate = () => {
    const cost = parseFloat(costPrice) || 0;
    const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
    const log = parseFloat(logistics) || 0;
    const pack = parseFloat(packaging) || 0;
    const ad = parseFloat(adCost) || 0;

    // Base cost
    const baseTotal = cost + labor + log + pack + ad;

    // Calculate price including commissions
    // Formula: (baseTotal + bankFee) / (1 - marketplaceCommission)
    // Where bankFee = price * 0.02
    // So: price = (baseTotal) / (1 - marketplaceCommission - bankCommission)
    const minPrice = baseTotal / (1 - commissionRate - bankCommission);

    return Math.ceil(minPrice / 10) * 10; // Round up to nearest 10
  };

  const calculatedPrice = calculate();

  const handleApply = () => {
    onCalculated(calculatedPrice);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">🧮 Калькулятор минимальной цены</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Cost Price */}
          <div>
            <label className="block text-sm text-stone-400 mb-2">
              Себестоимость товара <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              placeholder="2000"
              className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Labor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-stone-400 mb-2">Часов работы</label>
              <input
                type="number"
                value={laborHours}
                onChange={e => setLaborHours(e.target.value)}
                placeholder="5"
                className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-2">₽/час</label>
              <input
                type="number"
                value={laborRate}
                onChange={e => setLaborRate(e.target.value)}
                placeholder="200"
                className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Other costs */}
          <div>
            <label className="block text-sm text-stone-400 mb-2">Логистика</label>
            <input
              type="number"
              value={logistics}
              onChange={e => setLogistics(e.target.value)}
              placeholder="300"
              className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-2">Упаковка</label>
            <input
              type="number"
              value={packaging}
              onChange={e => setPackaging(e.target.value)}
              placeholder="100"
              className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-2">Реклама (на 1 продажу)</label>
            <input
              type="number"
              value={adCost}
              onChange={e => setAdCost(e.target.value)}
              placeholder="200"
              className="w-full bg-stone-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Breakdown */}
          <div className="bg-stone-800/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-stone-400">
              <span>Себестоимость:</span>
              <span>{(parseFloat(costPrice) || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Работа:</span>
              <span>
                {((parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0)).toLocaleString(
                  'ru-RU'
                )}{' '}
                ₽
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Логистика + Упаковка:</span>
              <span>
                {((parseFloat(logistics) || 0) + (parseFloat(packaging) || 0)).toLocaleString(
                  'ru-RU'
                )}{' '}
                ₽
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Реклама:</span>
              <span>{(parseFloat(adCost) || 0).toLocaleString('ru-RU')} ₽</span>
            </div>

            <div className="border-t border-stone-700 pt-2 mt-2">
              <div className="flex justify-between text-stone-400">
                <span>
                  Комиссия {marketplace} ({(commissionRate * 100).toFixed(0)}%):
                </span>
                <span className="text-amber-400">
                  ~{Math.round(calculatedPrice * commissionRate).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Комиссия банка (2%):</span>
                <span className="text-amber-400">
                  ~{Math.round(calculatedPrice * bankCommission).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            <div className="border-t border-stone-700 pt-2 mt-2">
              <div className="flex justify-between text-white font-bold text-lg">
                <span>💰 Минимальная цена:</span>
                <span className="text-emerald-400">
                  {calculatedPrice.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
            ℹ️ Цена округлена до ближайших 10₽ для удобства
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-stone-700 hover:bg-stone-600 text-white rounded-lg px-4 py-3 font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleApply}
              disabled={!costPrice}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-stone-700 disabled:to-stone-700 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 font-medium transition-all"
            >
              Применить {calculatedPrice.toLocaleString('ru-RU')} ₽
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
