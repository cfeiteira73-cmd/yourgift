'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string | null;
  version: number;
  triggerEvent: string;
  dag: StepDefinition[];
  isActive: boolean;
  timeoutSeconds: number;
  createdAt: string;
}

interface StepDefinition {
  id: string;
  name: string;
  action: string;
  nextOnSuccess: string | null;
  nextOnFail: string | null;
  canCompensate: boolean;
  maxAttempts: number;
}

interface WorkflowStepState {
  id: string;
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated' | 'skipped';
  attempt: number;
  maxAttempts: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface WorkflowInstance {
  id: string;
  definitionId: string;
  definitionName: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  currentStep: string | null;
  context: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  steps: WorkflowStepState[];
  definition?: WorkflowDefinition;
}

interface WorkflowStats {
  total: number;
  byStatus: Record<string, number>;
}

interface LearningStats {
  totalOutcomes: number;
  incorporated: number;
  incorporationRate: number;
  byType: Record<string, { count: number; avgDelta: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const STEP_COLORS: Record<string, string> = {
  completed: '#22c55e',
  running: '#4da3ff',
  failed: '#ef4444',
  pending: '#4d6a87',
  compensated: '#f59e0b',
  skipped: '#6b7280',
};

function statusBg(status: string): string {
  const map: Record<string, string> = {
    running: 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
    completed: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
    failed: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
    compensating: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
  };
  return map[status] ?? 'bg-[#1a2f48] text-[#8ba8c7] border-[#1a2f48]';
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── DAG Step Timeline ─────────────────────────────────────────────────────────

function StepTimeline({ dag, steps }: { dag: StepDefinition[]; steps: WorkflowStepState[] }) {
  const stepMap = Object.fromEntries(steps.map(s => [s.stepId, s]));
  const [tooltip, setTooltip] = useState<{ stepId: string; x: number; y: number } | null>(null);

  const cx = 20;
  const cy = 20;
  const r = 10;
  const gap = 60;
  const totalWidth = dag.length * gap;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${totalWidth} 40`}
        width="100%"
        height="40"
        style={{ overflow: 'visible' }}
      >
        {/* Connecting lines */}
        {dag.slice(0, -1).map((step, i) => {
          const x1 = cx + i * gap + r;
          const x2 = cx + (i + 1) * gap - r;
          const state = stepMap[step.id];
          const color = state ? STEP_COLORS[state.status] ?? STEP_COLORS.pending : STEP_COLORS.pending;
          return (
            <line key={step.id + '-line'} x1={x1} y1={cy} x2={x2} y2={cy} stroke={color} strokeWidth="2" />
          );
        })}

        {/* Step circles */}
        {dag.map((step, i) => {
          const x = cx + i * gap;
          const state = stepMap[step.id];
          const color = state ? STEP_COLORS[state.status] ?? STEP_COLORS.pending : STEP_COLORS.pending;
          const isRunning = state?.status === 'running';

          return (
            <g
              key={step.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as SVGGElement).closest('svg')?.getBoundingClientRect();
                if (rect) {
                  setTooltip({ stepId: step.id, x: rect.left + x, y: rect.top - 10 });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {isRunning && (
                <circle cx={x} cy={cy} r={r + 4} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4">
                  <animate attributeName="r" from={r + 2} to={r + 8} dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={x} cy={cy} r={r} fill={color} />
              {state?.status === 'completed' && (
                <path
                  d={`M${x - 4} ${cy} l3 3 5-5`}
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {state?.status === 'failed' && (
                <>
                  <line x1={x - 4} y1={cy - 4} x2={x + 4} y2={cy + 4} stroke="white" strokeWidth="1.5" />
                  <line x1={x + 4} y1={cy - 4} x2={x - 4} y2={cy + 4} stroke="white" strokeWidth="1.5" />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (() => {
        const step = dag.find(s => s.id === tooltip.stepId);
        const state = stepMap[tooltip.stepId];
        if (!step) return null;
        return (
          <div
            className="fixed z-50 px-3 py-2 rounded-lg border border-[#1a2f48] bg-[#0b1526] text-xs text-[#f0f6ff] shadow-xl pointer-events-none"
            style={{ left: tooltip.x - 60, top: tooltip.y - 80 }}
          >
            <p className="font-semibold">{step.name}</p>
            <p className="text-[#8ba8c7]">{state?.status ?? 'pending'}</p>
            {state?.attempt && state.attempt > 1 && (
              <p className="text-[#f59e0b]">Attempt {state.attempt}/{state.maxAttempts}</p>
            )}
            {state?.error && <p className="text-[#ef4444] mt-1 max-w-[200px] truncate">{state.error}</p>}
          </div>
        );
      })()}

      {/* Step labels */}
      <div className="flex mt-1" style={{ gap: 0 }}>
        {dag.map((step, i) => (
          <div
            key={step.id}
            className="text-[9px] text-[#4d6a87] text-center"
            style={{ width: `${100 / dag.length}%`, paddingLeft: i === 0 ? 0 : undefined }}
          >
            {step.name.length > 10 ? step.name.slice(0, 9) + '…' : step.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step Detail Cards ─────────────────────────────────────────────────────────

function StepCard({ step }: { step: WorkflowStepState }) {
  const [expanded, setExpanded] = useState(false);
  const color = STEP_COLORS[step.status] ?? STEP_COLORS.pending;

  return (
    <div className="border border-[#1a2f48] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0d1f3a] transition-colors"
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-[#f0f6ff] flex-1">{step.stepName}</span>
        <span className="text-xs text-[#8ba8c7]">
          {step.attempt > 1 ? `attempt ${step.attempt}/${step.maxAttempts} · ` : ''}
          {step.status}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4d6a87" strokeWidth="1.5"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1a2f48]">
          {step.error && (
            <div className="mt-3 p-3 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 text-xs text-[#ef4444] font-mono break-all">
              {step.error}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Input</p>
              <pre className="text-[10px] text-[#8ba8c7] bg-[#07111f] p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Output</p>
              <pre className="text-[10px] text-[#8ba8c7] bg-[#07111f] p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          </div>
          {step.startedAt && (
            <p className="text-[10px] text-[#4d6a87]">
              Started: {new Date(step.startedAt).toLocaleTimeString()}
              {step.completedAt && ` · Completed: ${new Date(step.completedAt).toLocaleTimeString()}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Learning Stats Panel ──────────────────────────────────────────────────────

function LearningPanel({ stats }: { stats: LearningStats | null }) {
  const [open, setOpen] = useState(false);
  if (!stats) return null;

  return (
    <div className="border border-[#1a2f48] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#0d1f3a] transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#4da3ff" strokeWidth="1.5" width="16" height="16">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
        </svg>
        <span className="text-sm font-semibold text-[#f0f6ff] flex-1 text-left">Learning Loop Stats</span>
        <span className="text-xs text-[#8ba8c7]">{stats.incorporationRate}% incorporated</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4d6a87" strokeWidth="1.5"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#1a2f48] pt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#07111f] rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Total Outcomes</p>
              <p className="text-xl font-bold text-[#f0f6ff]">{stats.totalOutcomes}</p>
            </div>
            <div className="bg-[#07111f] rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Incorporated</p>
              <p className="text-xl font-bold text-[#22c55e]">{stats.incorporated}</p>
            </div>
            <div className="bg-[#07111f] rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">Rate</p>
              <p className="text-xl font-bold text-[#4da3ff]">{stats.incorporationRate}%</p>
            </div>
          </div>

          {Object.keys(stats.byType).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">By Type</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#4d6a87] text-left">
                    <th className="pb-1 font-medium">Type</th>
                    <th className="pb-1 font-medium text-right">Count</th>
                    <th className="pb-1 font-medium text-right">Avg Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.byType).map(([type, data]) => (
                    <tr key={type} className="border-t border-[#1a2f48]">
                      <td className="py-1.5 text-[#f0f6ff] font-mono">{type}</td>
                      <td className="py-1.5 text-right text-[#8ba8c7]">{data.count}</td>
                      <td className={`py-1.5 text-right font-mono ${data.avgDelta > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                        {data.avgDelta > 0 ? '+' : ''}{data.avgDelta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchAll = useCallback(async () => {
    try {
      const [defsRes, instancesRes, statsRes, learnRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/workflows/definitions`, { headers }),
        fetch(`${API_BASE}/api/v1/workflows/instances?limit=50`, { headers }),
        fetch(`${API_BASE}/api/v1/workflows/stats`, { headers }),
        fetch(`${API_BASE}/api/v1/workflows/learning/stats`, { headers }),
      ]);

      if (defsRes.ok) setDefinitions(await defsRes.json() as WorkflowDefinition[]);
      if (instancesRes.ok) setInstances(await instancesRes.json() as WorkflowInstance[]);
      if (statsRes.ok) setStats(await statsRes.json() as WorkflowStats);
      if (learnRes.ok) setLearningStats(await learnRes.json() as LearningStats);
    } catch {
      // silently ignore network errors on background refresh
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstance = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workflows/instances/${id}`, { headers });
      if (res.ok) setSelectedInstance(await res.json() as WorkflowInstance);
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleRetry(instanceId: string) {
    setRetrying(instanceId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workflows/instances/${instanceId}/retry`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        await fetchAll();
        if (selectedInstance?.id === instanceId) await fetchInstance(instanceId);
      }
    } finally {
      setRetrying(null);
    }
  }

  const statusCounts = stats?.byStatus ?? {};
  const running = statusCounts['running'] ?? 0;
  const completed = statusCounts['completed'] ?? 0;
  const failed = statusCounts['failed'] ?? 0;

  const selectedDag = selectedInstance?.definition?.dag ?? definitions.find(d => d.id === selectedInstance?.definitionId)?.dag ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
        <div className="flex gap-2 items-center text-[#8ba8c7]">
          <div className="w-4 h-4 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
          Loading workflows…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#f0f6ff]">Workflow Engine</h1>
          <p className="text-sm text-[#8ba8c7] mt-0.5">DAG-based orchestration with autonomous learning loop</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4da3ff]/10 border border-[#4da3ff]/20 text-xs font-semibold text-[#4da3ff]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4da3ff] animate-pulse" />
            {running} running
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 text-xs font-semibold text-[#22c55e]">
            {completed} completed
          </div>
          {failed > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/20 text-xs font-semibold text-[#ef4444]">
              {failed} failed
            </div>
          )}
          <span className="text-xs text-[#4d6a87]">auto-refresh 15s</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Left: Definitions + Instances */}
        <div className="w-[30%] min-w-[240px] space-y-4">
          {/* Definitions */}
          <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2f48]">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87]">Definitions</p>
            </div>
            <div className="divide-y divide-[#1a2f48]">
              {definitions.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#4d6a87] text-center">No definitions</p>
              )}
              {definitions.map(def => (
                <div key={def.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#f0f6ff] truncate">{def.name}</p>
                      <p className="text-xs text-[#8ba8c7] mt-0.5 truncate">trigger: {def.triggerEvent}</p>
                      <p className="text-xs text-[#4d6a87] mt-0.5">{def.dag.length} steps</p>
                    </div>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      def.isActive
                        ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'
                        : 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20'
                    }`}>
                      {def.isActive ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Instances */}
          <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2f48]">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87]">Recent Instances</p>
            </div>
            <div className="divide-y divide-[#1a2f48] max-h-[420px] overflow-y-auto">
              {instances.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#4d6a87] text-center">No instances yet</p>
              )}
              {instances.map(inst => {
                const doneSteps = inst.steps.filter(s => s.status === 'completed').length;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => {
                      setSelectedInstance(inst);
                      void fetchInstance(inst.id);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-[#0d1f3a] transition-colors ${
                      selectedInstance?.id === inst.id ? 'bg-[#0d1f3a] border-l-2 border-[#4da3ff]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-[#f0f6ff] truncate">{inst.definitionName}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusBg(inst.status)}`}>
                        {inst.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#4d6a87]">
                      <span>{timeAgo(inst.startedAt)}</span>
                      <span>{doneSteps}/{inst.steps.length} steps</span>
                    </div>
                    {inst.status === 'failed' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleRetry(inst.id); }}
                        disabled={retrying === inst.id}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-[#4da3ff]/10 border border-[#4da3ff]/20 text-[10px] font-semibold text-[#4da3ff] hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
                      >
                        {retrying === inst.id ? (
                          <div className="w-3 h-3 border border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M5 1a4 4 0 1 0 3.46 2" />
                            <path d="M8.5 1v2.5H6" />
                          </svg>
                        )}
                        Retry
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Instance Detail */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selectedInstance ? (
            <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] flex items-center justify-center h-64">
              <div className="text-center text-[#4d6a87]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="40" height="40" className="mx-auto mb-3 opacity-30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <p className="text-sm">Select an instance to inspect</p>
              </div>
            </div>
          ) : (
            <>
              {/* Instance Header */}
              <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#f0f6ff]">{selectedInstance.definitionName}</h2>
                    <p className="text-xs text-[#4d6a87] font-mono mt-0.5">{selectedInstance.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusBg(selectedInstance.status)}`}>
                      {selectedInstance.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-[#8ba8c7]">
                      {formatDuration(selectedInstance.startedAt, selectedInstance.completedAt)}
                    </span>
                  </div>
                </div>

                {/* DAG Timeline */}
                {selectedDag.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-3">DAG Progress</p>
                    <StepTimeline dag={selectedDag} steps={selectedInstance.steps} />
                  </div>
                )}

                {selectedInstance.error && (
                  <div className="mt-4 p-3 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 text-sm text-[#ef4444]">
                    {selectedInstance.error}
                  </div>
                )}

                {selectedInstance.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => void handleRetry(selectedInstance.id)}
                    disabled={retrying === selectedInstance.id}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-sm font-semibold text-[#4da3ff] hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors"
                  >
                    {retrying === selectedInstance.id ? (
                      <div className="w-4 h-4 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M7 1a6 6 0 1 0 5.2 3" />
                        <path d="M12 1v3.5H8.5" />
                      </svg>
                    )}
                    Retry Workflow
                  </button>
                )}
              </div>

              {/* Step Cards */}
              {selectedInstance.steps.length > 0 && (
                <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1a2f48]">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87]">Step Details</p>
                  </div>
                  <div className="p-4 space-y-2">
                    {selectedInstance.steps.map(step => (
                      <StepCard key={step.id} step={step} />
                    ))}
                  </div>
                </div>
              )}

              {/* Context */}
              <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1a2f48]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#4d6a87]">Accumulated Context</p>
                </div>
                <pre className="p-4 text-[11px] text-[#8ba8c7] overflow-auto max-h-48 font-mono">
                  {JSON.stringify(selectedInstance.context, null, 2)}
                </pre>
              </div>
            </>
          )}

          {/* Learning Stats */}
          <LearningPanel stats={learningStats} />
        </div>
      </div>
    </div>
  );
}
