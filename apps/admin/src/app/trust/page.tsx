'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken, timeAgo } from '@/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TrustScore {
  id: string;
  context: string;
  contextValue: string;
  explainabilityScore: number;
  benchmarkDeviationScore: number;
  historicalAccuracyScore: number;
  governanceComplianceScore: number;
  overrideFrequencyScore: number;
  compositeScore: number;
  autonomyLevelGranted: number;
  sampleCount: number;
  updatedAt: string;
}

interface TrustStats {
  avgCompositeScore: number;
  level3Count: number;
  level2Count: number;
  level1Count: number;
  level0Count: number;
  totalScores: number;
  recentEvents: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 80) return '#22c55e';
  if (n >= 60) return '#f59e0b';
  return '#ef4444';
}

function autonomyLevelStyle(level: number): { bg: string; text: string; border: string; label: string } {
  const map: Record<number, { bg: string; text: string; border: string; label: string }> = {
    0: { bg: 'bg-[#4d6a87]/10', text: 'text-[#4d6a87]', border: 'border-[#4d6a87]/20', label: 'OBSERVE' },
    1: { bg: 'bg-[#4da3ff]/10', text: 'text-[#4da3ff]', border: 'border-[#4da3ff]/20', label: 'SUGGEST' },
    2: { bg: 'bg-[#4da3ff]/10', text: 'text-[#4da3ff]', border: 'border-[#4da3ff]/20', label: 'CONTROLLED' },
    3: { bg: 'bg-[#a855f7]/10', text: 'text-[#a855f7]', border: 'border-[#a855f7]/20', label: 'FULL AUTO' },
  };
  return map[level] ?? map[0];
}

function contextBadgeClass(ctx: string): string {
  const map: Record<string, string> = {
    supplier: 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
    route:    'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
    category: 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20',
    global:   'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
  };
  return map[ctx] ?? 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20';
}

function nextLevelThreshold(level: number): number | null {
  const thresholds: Record<number, number> = { 0: 60, 1: 75, 2: 90 };
  return thresholds[level] ?? null;
}

// ─── Inline Score Bar ─────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <svg width={60} height={6} className="inline-block align-middle ml-1">
      <rect x={0} y={0} width={60} height={6} rx={3} fill="#1a2f48" />
      <rect x={0} y={0} width={Math.max(0, (value / 100) * 60)} height={6} rx={3} fill={color} />
    </svg>
  );
}

// ─── Factor Bar (horizontal) ──────────────────────────────────────────────────

function FactorBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#4d6a87] w-44 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#1a2f48] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Autonomy Level Column ────────────────────────────────────────────────────

interface LevelColProps {
  level: number;
  label: string;
  description: string;
  color: string;
  count: number;
  maxCount: number;
}

function LevelColumn({ level, label, description, color, count, maxCount }: LevelColProps) {
  const barH = maxCount > 0 ? Math.max(8, (count / maxCount) * 80) : 8;
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="font-tight text-3xl font-bold" style={{ color }}>{level}</div>
      <div className="text-xs font-semibold text-white text-center">{label}</div>
      <div className="flex flex-col items-center justify-end" style={{ height: 96 }}>
        <svg width={40} height={barH}>
          <rect x={4} y={0} width={32} height={barH} rx={4} fill={color} opacity={0.7} />
        </svg>
      </div>
      <div className="font-tight text-xl font-bold" style={{ color }}>{count}</div>
      <div className="text-xs text-[#4d6a87] text-center leading-tight">{description}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrustPage() {
  const [scores,        setScores]        = useState<TrustScore[]>([]);
  const [stats,         setStats]         = useState<TrustStats | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [selectedScore, setSelectedScore] = useState<TrustScore | null>(null);

  const authHdrs = {
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('adminToken') ?? '' : ''}`,
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [rScores, rStats] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/governance/trust`,       { headers: authHdrs }),
      fetch(`${API_BASE}/api/v1/governance/trust/stats`, { headers: authHdrs }),
    ]);

    if (rScores.status === 'fulfilled' && rScores.value.ok) {
      const d = await rScores.value.json();
      setScores(Array.isArray(d) ? d : d.data ?? []);
    }
    if (rStats.status === 'fulfilled' && rStats.value.ok) {
      setStats(await rStats.value.json());
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const avgScore = stats?.avgCompositeScore ?? (
    scores.length > 0
      ? scores.reduce((a, s) => a + s.compositeScore, 0) / scores.length
      : null
  );

  const maxLevelCount = stats
    ? Math.max(stats.level0Count, stats.level1Count, stats.level2Count, stats.level3Count, 1)
    : 1;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07111f] text-white p-6">

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-tight text-2xl font-bold tracking-tight">Trust Engine</h1>
          <p className="text-[#4d6a87] text-sm mt-0.5">Autonomy is earned, not assumed</p>
        </div>
        <div className="flex flex-col items-end">
          {avgScore !== null ? (
            <>
              <div
                className="font-tight text-3xl font-bold"
                style={{ color: scoreColor(avgScore) }}
              >
                {typeof avgScore === 'number' ? avgScore.toFixed(1) : avgScore}
              </div>
              <div className="text-xs text-[#4d6a87]">Avg Trust Score</div>
            </>
          ) : (
            <div className="text-[#4d6a87] text-sm">—</div>
          )}
        </div>
      </div>

      {/* AUTONOMY GRADIENT VISUALIZATION */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 mb-6">
        <div className="text-xs font-semibold text-[#4d6a87] uppercase tracking-wider mb-5">
          Autonomy Level Distribution
        </div>
        <div className="flex gap-6 justify-between">
          <LevelColumn
            level={0}
            label="OBSERVE ONLY"
            description="Analytics only, no execution"
            color="#4d6a87"
            count={stats?.level0Count ?? 0}
            maxCount={maxLevelCount}
          />
          <div className="w-px bg-[#1a2f48] self-stretch" />
          <LevelColumn
            level={1}
            label="SUGGEST"
            description="AI recommendations, human decides"
            color="#4da3ff"
            count={stats?.level1Count ?? 0}
            maxCount={maxLevelCount}
          />
          <div className="w-px bg-[#1a2f48] self-stretch" />
          <LevelColumn
            level={2}
            label="CONTROLLED EXECUTION"
            description="Auto-execute low risk"
            color="#4da3ff"
            count={stats?.level2Count ?? 0}
            maxCount={maxLevelCount}
          />
          <div className="w-px bg-[#1a2f48] self-stretch" />
          <LevelColumn
            level={3}
            label="FULL AUTONOMY"
            description="Pre-approved workflows only"
            color="#a855f7"
            count={stats?.level3Count ?? 0}
            maxCount={maxLevelCount}
          />
        </div>
      </div>

      {loading && (
        <div className="text-[#4d6a87] text-sm animate-pulse">Loading trust scores…</div>
      )}

      {/* TRUST SCORE TABLE */}
      {!loading && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden mb-4">
          {scores.length === 0 ? (
            <div className="p-10 text-center text-[#4d6a87] text-sm">No trust scores found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48]">
                  {[
                    'Context', 'Value', 'Composite', 'Explainability',
                    'Historical', 'Compliance', 'Override', 'Autonomy Level', 'Samples',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-[#4d6a87] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => {
                  const lvlStyle = autonomyLevelStyle(s.autonomyLevelGranted);
                  const isSelected = selectedScore?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedScore(isSelected ? null : s)}
                      className={`border-b border-[#1a2f48]/50 cursor-pointer transition-colors hover:bg-[#4da3ff]/5 ${
                        isSelected ? 'bg-[#4da3ff]/8' : ''
                      } ${i === scores.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${contextBadgeClass(s.context)}`}>
                          {s.context}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white text-xs font-medium">{s.contextValue}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-sm" style={{ color: scoreColor(s.compositeScore) }}>
                          {s.compositeScore}
                        </span>
                        <ScoreBar value={s.compositeScore} color={scoreColor(s.compositeScore)} />
                      </td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-xs">{s.explainabilityScore}</td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-xs">{s.historicalAccuracyScore}</td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-xs">{s.governanceComplianceScore}</td>
                      <td className="px-4 py-3 text-[#8ba8c7] text-xs">{s.overrideFrequencyScore}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${lvlStyle.bg} ${lvlStyle.text} ${lvlStyle.border}`}>
                          L{s.autonomyLevelGranted} {lvlStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#4d6a87] text-xs">{s.sampleCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* DETAIL PANEL */}
      {selectedScore && (
        <div className="bg-[#0d1f3a] border border-[#1a2f48] rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-tight font-semibold text-base text-white">
              {selectedScore.contextValue} Trust Breakdown
            </h3>
            <button
              type="button"
              onClick={() => setSelectedScore(null)}
              className="text-[#4d6a87] hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Factor bars */}
          <div className="space-y-3 mb-5">
            <FactorBar label="Explainability"          value={selectedScore.explainabilityScore}       />
            <FactorBar label="Benchmark Deviation"     value={selectedScore.benchmarkDeviationScore}   />
            <FactorBar label="Historical Accuracy"     value={selectedScore.historicalAccuracyScore}   />
            <FactorBar label="Governance Compliance"   value={selectedScore.governanceComplianceScore} />
            <FactorBar label="Override Frequency"      value={selectedScore.overrideFrequencyScore}    />
          </div>

          {/* Autonomy level + upgrade message */}
          <div className="flex items-center gap-4">
            {(() => {
              const lvlStyle = autonomyLevelStyle(selectedScore.autonomyLevelGranted);
              const threshold = nextLevelThreshold(selectedScore.autonomyLevelGranted);
              return (
                <>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-bold border ${lvlStyle.bg} ${lvlStyle.text} ${lvlStyle.border}`}
                  >
                    Level {selectedScore.autonomyLevelGranted} — {lvlStyle.label}
                  </span>
                  {threshold !== null ? (
                    <span className="text-xs text-[#4d6a87]">
                      → To upgrade to Level {selectedScore.autonomyLevelGranted + 1}: need composite ≥{' '}
                      <span className="text-[#f59e0b] font-semibold">{threshold}</span>
                      {' '}(current:{' '}
                      <span style={{ color: scoreColor(selectedScore.compositeScore) }} className="font-semibold">
                        {selectedScore.compositeScore}
                      </span>)
                    </span>
                  ) : (
                    <span className="text-xs text-[#22c55e]">Maximum autonomy level reached</span>
                  )}
                </>
              );
            })()}
          </div>

          <div className="mt-3 text-xs text-[#4d6a87]">
            Last updated: {timeAgo(selectedScore.updatedAt)} · {selectedScore.sampleCount} samples
          </div>
        </div>
      )}

      {/* BOTTOM FOOTER CALLOUT */}
      <div className="bg-[#0d1f3a] border-l-4 border-[#a855f7] rounded-r-xl p-4 mt-2">
        <p className="text-sm text-[#8ba8c7] leading-relaxed">
          Trust is the mechanism by which intelligence earns autonomy. Higher trust → higher autonomy → more
          efficient procurement. Lower trust → system steps back → requires human approval. This is governance
          in action.
        </p>
      </div>

      {/* ── FULL SYSTEM DELEGATION — LEVEL 4 ─────────────────────────────── */}
      {(() => {
        // Values: hardcoded for Sprint 21 (will connect to live data in Sprint 22)
        const trustScore = avgScore !== null && typeof avgScore === 'number' ? avgScore : 87.3;
        const correctnessRate = 90.0;
        const governanceClean = true;

        const trustOk   = trustScore >= 90;
        const corrOk    = correctnessRate >= 95;
        const govOk     = governanceClean;
        const criteriaMet = [trustOk, corrOk, govOk].filter(Boolean).length;
        const unlocked  = criteriaMet === 3;

        const statusColor  = unlocked ? '#22c55e' : '#f59e0b';
        const statusBg     = unlocked ? '#22c55e12' : '#f59e0b12';
        const statusBorder = unlocked ? '#22c55e30' : '#f59e0b30';

        function CriterionRow({
          met, label, current, required,
        }: { met: boolean; label: string; current: string; required: string }) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1a2f4840' }}>
              <span style={{ fontSize: 16, color: met ? '#22c55e' : '#f59e0b', flexShrink: 0, width: 20, textAlign: 'center' }}>
                {met ? '✓' : '○'}
              </span>
              <span style={{ fontSize: 13, color: '#8ba8c7', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 12, color: met ? '#22c55e' : '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {current}
              </span>
              <span style={{ fontSize: 12, color: '#4a6480', whiteSpace: 'nowrap' }}>/ {required} needed</span>
            </div>
          );
        }

        return (
          <div style={{ marginTop: 28 }}>
            <div style={{
              background: '#0b1526',
              border: `1px solid ${statusBorder}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '20px 24px 16px', borderBottom: '1px solid #1a2f48',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🔒</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', letterSpacing: '0.05em' }}>
                      LEVEL 4: FULL SYSTEM DELEGATION
                    </div>
                    <div style={{ fontSize: 12, color: '#4a6480', marginTop: 3 }}>
                      The highest autonomy tier — CFO reviews weekly summaries only
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: statusColor,
                  background: statusBg, border: `1px solid ${statusBorder}`,
                  borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {unlocked ? 'UNLOCKED' : `LOCKED — ${criteriaMet}/3 criteria met`}
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a2f48' }}>
                <p style={{ fontSize: 13, color: '#8ba8c7', lineHeight: 1.6, margin: 0 }}>
                  At Full System Delegation, the procurement OS executes all decisions autonomously —
                  supplier selection, order placement, payment scheduling, and exception handling —
                  without requiring human approval on individual transactions. Governance guardrails
                  remain active and the CFO receives weekly consolidated summaries.
                </p>
              </div>

              {/* Requirements */}
              <div style={{ padding: '16px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a6480', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Unlock Requirements
                </div>
                <CriterionRow
                  met={trustOk}
                  label="Trust Score &gt; 90"
                  current={`${trustScore.toFixed(1)}`}
                  required="90.0"
                />
                <CriterionRow
                  met={corrOk}
                  label="Decision Correctness Rate &gt; 95%"
                  current={`${correctnessRate.toFixed(0)}%`}
                  required="95%"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <span style={{ fontSize: 16, color: '#22c55e', flexShrink: 0, width: 20, textAlign: 'center' }}>✓</span>
                  <span style={{ fontSize: 13, color: '#8ba8c7', flex: 1 }}>Governance Compliance = Clean</span>
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>CLEAN</span>
                  <span style={{ fontSize: 12, color: '#4a6480' }}>/ Clean needed</span>
                </div>
              </div>

              {/* Status banner */}
              {!unlocked && (
                <div style={{
                  margin: '0 24px 20px', padding: '12px 16px',
                  background: '#f59e0b10', border: '1px solid #f59e0b30',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>
                    Unlock Condition
                  </div>
                  <div style={{ fontSize: 13, color: '#8ba8c7' }}>
                    Achieve <span style={{ color: '#f0f6ff', fontWeight: 600 }}>95%+</span> decision correctness
                    rate (currently {correctnessRate}%) and raise Trust Score to{' '}
                    <span style={{ color: '#f0f6ff', fontWeight: 600 }}>90+</span>{' '}
                    (currently {trustScore.toFixed(1)}).
                  </div>
                </div>
              )}

              {unlocked && (
                <div style={{
                  margin: '0 24px 20px', padding: '12px 16px',
                  background: '#22c55e10', border: '1px solid #22c55e30',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                    All criteria met — Full System Delegation is active.
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
