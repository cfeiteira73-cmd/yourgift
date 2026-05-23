'use client';

// ── SkeletonText ──────────────────────────────────────────────────────────────

interface SkeletonTextProps {
  width?: string;
  height?: string;
}

export function SkeletonText({ width = '100%', height = '14px' }: SkeletonTextProps) {
  return (
    <div
      className="skeleton rounded"
      style={{ width, height }}
    />
  );
}

// ── SkeletonKpiCard ───────────────────────────────────────────────────────────

export function SkeletonKpiCard() {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 flex flex-col gap-3">
      {/* Title */}
      <SkeletonText width="45%" height="12px" />
      {/* Value */}
      <SkeletonText width="60%" height="32px" />
      {/* Sparkline */}
      <SkeletonText width="100%" height="36px" />
    </div>
  );
}

// ── SkeletonTableRow ──────────────────────────────────────────────────────────

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1a2f48]">
      <div className="skeleton rounded" style={{ width: '20%', height: '13px' }} />
      <div className="skeleton rounded" style={{ width: '18%', height: '13px' }} />
      <div className="skeleton rounded" style={{ width: '22%', height: '13px' }} />
      <div className="skeleton rounded" style={{ width: '15%', height: '13px' }} />
      <div className="skeleton rounded" style={{ width: '12%', height: '13px' }} />
    </div>
  );
}

// ── SkeletonTable ─────────────────────────────────────────────────────────────

interface SkeletonTableProps {
  count?: number;
}

export function SkeletonTable({ count = 5 }: SkeletonTableProps) {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#1a2f48] bg-[#102131]">
        <div className="skeleton rounded" style={{ width: '18%', height: '11px' }} />
        <div className="skeleton rounded" style={{ width: '20%', height: '11px' }} />
        <div className="skeleton rounded" style={{ width: '16%', height: '11px' }} />
        <div className="skeleton rounded" style={{ width: '14%', height: '11px' }} />
        <div className="skeleton rounded" style={{ width: '10%', height: '11px' }} />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

// ── SkeletonPanel ─────────────────────────────────────────────────────────────

export function SkeletonPanel() {
  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5 flex flex-col gap-4">
      {/* Title */}
      <SkeletonText width="35%" height="16px" />
      {/* Content lines */}
      <SkeletonText width="100%" height="13px" />
      <SkeletonText width="88%" height="13px" />
      <SkeletonText width="72%" height="13px" />
    </div>
  );
}
