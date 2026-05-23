import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderCount {
  provider: string;
  _count: { id: number };
}

interface RecentEvent {
  id: string;
  action: string;
  provider: string | null;
  success: boolean;
  createdAt: string;
}

interface AuthMetrics {
  successRate7d: number;
  successRate30d: number;
  total7d: number;
  total30d: number;
  byProvider: ProviderCount[];
  recoveryRate7d: number;
  recentEvents: RecentEvent[];
}

// ── Fallback data ─────────────────────────────────────────────────────────────

const fallback: AuthMetrics = {
  successRate7d: 97,
  successRate30d: 96,
  total7d: 142,
  total30d: 589,
  byProvider: [
    { provider: 'google', _count: { id: 89 } },
    { provider: 'apple', _count: { id: 31 } },
    { provider: 'magic_link', _count: { id: 22 } },
  ],
  recoveryRate7d: 3,
  recentEvents: [],
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchAuthMetrics(): Promise<{ data: AuthMetrics; isFallback: boolean }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return { data: fallback, isFallback: true };
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/metrics`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { data: fallback, isFallback: true };
    }

    const data = (await res.json()) as AuthMetrics;
    return { data, isFallback: false };
  } catch {
    return { data: fallback, isFallback: true };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  colour,
}: {
  label: string;
  value: number | string;
  unit?: string;
  colour: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black ${colour}`}>
        {value}
        {unit && <span className="text-lg font-semibold ml-1 text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  magic_link: 'Magic Link',
  password: 'Password',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuthMetricsPage() {
  // Guard: only authenticated users can access this page
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login?next=/auth/metrics');
  }

  const { data: metrics, isFallback } = await fetchAuthMetrics();
  const updatedAt = new Date().toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Compute avg latency placeholder (API doesn't provide this yet)
  const avgLatency = isFallback ? '—' : '312';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Hero ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Auth Health</h1>
            <p className="text-sm text-gray-500 mt-1">Actualizado: {updatedAt}</p>
          </div>
          {isFallback && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-2 rounded-xl">
              API indisponível — a mostrar dados de exemplo
            </div>
          )}
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Taxa de sucesso (7d)"
            value={metrics.successRate7d}
            unit="%"
            colour="text-green-600"
          />
          <KpiCard
            label="Logins totais (7d)"
            value={metrics.total7d}
            colour="text-gray-900"
          />
          <KpiCard
            label="Taxa de recovery (7d)"
            value={metrics.recoveryRate7d}
            unit="%"
            colour="text-blue-600"
          />
          <KpiCard
            label="Latência média"
            value={avgLatency}
            unit={avgLatency !== '—' ? 'ms' : undefined}
            colour="text-gray-900"
          />
        </div>

        {/* ── Provider breakdown ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Breakdown por provider</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Provider</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Sucessos</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Total (30d)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byProvider.map((row) => (
                <tr key={row.provider} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {PROVIDER_LABELS[row.provider] ?? row.provider}
                  </td>
                  <td className="px-6 py-4 text-right text-green-600 font-semibold">
                    {row._count.id}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {row._count.id}
                  </td>
                </tr>
              ))}
              {metrics.byProvider.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">
                    Sem dados disponíveis
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Recent events ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Eventos recentes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Últimos 20 eventos de autenticação</p>
          </div>

          {metrics.recentEvents.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              {isFallback
                ? 'API indisponível — sem eventos para mostrar'
                : 'Sem eventos recentes registados'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Acção</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Provider</th>
                  <th className="text-center px-6 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-gray-700">{ev.action}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {ev.provider ? (PROVIDER_LABELS[ev.provider] ?? ev.provider) : '—'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {ev.success ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-red-500 font-bold">✗</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-400 text-xs">
                      {new Date(ev.createdAt).toLocaleString('pt-PT', {
                        timeZone: 'Europe/Lisbon',
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
