'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  service: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: string;
}

interface ReliabilitySnapshot {
  overallScore: number;
  apiReliability: number;
  queueReliability: number;
  supplierStability: number;
  authReliability: number;
  financialIntegrity: number;
}

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number; // radius (traffic relative size)
  group: string;
}

interface EdgeDef {
  from: string;
  to: string;
}

// ── Static graph layout ───────────────────────────────────────────────────────

const NODES: NodeDef[] = [
  // Layer 1 — CDN
  { id: 'cloudflare', label: 'Cloudflare', x: 400, y: 60,  r: 28, group: 'cdn'      },
  // Layer 2 — Apps
  { id: 'web',        label: 'Web',        x: 230, y: 160, r: 22, group: 'app'      },
  { id: 'api',        label: 'API',        x: 400, y: 160, r: 26, group: 'app'      },
  { id: 'admin',      label: 'Admin',      x: 570, y: 160, r: 18, group: 'app'      },
  // Layer 3 — Middleware
  { id: 'auth',       label: 'Auth',       x: 140, y: 290, r: 20, group: 'middleware' },
  { id: 'bullmq',     label: 'BullMQ',     x: 310, y: 290, r: 22, group: 'middleware' },
  { id: 'stripe',     label: 'Stripe',     x: 490, y: 290, r: 20, group: 'external'   },
  { id: 'scim',       label: 'SCIM',       x: 660, y: 290, r: 16, group: 'middleware' },
  // Layer 4 — Data + External
  { id: 'supabase',   label: 'Supabase',   x: 160, y: 420, r: 24, group: 'data'     },
  { id: 's3',         label: 'S3',         x: 310, y: 420, r: 20, group: 'data'     },
  { id: 'resend',     label: 'Resend',     x: 455, y: 420, r: 18, group: 'external' },
  { id: 'midocean',   label: 'Midocean',   x: 600, y: 420, r: 20, group: 'external' },
  { id: 'workflows',  label: 'Workflows',  x: 400, y: 510, r: 16, group: 'middleware' },
];

const EDGES: EdgeDef[] = [
  { from: 'cloudflare', to: 'web'      },
  { from: 'cloudflare', to: 'api'      },
  { from: 'cloudflare', to: 'admin'    },
  { from: 'web',        to: 'api'      },
  { from: 'admin',      to: 'api'      },
  { from: 'api',        to: 'auth'     },
  { from: 'api',        to: 'bullmq'   },
  { from: 'api',        to: 'stripe'   },
  { from: 'api',        to: 'scim'     },
  { from: 'api',        to: 'supabase' },
  { from: 'api',        to: 's3'       },
  { from: 'api',        to: 'resend'   },
  { from: 'api',        to: 'midocean' },
  { from: 'bullmq',     to: 'supabase' },
  { from: 'bullmq',     to: 'workflows'},
  { from: 'auth',       to: 'supabase' },
  { from: 'workflows',  to: 'resend'   },
  { from: 'workflows',  to: 'midocean' },
];

const GROUP_BASE_COLORS: Record<string, string> = {
  cdn:        '#4da3ff',
  app:        '#63e6be',
  middleware: '#a78bfa',
  data:       '#fbbf24',
  external:   '#f97316',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}` };
}

function stateColor(state: CircuitState | undefined): string {
  if (!state || state === 'CLOSED') return '#63e6be';
  if (state === 'HALF_OPEN') return '#f59e0b';
  return '#ef4444';
}

function nodePosition(id: string): { x: number; y: number; r: number } {
  const n = NODES.find((nd) => nd.id === id);
  return n ?? { x: 0, y: 0, r: 18 };
}

// ── SVG Graph ─────────────────────────────────────────────────────────────────

function TopologyGraph({
  breakerMap,
  onSelectNode,
  selectedId,
}: {
  breakerMap: Map<string, CircuitBreaker>;
  onSelectNode: (id: string | null) => void;
  selectedId: string | null;
}) {
  return (
    <svg
      viewBox="0 0 800 570"
      className="w-full h-auto"
      style={{ maxHeight: '580px' }}
    >
      {/* Edges */}
      {EDGES.map((edge, i) => {
        const from = nodePosition(edge.from);
        const to = nodePosition(edge.to);
        const isActiveEdge =
          selectedId === edge.from || selectedId === edge.to;
        return (
          <line
            key={i}
            x1={from.x} y1={from.y}
            x2={to.x} y2={to.y}
            stroke={isActiveEdge ? '#4da3ff' : '#1a2f48'}
            strokeWidth={isActiveEdge ? 1.5 : 1}
            opacity={isActiveEdge ? 0.8 : 0.5}
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((node) => {
        const breaker = breakerMap.get(node.id);
        const health = stateColor(breaker?.state);
        const isSelected = selectedId === node.id;
        const isOpen = breaker?.state === 'OPEN';
        const baseColor = GROUP_BASE_COLORS[node.group] ?? '#4d6a87';

        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
          >
            {/* Pulse ring for OPEN circuits */}
            {isOpen && (
              <circle
                cx={node.x} cy={node.y} r={node.r + 8}
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.5"
                opacity="0.4"
              >
                <animate attributeName="r" values={`${node.r + 4};${node.r + 14};${node.r + 4}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Selection ring */}
            {isSelected && (
              <circle cx={node.x} cy={node.y} r={node.r + 5} fill="none" stroke="#4da3ff" strokeWidth="2" opacity="0.6" />
            )}

            {/* Node circle */}
            <circle
              cx={node.x} cy={node.y} r={node.r}
              fill={`${baseColor}18`}
              stroke={health}
              strokeWidth={isSelected ? 2.5 : 1.5}
              style={{ filter: isSelected ? `drop-shadow(0 0 8px ${health}80)` : undefined }}
            />

            {/* Health dot */}
            <circle
              cx={node.x + node.r * 0.6} cy={node.y - node.r * 0.6} r={4}
              fill={health}
              stroke="#07111f"
              strokeWidth="1"
            />

            {/* Label */}
            <text
              x={node.x} y={node.y + 4}
              textAnchor="middle"
              fill="#cfe4ff"
              fontSize={node.r > 20 ? '9' : '8'}
              fontWeight="600"
              fontFamily="monospace"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Node Detail Panel ─────────────────────────────────────────────────────────

function NodeDetail({ nodeId, breakerMap }: { nodeId: string; breakerMap: Map<string, CircuitBreaker> }) {
  const node = NODES.find((n) => n.id === nodeId);
  const breaker = breakerMap.get(nodeId);
  if (!node) return null;

  const health = stateColor(breaker?.state);
  const connectedEdges = EDGES.filter((e) => e.from === nodeId || e.to === nodeId);

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: health }} />
        <span className="text-[14px] font-semibold text-[#f0f6ff]">{node.label}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded capitalize text-[#4d6a87] bg-[#1a2f48]">{node.group}</span>
      </div>

      {breaker ? (
        <div className="space-y-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-[#4d6a87]">Circuit State</span>
            <span className="font-semibold" style={{ color: health }}>{breaker.state}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[#4d6a87]">Failure Count</span>
            <span className="font-mono" style={{ color: breaker.failureCount > 0 ? '#ef4444' : '#63e6be' }}>{breaker.failureCount}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[#4d6a87]">Successes</span>
            <span className="font-mono text-[#63e6be]">{breaker.successCount}</span>
          </div>
          {breaker.lastFailureTime && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[#4d6a87]">Last Failure</span>
              <span className="text-[#8ba8c7]">{new Date(breaker.lastFailureTime).toLocaleTimeString('pt-PT')}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[12px] text-[#63e6be]">No circuit data — presumed healthy</div>
      )}

      <div className="border-t border-[#1a2f48] pt-2">
        <div className="text-[10px] text-[#4d6a87] uppercase tracking-wider mb-1.5">Connected To</div>
        <div className="flex flex-wrap gap-1.5">
          {connectedEdges.map((e, i) => {
            const otherId = e.from === nodeId ? e.to : e.from;
            const otherNode = NODES.find((n) => n.id === otherId);
            const dir = e.from === nodeId ? '→' : '←';
            return (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#1a2f48] text-[#8ba8c7]">
                {dir} {otherNode?.label ?? otherId}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TopologyPage() {
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [reliability, setReliability] = useState<ReliabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const [cbRes, relRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/recovery/circuit-breakers`, { headers: h }),
      fetch(`${API_BASE}/api/v1/reliability/latest`, { headers: h }),
    ]);
    if (cbRes.status === 'fulfilled' && cbRes.value.ok) {
      const data = await cbRes.value.json() as { breakers: CircuitBreaker[] };
      setBreakers(data.breakers ?? []);
    }
    if (relRes.status === 'fulfilled' && relRes.value.ok) {
      setReliability(await relRes.value.json() as ReliabilitySnapshot);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const breakerMap = new Map<string, CircuitBreaker>(breakers.map((b) => [b.service.toLowerCase(), b]));

  const openCount = breakers.filter((b) => b.state === 'OPEN').length;
  const halfOpenCount = breakers.filter((b) => b.state === 'HALF_OPEN').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[#4da3ff]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="2" />
              <circle cx="2" cy="3" r="1.5" />
              <circle cx="16" cy="3" r="1.5" />
              <circle cx="2" cy="15" r="1.5" />
              <circle cx="16" cy="15" r="1.5" />
              <line x1="3.5" y1="3.5" x2="7.5" y2="7.5" />
              <line x1="14.5" y1="3.5" x2="10.5" y2="7.5" />
              <line x1="3.5" y1="14.5" x2="7.5" y2="10.5" />
              <line x1="14.5" y1="14.5" x2="10.5" y2="10.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Operational Topology</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              Service dependency graph · circuit health overlay · auto-refresh 30s
              {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('pt-PT')}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void fetchData(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7] text-[11px] transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {reliability && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-xl">
            <span className="text-[11px] text-[#4d6a87]">Trust Score</span>
            <span
              className="text-[16px] font-bold tabular-nums"
              style={{ color: reliability.overallScore >= 95 ? '#63e6be' : reliability.overallScore >= 80 ? '#f59e0b' : '#ef4444' }}
            >
              {reliability.overallScore}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0b1526] border border-[openCount > 0 ? '#ef4444' : '#1a2f48'] rounded-xl" style={{ borderColor: openCount > 0 ? '#ef4444' : '#1a2f48' }}>
          <span className="text-[11px] text-[#4d6a87]">Open Circuits</span>
          <span className="text-[16px] font-bold tabular-nums" style={{ color: openCount > 0 ? '#ef4444' : '#63e6be' }}>{openCount}</span>
        </div>
        {halfOpenCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0b1526] border border-[#f59e0b] rounded-xl">
            <span className="text-[11px] text-[#4d6a87]">Half-Open</span>
            <span className="text-[16px] font-bold tabular-nums text-[#f59e0b]">{halfOpenCount}</span>
          </div>
        )}
        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-[10px] text-[#4d6a87]">
          {[{ color: '#63e6be', label: 'Healthy' }, { color: '#f59e0b', label: 'Half-Open' }, { color: '#ef4444', label: 'Open Circuit' }].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-[#4d6a87] bg-transparent" style={{ transform: 'scale(1.5)' }} />
            Size = traffic
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-4">
        {/* SVG graph */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-[#4d6a87] text-[13px]">
              <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
              Loading topology…
            </div>
          ) : (
            <TopologyGraph breakerMap={breakerMap} onSelectNode={setSelectedNode} selectedId={selectedNode} />
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-3">
          {/* Selected node detail */}
          {selectedNode ? (
            <NodeDetail nodeId={selectedNode} breakerMap={breakerMap} />
          ) : (
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 text-[12px] text-[#4d6a87] text-center">
              Click a node to view details
            </div>
          )}

          {/* Service list */}
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1a2f48] text-[10px] font-semibold text-[#4d6a87] uppercase tracking-wider">
              All Services
            </div>
            {NODES.map((node) => {
              const breaker = breakerMap.get(node.id);
              const health = stateColor(breaker?.state);
              const isSelected = selectedNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/50 transition-colors text-left ${isSelected ? 'bg-[#0d1f3a]' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: health }} />
                  <span className="flex-1 text-[12px] text-[#cfe4ff]">{node.label}</span>
                  {breaker?.state && breaker.state !== 'CLOSED' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${health}15`, color: health }}>
                      {breaker.state === 'OPEN' ? 'OPEN' : 'H-O'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
