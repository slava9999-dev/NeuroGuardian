import { SentinelDashboard } from '../components/dashboard/SentinelDashboard';

export function DashboardPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Панель управления NeuroGUARDIAN</h1>

      {/* Main V5 Dashboard */}
      <SentinelDashboard />

      {/* Additional Sections (e.g. Quick Links) can be added here */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-2">🤖 Есть вопросы?</h3>
          <p className="text-sm text-blue-700 mb-3">
            Виктор поможет разобраться с настройками или проанализировать продажи.
          </p>
          <a
            href="/agent"
            className="text-sm font-medium text-white bg-blue-600 px-3 py-1.5 rounded hover:bg-blue-700 inline-block"
          >
            Спросить Виктора →
          </a>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2">⚙️ Настройки защиты</h3>
          <p className="text-sm text-gray-600 mb-3">
            Управляйте правилами, минимальными ценами и режимами работы.
          </p>
          <a
            href="/products"
            className="text-sm font-medium text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 inline-block"
          >
            К товарам →
          </a>
        </div>
      </div>
    </div>
  );
}
