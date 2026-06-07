'use client';

import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

// ── ManufacturingHeatmap ──────────────────────────────────────────────────────
//
// Visual production load heatmap for the Manufacturing OS.
// Shows order distribution across production stages with SLA color coding.
// GPU-accelerated, real-time data, no mocks.
//
// Used by: /production page
//
// ─────────────────────────────────────────────────────────────────────────────

interface StageData {
  key: string;
  label: string;
  count: number;
  capacity: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  totalValue: number;
  avgHours: number;
}

interface ManufacturingHeatmapProps {
  stages: StageData[];
  loading?: boolean;
}

function CapacityBar({ used, capacity, criticalCount, warningCount }: {
  used: number; capacity: number; criticalCount: number; warningCount: number;
}) {
  const pct = Math.min(100, capacity > 0 ? (used / capacity) * 100 : 0);
  const color = pct > 90 ? 'rgb(239,68,68)' : pct > 70 ? 'rgb(245,158,11)' : '#b8975e';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
          {used}/{capacity} unidades
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(240,236,228,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...springSnappy, delay: 0.2 }}
          style={{ height: '100%', background: color, borderRadius: 9999 }}
        />
      </div>
      {(criticalCount > 0 || warningCount > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {criticalCount > 0 && (
            <span style={{ fontSize: 10, color: 'rgb(239,68,68)', fontWeight: 600 }}>
              ⚠ {criticalCount} SLA violado
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ fontSize: 10, color: 'rgb(245,158,11)', fontWeight: 600 }}>
              ◐ {warningCount} em risco
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ManufacturingHeatmap({ stages, loading }: ManufacturingHeatmapProps) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-dark" style={{ height: 120, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {stages.map((stage, i) => {
          const intensity = stage.count / maxCount; // 0–1
          const hasCritical = stage.criticalCount > 0;
          const hasWarning = stage.warningCount > 0;
          const borderColor = hasCritical
            ? 'rgba(239,68,68,0.35)'
            : hasWarning
            ? 'rgba(245,158,11,0.3)'
            : 'rgba(240,236,228,0.06)';

          // Heatmap background: intensity drives opacity
          const heatBg = hasCritical
            ? `rgba(239,68,68,${0.04 + intensity * 0.1})`
            : hasWarning
            ? `rgba(245,158,11,${0.04 + intensity * 0.08})`
            : `rgba(154,124,74,${0.03 + intensity * 0.07})`;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...springSnappy, delay: i * 0.05 }}
              whileHover={{ y: -2, scale: 1.02 }}
              style={{
                background: heatBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'default',
                transform: 'translateZ(0)',
                willChange: 'transform',
              }}
            >
              {/* Stage header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  {stage.label}
                </span>
                <motion.span
                  key={stage.count}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    fontSize: 20, fontWeight: 800,
                    color: hasCritical ? 'rgb(239,68,68)' : hasWarning ? 'rgb(245,158,11)' : '#f0ece4',
                  }}
                >
                  {stage.count}
                </motion.span>
              </div>

              {/* Value */}
              {stage.totalValue > 0 && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(stage.totalValue)}
                </p>
              )}

              {/* Capacity bar */}
              {stage.capacity > 0 && (
                <CapacityBar
                  used={stage.count}
                  capacity={stage.capacity}
                  criticalCount={stage.criticalCount}
                  warningCount={stage.warningCount}
                />
              )}

              {/* Avg hours */}
              {stage.avgHours > 0 && (
                <p style={{ fontSize: 10, color: 'rgba(240,236,228,0.22)', marginTop: 6 }}>
                  Média {stage.avgHours.toFixed(1)}h em estágio
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Flow diagram */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {stages.map((stage, i) => {
          const pct = Math.round((stage.count / (stages.reduce((s, x) => s + x.count, 0) || 1)) * 100);
          const hasCritical = stage.criticalCount > 0;
          const color = hasCritical ? 'rgb(239,68,68)' : stage.warningCount > 0 ? 'rgb(245,158,11)' : 'rgba(184,151,94,0.55)';
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, minWidth: 60,
              }}>
                <div style={{ height: 3, background: color, borderRadius: 9999, width: `${Math.max(8, pct * 0.8)}px`, transition: 'width 0.5s ease' }} />
                <span style={{ fontSize: 9, color: 'rgba(240,236,228,0.28)', whiteSpace: 'nowrap' }}>
                  {stage.label.slice(0, 8)} ({stage.count})
                </span>
              </div>
              {i < stages.length - 1 && (
                <span style={{ color: 'rgba(240,236,228,0.14)', fontSize: 10 }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SLA Timeline Chart ─────────────────────────────────────────────────────────

interface SLATimelineItem {
  label: string;
  hoursElapsed: number;
  hoursExpected: number;
  status: 'ok' | 'warning' | 'critical';
}

interface SLATimelineProps {
  items: SLATimelineItem[];
}

export function SLATimeline({ items }: SLATimelineProps) {
  if (!items.length) return null;
  const maxH = Math.max(...items.map(i => Math.max(i.hoursElapsed, i.hoursExpected)), 1);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, paddingTop: 8 }}>
      {items.map((item, i) => {
        const elapsedPct = (item.hoursElapsed / maxH) * 100;
        const expectedPct = (item.hoursExpected / maxH) * 100;
        const barColor = item.status === 'critical' ? 'rgb(239,68,68)' : item.status === 'warning' ? 'rgb(245,158,11)' : '#d4b47a';
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 28 }}>
            {/* Expected line */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'flex-end', position: 'relative' }}>
              <div style={{
                width: '40%', background: 'rgba(240,236,228,0.10)', borderRadius: '2px 2px 0 0',
                height: `${expectedPct}%`, position: 'absolute', bottom: 0,
              }} />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${elapsedPct}%` }}
                transition={{ ...springSnappy, delay: i * 0.04 }}
                style={{
                  width: '60%', background: barColor, borderRadius: '2px 2px 0 0',
                  position: 'absolute', bottom: 0, opacity: 0.85,
                }}
              />
            </div>
            <span style={{ fontSize: 8, color: 'rgba(240,236,228,0.28)', textAlign: 'center', lineHeight: 1.2 }}>
              {item.label.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
