export default function OpsCenterLoading() {
  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header skeleton */}
      <div className="skeleton-dark" style={{ height: 28, width: 260, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton-dark" style={{ height: 16, width: 340, borderRadius: 6, marginBottom: 32 }} />

      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-dark" style={{ height: 36, width: 100, borderRadius: 8 }} />
        ))}
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-dark" style={{ height: 96, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );
}
