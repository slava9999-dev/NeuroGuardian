import { useState, useEffect } from 'react';
import { Shield, TrendingDown, Eye, X } from 'lucide-react';

interface CompetitorAlert {
  productId: number;
  productName: string;
  yourPrice: number;
  competitorPrice: number;
  competitorUrl: string;
  priceDropPercent: number;
  marketplace: 'WB' | 'Ozon';
  recommendedAction: 'lower_price' | 'monitor' | 'ignore';
  recommendedPrice?: number;
}

export function SentinelAlerts() {
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api?action=sentinel-alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLowerPrice = async (productId: number, newPrice: number) => {
    try {
      const response = await fetch('/api?action=update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, newPrice }),
      });

      if (response.ok) {
        // Remove alert from list
        setAlerts(alerts.filter(a => a.productId !== productId));
      }
    } catch (error) {
      console.error('Failed to update price:', error);
    }
  };

  const handleIgnore = (productId: number) => {
    setAlerts(alerts.filter(a => a.productId !== productId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center p-8">
        <Shield className="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Всё под контролем</h3>
        <p className="text-gray-400">Sentinel не обнаружил угроз от конкурентов</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-purple-500" />
        <h2 className="text-2xl font-bold text-white">Hunter Mode Alerts</h2>
        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          {alerts.length}
        </span>
      </div>

      {alerts.map(alert => (
        <div
          key={alert.productId}
          className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 hover:border-purple-500/50 transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">{alert.productName}</h3>
              <span className="text-sm text-gray-400">{alert.marketplace}</span>
            </div>
            <button
              onClick={() => handleIgnore(alert.productId)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Ваша цена</p>
              <p className="text-2xl font-bold text-white">{alert.yourPrice} ₽</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Конкурент</p>
              <p className="text-2xl font-bold text-red-400">{alert.competitorPrice} ₽</p>
              <p className="text-sm text-red-400">-{alert.priceDropPercent}%</p>
            </div>
          </div>

          {alert.recommendedPrice && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300 mb-2">🎯 Рекомендация Sentinel</p>
              <p className="text-xl font-bold text-purple-400">{alert.recommendedPrice} ₽</p>
            </div>
          )}

          <div className="flex gap-2">
            {alert.recommendedPrice && (
              <button
                onClick={() => handleLowerPrice(alert.productId, alert.recommendedPrice!)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <TrendingDown className="w-4 h-4" />
                Снизить до {alert.recommendedPrice} ₽
              </button>
            )}
            <a
              href={alert.competitorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Посмотреть
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
