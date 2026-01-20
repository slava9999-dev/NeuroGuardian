import { SentinelDashboard } from '../components/dashboard/SentinelDashboard';
import { SentinelAlerts } from '../components/dashboard/SentinelAlerts';

export function DashboardPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Title */}
      <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white pb-2 border-b border-white/5">
        Панель управления{' '}
        <span className="text-primary tracking-normal not-italic">NeuroGUARDIAN</span>
      </h1>

      {/* Main V5 Dashboard */}
      <SentinelDashboard />

      {/* Hunter Mode: Competitor Alerts */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-black italic uppercase text-white">Hunter Mode</h2>
          <span className="text-xs font-bold bg-purple-600 text-white px-3 py-1 rounded-full">
            BETA
          </span>
        </div>
        <SentinelAlerts />
      </div>

      {/* Additional Sections (e.g. Quick Links) can be added here */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-primary/5 p-6 rounded-3xl border border-primary/20 hover:bg-primary/10 transition-all cursor-pointer group">
          <h3 className="font-black italic uppercase text-primary mb-3 flex items-center gap-3">
            🤖 Есть вопросы?{' '}
            <span className="text-[10px] not-italic font-bold bg-primary text-black px-2 py-0.5 rounded ml-auto">
              AI ONLINE
            </span>
          </h3>
          <p className="text-sm text-zinc-400 font-medium mb-6 leading-relaxed">
            Виктор поможет разобраться с настройками или проанализировать продажи.
          </p>
          <a
            href="/agent"
            className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-black bg-white px-6 py-4 rounded-2xl hover:bg-primary transition-all inline-block shadow-xl shadow-primary/10 group-hover:shadow-primary/20"
          >
            Спросить Виктора →
          </a>
        </div>

        <div className="bg-white/2 p-6 rounded-3xl border border-white/5 hover:bg-white/5 transition-all cursor-pointer group">
          <h3 className="font-black italic uppercase text-white mb-3 flex items-center gap-3">
            ⚙️ Настройки защиты{' '}
            <span className="text-[10px] not-italic font-bold bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded ml-auto">
              SENTINEL
            </span>
          </h3>
          <p className="text-sm text-zinc-400 font-medium mb-6 leading-relaxed">
            Управляйте правилами, минимальными ценами и режимами работы.
          </p>
          <a
            href="/products"
            className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-white bg-zinc-800 px-6 py-4 rounded-2xl hover:bg-zinc-700 transition-all inline-block border border-white/5 group-hover:border-white/10"
          >
            К товарам →
          </a>
        </div>
      </div>
    </div>
  );
}
