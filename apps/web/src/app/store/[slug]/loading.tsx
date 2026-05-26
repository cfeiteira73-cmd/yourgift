// ── Skeleton loader for the company store page ────────────────────────────────
// Used automatically by Next.js as the Suspense boundary for this route,
// and exported as StorePageSkeleton for inline Suspense use.

function SkeletonBox({
  width,
  height,
  borderRadius = '8px',
  style,
}: {
  width?: string;
  height: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #e8ecf2 25%, #f1f5f9 50%, #e8ecf2 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function StorePageSkeleton() {
  return (
    <div id="store-product-grid-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e8ecf2',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          {/* Image placeholder */}
          <SkeletonBox height="220px" borderRadius="0" />

          {/* Content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonBox height="18px" width="80%" />
            <SkeletonBox height="13px" width="60%" />
            <SkeletonBox height="13px" width="45%" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <SkeletonBox height="22px" width="72px" />
              <SkeletonBox height="40px" width="110px" borderRadius="10px" />
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        #store-product-grid-skeleton {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1024px) {
          #store-product-grid-skeleton { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          #store-product-grid-skeleton { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ── Default export — used by Next.js route-level loading.tsx ─────────────────

export default function StoreLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>

      {/* Hero skeleton */}
      <div
        style={{
          background: 'linear-gradient(135deg, #07111f 0%, #0d1f3c 100%)',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px 40px',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '320px' }}>
          <div style={{ height: '32px', width: '200px', borderRadius: '6px', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ height: '15px', width: '280px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>

      {/* Grid skeleton */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ height: '13px', width: '80px', borderRadius: '4px', background: '#e2e8f0' }} />
          <div style={{ height: '28px', width: '200px', borderRadius: '6px', background: '#e2e8f0' }} />
        </div>

        <StorePageSkeleton />
      </main>
    </div>
  );
}
