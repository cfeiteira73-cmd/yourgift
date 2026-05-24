import { Metadata } from 'next';

/**
 * /reports/:shareToken — Public CFO ROI Report
 *
 * No authentication required — shareable link for CFOs and finance teams.
 * Fetches report data from the API using the share token.
 *
 * This page is the closer: the CFO opens this link without logging in,
 * sees the ROI, and approves budget for YourGift OS.
 */

interface ROIReportData {
  reportId: string;
  companyName: string;
  period: string;
  generatedAt: string;
  totalBudgetEur: number;
  totalSpendEur: number;
  budgetUtilisationPct: number;
  remainingBudgetEur: number;
  totalSavingsEur: number;
  savingsFromNegotiation: number;
  savingsFromConsolidation: number;
  savingsFromLandedCost: number;
  roiPct: number;
  totalOrders: number;
  avgOrderValueEur: number;
  avgTimeToQuoteHours: number;
  avgTimeToOrderHours: number;
  activeSuppliers: number;
  topSuppliers: Array<{ name: string; spendEur: number; orderCount: number; trustScore: number }>;
  topCategories: Array<{ name: string; spendEur: number; pct: number }>;
  marketBenchmark: {
    avgPriceVariancePct: number;
    industryAvgLeadDays: number;
    platformVsManualTimeSavedHours: number;
  };
  monthlySpend: Array<{ month: string; budgeted: number; actual: number; savings: number }>;
}

interface Props {
  params: { shareToken: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Relatório ROI de Procurement | YourGift OS',
    description: 'Análise de retorno sobre investimento e poupanças em procurement empresarial.',
    robots: { index: false, follow: false },
  };
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.5rem 1.75rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.625rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: accent ? 'rgb(99,230,190)' : 'rgb(245,247,251)', lineHeight: 1, marginBottom: sub ? '0.375rem' : 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>{sub}</p>}
    </div>
  );
}

async function fetchReport(shareToken: string): Promise<ROIReportData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/intelligence/roi/${shareToken}`, {
      next: { revalidate: 300 }, // cache 5 minutes
    });
    if (!res.ok) return null;
    return res.json() as Promise<ROIReportData>;
  } catch {
    return null;
  }
}

export default async function ROIReportPage({ params }: Props) {
  const report = await fetchReport(params.shareToken);

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!report || (report as unknown as { message?: string }).message) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', marginBottom: '0.75rem' }}>Relatório não disponível</h1>
          <p style={{ color: 'rgb(120,130,150)', marginBottom: '2rem' }}>Este link pode ter expirado ou o relatório ainda não foi gerado.</p>
          <a href="https://www.yourgift.pt" style={{ color: 'rgb(77,163,255)', fontSize: '0.875rem' }}>yourgift.pt</a>
        </div>
      </div>
    );
  }

  const timeSavedHours = report.marketBenchmark.platformVsManualTimeSavedHours;
  const timeSavedDays = Math.round(timeSavedHours / 8);

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'rgb(245,247,251)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1100px', margin: '0 auto' }}>
        <a href="https://www.yourgift.pt" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
            your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
          </span>
        </a>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(245,247,251)' }}>{report.companyName}</p>
          <p style={{ fontSize: '0.65rem', color: 'rgb(120,130,150)' }}>Relatório ROI · {report.period}</p>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 2rem 4rem' }}>

        {/* Hero */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgb(77,163,255)', marginBottom: '0.75rem' }}>
            Relatório de Retorno sobre Investimento
          </p>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1rem' }}>
            {report.companyName} poupou{' '}
            <span style={{ color: 'rgb(99,230,190)' }}>€{fmt(report.totalSavingsEur)}</span>
            <br />em {report.period}
          </h1>
          <p style={{ fontSize: '1rem', color: 'rgb(120,130,150)', maxWidth: '540px', margin: '0 auto' }}>
            Análise completa de procurement gerido pelo YourGift OS —
            poupanças verificadas vs. custos de plataforma.
          </p>
        </div>

        {/* ROI Hero number */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,230,190,0.06), rgba(77,163,255,0.04))', border: '1px solid rgba(99,230,190,0.15)', borderRadius: '20px', padding: '2.5rem', textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgb(99,230,190)', marginBottom: '0.75rem' }}>Retorno sobre investimento</p>
          <p style={{ fontSize: '5rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'rgb(99,230,190)', lineHeight: 1, marginBottom: '0.5rem' }}>
            {report.roiPct > 0 ? `${fmt(report.roiPct)}%` : '—'}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)' }}>
            Para cada euro investido na plataforma, foram gerados {report.roiPct > 0 ? `€${(report.roiPct / 100).toFixed(2)}` : '—'} em poupanças
          </p>
        </div>

        {/* Key metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <MetricCard label="Poupança total" value={`€${fmt(report.totalSavingsEur)}`} sub="período analisado" accent />
          <MetricCard label="Spend gerido" value={`€${fmt(report.totalSpendEur)}`} sub={`${fmt(report.budgetUtilisationPct, 1)}% do orçamento`} />
          <MetricCard label="Encomendas" value={fmt(report.totalOrders)} sub={`€${fmt(report.avgOrderValueEur)} valor médio`} />
          <MetricCard label="Tempo poupado" value={`${timeSavedDays}d`} sub={`${fmt(timeSavedHours)}h vs. processo manual`} />
          <MetricCard label="Fornecedores" value={String(report.activeSuppliers)} sub="activos no período" />
          <MetricCard label="Prazo médio de orçamento" value={`${report.avgTimeToQuoteHours.toFixed(1)}h`} sub={`vs. ${report.marketBenchmark.industryAvgLeadDays}d benchmark indústria`} />
        </div>

        {/* Savings breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '1.75rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1.25rem' }}>Origem das poupanças</p>
            {[
              { label: 'Negociação com fornecedores', value: report.savingsFromNegotiation, pct: report.totalSavingsEur > 0 ? (report.savingsFromNegotiation / report.totalSavingsEur) * 100 : 0, color: 'rgb(77,163,255)' },
              { label: 'Consolidação de compras', value: report.savingsFromConsolidation, pct: report.totalSavingsEur > 0 ? (report.savingsFromConsolidation / report.totalSavingsEur) * 100 : 0, color: 'rgb(99,230,190)' },
              { label: 'Optimização de landed cost', value: report.savingsFromLandedCost, pct: report.totalSavingsEur > 0 ? (report.savingsFromLandedCost / report.totalSavingsEur) * 100 : 0, color: 'rgb(251,191,36)' },
            ].map(({ label, value, pct, color }) => (
              <div key={label} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)' }}>{label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgb(245,247,251)' }}>€{fmt(value)}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Top suppliers */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '1.75rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1.25rem' }}>Top fornecedores</p>
            {report.topSuppliers.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', fontStyle: 'italic' }}>Dados em construção</p>
            ) : (
              report.topSuppliers.slice(0, 5).map((s, i) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <span style={{ width: '20px', fontSize: '0.7rem', fontWeight: 700, color: 'rgb(120,130,150)', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(245,247,251)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    <p style={{ fontSize: '0.7rem', color: 'rgb(120,130,150)' }}>{s.orderCount} encomendas · score {s.trustScore}/100</p>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgb(99,230,190)', flexShrink: 0 }}>€{fmt(s.spendEur)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Market benchmarks */}
        <div style={{ background: 'rgba(77,163,255,0.04)', border: '1px solid rgba(77,163,255,0.12)', borderRadius: '16px', padding: '1.75rem 2rem', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(77,163,255)', marginBottom: '1.25rem' }}>Benchmark vs. mercado</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {[
              { label: 'Variação de preço', platform: `${report.marketBenchmark.avgPriceVariancePct}%`, industry: '8–15%', better: true },
              { label: 'Lead time médio', platform: `${report.avgTimeToOrderHours.toFixed(0)}h`, industry: `${report.marketBenchmark.industryAvgLeadDays * 24}h`, better: true },
              { label: 'Tempo poupado por encomenda', platform: `${(timeSavedHours / Math.max(report.totalOrders, 1)).toFixed(1)}h`, industry: 'manual', better: true },
            ].map(({ label, platform, industry, better }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'rgb(120,130,150)', marginBottom: '0.375rem' }}>{label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: better ? 'rgb(99,230,190)' : 'rgb(239,68,68)', marginBottom: '0.2rem' }}>{platform}</p>
                <p style={{ fontSize: '0.7rem', color: 'rgb(120,130,150)' }}>vs. {industry} indústria</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
            Relatório gerado em {new Date(report.generatedAt).toLocaleDateString('pt-PT')} · {report.reportId}
          </p>
          <a href="https://www.yourgift.pt" style={{ fontSize: '0.875rem', color: 'rgb(77,163,255)', fontWeight: 600 }}>
            yourgift.pt — Infraestrutura de procurement empresarial
          </a>
        </div>
      </main>
    </div>
  );
}
