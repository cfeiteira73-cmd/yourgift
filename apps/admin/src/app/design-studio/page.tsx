'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStats {
  totalDesignJobs: number;
  approvedMockups: number;
  autoApprovedMockups: number;
  autoApprovalRate: number;
}

interface DesignStats {
  totalJobs: number;
  byStatus: Record<string, number>;
  avgCompositeScore: number;
  avgBrandScore: number;
}

interface BrandTemplate {
  id: string;
  name: string;
  companyId: string;
  primaryColor: string;
  secondaryColor: string;
  styleKeywords: string[];
  brandScoreThreshold: number;
  _count?: { designJobs: number };
}

interface DesignMockup {
  id: string;
  compositeScore: number;
  brandScore: number;
  qualityScore: number;
  isApproved: boolean;
  isPrintReady: boolean;
  imageUrl: string | null;
  approvedBy: string | null;
}

interface DesignJob {
  id: string;
  companyId: string;
  productId: string;
  status: string;
  provider: string;
  createdAt: string;
  mockups: DesignMockup[];
}

interface ZeroFrictionResult {
  designJobId: string;
  pricingEstimate: { basePrice: number; margin: number; total: number };
  recommendedSupplier: string | null;
  requiresHumanApproval: boolean;
  approvalReason: string | null;
  procurementRef: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined' ? (localStorage.getItem('adminToken') ?? '') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function statusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-[#8ba8c7] bg-[#1a2f48]';
    case 'generating':
      return 'text-[#4da3ff] bg-[#0d1f3a] animate-pulse';
    case 'completed':
      return 'text-[#4ade80] bg-[#052e16]';
    case 'approved':
      return 'text-[#fbbf24] bg-[#3b2100]';
    case 'failed':
      return 'text-[#f87171] bg-[#450a0a]';
    default:
      return 'text-[#8ba8c7] bg-[#1a2f48]';
  }
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'text-[#4ade80] bg-[#052e16] border border-[#166534]';
  if (score >= 60) return 'text-[#4da3ff] bg-[#0d1f3a] border border-[#1a3a5c]';
  return 'text-[#fbbf24] bg-[#3b2100] border border-[#92400e]';
}

// ─── Score gauge (SVG arc) ────────────────────────────────────────────────────

function ScoreGauge({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circumference = Math.PI * r; // semicircle
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#4da3ff' : '#fbbf24';

  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#1a2f48"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Progress */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

// ─── Color swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-5 h-5 rounded-full border border-[#1a2f48] flex-shrink-0"
        style={{ backgroundColor: color }}
        title={color}
      />
      <span className="text-[10px] text-[#4d6a87] font-mono">{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DesignStudioPage() {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [designStats, setDesignStats] = useState<DesignStats | null>(null);
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [jobs, setJobs] = useState<DesignJob[]>([]);

  // Zero-friction form
  const [zfProductId, setZfProductId] = useState('');
  const [zfCompanyId, setZfCompanyId] = useState('');
  const [zfQuantity, setZfQuantity] = useState('10');
  const [zfLoading, setZfLoading] = useState(false);
  const [zfResult, setZfResult] = useState<ZeroFrictionResult | null>(null);
  const [zfError, setZfError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ps, ds, tpl, j] = await Promise.all([
        fetch(`${API}/api/v1/design/zero-friction/stats`, { headers: authHeaders() }).then((r) =>
          r.ok ? (r.json() as Promise<PipelineStats>) : null,
        ),
        fetch(`${API}/api/v1/design/stats`, { headers: authHeaders() }).then((r) =>
          r.ok ? (r.json() as Promise<DesignStats>) : null,
        ),
        fetch(`${API}/api/v1/design/templates`, { headers: authHeaders() }).then((r) =>
          r.ok ? (r.json() as Promise<BrandTemplate[]>) : [],
        ),
        fetch(`${API}/api/v1/design/jobs?companyId=default&limit=15`, {
          headers: authHeaders(),
        }).then((r) => (r.ok ? (r.json() as Promise<DesignJob[]>) : [])),
      ]);
      if (ps) setPipelineStats(ps);
      if (ds) setDesignStats(ds);
      if (Array.isArray(tpl)) setTemplates(tpl);
      if (Array.isArray(j)) setJobs(j);
    } catch {
      // silent — data may not be available yet
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleZeroFriction(e: React.FormEvent) {
    e.preventDefault();
    setZfLoading(true);
    setZfResult(null);
    setZfError(null);
    try {
      const res = await fetch(`${API}/api/v1/design/zero-friction`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          companyId: zfCompanyId,
          productId: zfProductId,
          quantity: Number(zfQuantity),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ZeroFrictionResult;
      setZfResult(data);
      void fetchData();
    } catch (err) {
      setZfError(err instanceof Error ? err.message : String(err));
    } finally {
      setZfLoading(false);
    }
  }

  async function handleApprove(mockupId: string) {
    try {
      await fetch(`${API}/api/v1/design/mockups/${mockupId}/approve`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ approvedBy: 'admin' }),
      });
      void fetchData();
    } catch {
      // silent
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f0f6ff] p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              width="24"
              height="24"
              className="text-[#4da3ff]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
            AI Design Studio
          </h1>
          <p className="text-sm text-[#8ba8c7] mt-1">
            Brand-compliant mockup generation · Zero-friction procurement pipeline
          </p>
        </div>

        {/* Pipeline KPIs */}
        <div className="flex gap-3 flex-wrap">
          {[
            {
              label: 'Auto-Approve Rate',
              value: pipelineStats ? `${pipelineStats.autoApprovalRate}%` : '—',
              accent: '#4ade80',
            },
            {
              label: 'Avg Score',
              value: designStats ? `${designStats.avgCompositeScore}` : '—',
              accent: '#4da3ff',
            },
            {
              label: 'Total Jobs',
              value: designStats ? String(designStats.totalJobs) : '—',
              accent: '#f0f6ff',
            },
            {
              label: 'Active',
              value: designStats
                ? String(
                    (designStats.byStatus['generating'] ?? 0) +
                      (designStats.byStatus['pending'] ?? 0),
                  )
                : '—',
              accent: '#fbbf24',
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-[#0b1526] border border-[#1a2f48] rounded-xl px-4 py-3 min-w-[110px]"
            >
              <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest font-semibold mb-1">
                {kpi.label}
              </p>
              <p className="text-xl font-bold" style={{ color: kpi.accent }}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[30%_40%_30%] gap-5">
        {/* ── LEFT: Brand Templates ─────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87] mb-3">
            Brand Templates
          </h2>
          <div className="space-y-3">
            {templates.length === 0 && (
              <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 text-sm text-[#4d6a87]">
                No templates found
              </div>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 hover:border-[#4da3ff]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">{t.name}</p>
                    <p className="text-[11px] text-[#4d6a87] mt-1 font-mono truncate max-w-[160px]">
                      {t.companyId}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#4d6a87] bg-[#07111f] border border-[#1a2f48] px-2 py-0.5 rounded-full">
                    {t._count?.designJobs ?? 0} jobs
                  </span>
                </div>

                <div className="flex gap-3 mb-3">
                  <ColorSwatch color={t.primaryColor} label="Primary" />
                  <ColorSwatch color={t.secondaryColor} label="Secondary" />
                </div>

                {t.styleKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {t.styleKeywords.slice(0, 4).map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#07111f] border border-[#1a2f48] text-[#8ba8c7]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-[#4d6a87]">Min score</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scoreBadgeClass(Number(t.brandScoreThreshold))}`}>
                    {Number(t.brandScoreThreshold).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CENTER: Design Jobs ───────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87] mb-3">
            Design Jobs
          </h2>
          <div className="space-y-3">
            {jobs.length === 0 && (
              <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 text-sm text-[#4d6a87]">
                No design jobs yet. Launch the Zero-Friction pipeline to generate one.
              </div>
            )}
            {jobs.map((job) => {
              const topMockup = job.mockups[0] ?? null;
              return (
                <div
                  key={job.id}
                  className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 hover:border-[#4da3ff]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Mock image preview */}
                    <div
                      className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#4da3ff] border border-[#1a2f48]"
                      style={{
                        background:
                          'linear-gradient(135deg, #0d1f3a 0%, #1a2f48 100%)',
                      }}
                    >
                      {topMockup?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={topMockup.imageUrl}
                          alt="mockup"
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-[18px]">✦</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-[#4d6a87] truncate max-w-[120px]">
                          {job.id.slice(0, 8)}…
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="text-[10px] text-[#4d6a87] border border-[#1a2f48] px-1.5 py-0.5 rounded">
                          {job.provider}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#8ba8c7] truncate mb-1">
                        Product: <span className="text-white font-mono">{job.productId.slice(0, 12)}…</span>
                      </p>
                      <p className="text-[11px] text-[#8ba8c7] truncate">
                        Company: <span className="text-white font-mono">{job.companyId.slice(0, 12)}</span>
                      </p>
                    </div>

                    {/* Score gauge */}
                    {topMockup && (
                      <div className="flex flex-col items-center gap-1">
                        <ScoreGauge score={Number(topMockup.compositeScore)} />
                        {!topMockup.isApproved && (
                          <button
                            type="button"
                            onClick={() => void handleApprove(topMockup.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/30 hover:bg-[#4da3ff]/20 transition-colors font-semibold"
                          >
                            Approve
                          </button>
                        )}
                        {topMockup.isApproved && (
                          <span className="text-[10px] text-[#4ade80] font-semibold">Approved</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RIGHT: Zero-Friction Pipeline ────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87] mb-3">
            Zero-Friction Pipeline
          </h2>
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
            <p className="text-xs text-[#8ba8c7] mb-4">
              1-click: product → AI mockup → pricing → supplier routing
            </p>

            <form onSubmit={(e) => void handleZeroFriction(e)} className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#4d6a87] font-semibold mb-1 uppercase tracking-wide">
                  Product ID
                </label>
                <input
                  type="text"
                  required
                  value={zfProductId}
                  onChange={(e) => setZfProductId(e.target.value)}
                  placeholder="uuid or product ref"
                  className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#4d6a87] font-semibold mb-1 uppercase tracking-wide">
                  Company ID
                </label>
                <input
                  type="text"
                  required
                  value={zfCompanyId}
                  onChange={(e) => setZfCompanyId(e.target.value)}
                  placeholder="company uuid"
                  className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#4d6a87] font-semibold mb-1 uppercase tracking-wide">
                  Quantity
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={zfQuantity}
                  onChange={(e) => setZfQuantity(e.target.value)}
                  className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={zfLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#4da3ff] hover:bg-[#74b9ff] disabled:opacity-50 disabled:cursor-not-allowed text-[#07111f] font-bold text-sm transition-colors"
              >
                {zfLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#07111f]/30 border-t-[#07111f] rounded-full animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="14"
                      height="14"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                      />
                    </svg>
                    Launch 1-Click Pipeline
                  </>
                )}
              </button>
            </form>

            {zfError && (
              <div className="mt-4 p-3 rounded-lg bg-[#450a0a] border border-[#7f1d1d] text-sm text-[#f87171]">
                {zfError}
              </div>
            )}

            {zfResult && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-[#052e16] border border-[#166534]">
                  <p className="text-[10px] font-bold text-[#4ade80] uppercase tracking-widest mb-2">
                    Pipeline Launched
                  </p>
                  <p className="text-[11px] text-[#8ba8c7]">
                    Ref:{' '}
                    <span className="text-white font-mono font-bold">{zfResult.procurementRef}</span>
                  </p>
                  <p className="text-[11px] text-[#8ba8c7]">
                    Design Job:{' '}
                    <span className="text-[#4da3ff] font-mono text-[10px]">
                      {zfResult.designJobId.slice(0, 12)}…
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Base', value: `€${zfResult.pricingEstimate.basePrice.toFixed(2)}` },
                    { label: 'Margin', value: `€${zfResult.pricingEstimate.margin.toFixed(2)}` },
                    { label: 'Total', value: `€${zfResult.pricingEstimate.total.toFixed(2)}` },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-2 text-center"
                    >
                      <p className="text-[9px] text-[#4d6a87] uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm font-bold text-white mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>

                {zfResult.recommendedSupplier && (
                  <div className="flex items-center gap-2 text-[11px] text-[#8ba8c7]">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="1" y="6" width="10" height="8" rx="1" />
                      <path d="M11 9h2.5a1 1 0 0 1 .9.55l1 2A1 1 0 0 1 15 12v2a1 1 0 0 1-1 1h-3" />
                    </svg>
                    Supplier:{' '}
                    <span className="text-white font-semibold">{zfResult.recommendedSupplier}</span>
                  </div>
                )}

                {zfResult.requiresHumanApproval && (
                  <div className="p-3 rounded-lg bg-[#3b2100] border border-[#92400e] text-[11px] text-[#fbbf24]">
                    <p className="font-bold mb-0.5">Human Approval Required</p>
                    <p className="text-[#d97706]">{zfResult.approvalReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pipeline stats */}
            {pipelineStats && (
              <div className="mt-5 pt-4 border-t border-[#1a2f48]">
                <p className="text-[10px] font-semibold text-[#4d6a87] uppercase tracking-widest mb-2">
                  Pipeline Stats
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Jobs', value: pipelineStats.totalDesignJobs },
                    { label: 'Approved', value: pipelineStats.approvedMockups },
                    { label: 'Auto', value: pipelineStats.autoApprovedMockups },
                    { label: 'Rate', value: `${pipelineStats.autoApprovalRate}%` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-2"
                    >
                      <p className="text-[9px] text-[#4d6a87] uppercase tracking-wide">{s.label}</p>
                      <p className="text-sm font-bold text-[#f0f6ff]">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
