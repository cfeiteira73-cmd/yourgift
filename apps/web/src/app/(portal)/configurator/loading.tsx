// ── OMEGA PROTOCOL — S14: Streaming — Visual Product Builder skeleton ─────────

export default function ConfiguratorLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div className="skeleton skeleton-text" style={{ width: '180px', marginBottom: '0.5rem' }} />
        <div className="skeleton skeleton-title" style={{ width: '280px', marginBottom: '0.4rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '220px' }} />
      </div>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: i < 3 ? 1 : 'none' }}>
            <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
            <div className="skeleton skeleton-text" style={{ width: '70px' }} />
            {i < 3 && <div className="skeleton" style={{ flex: 1, height: '1px' }} />}
          </div>
        ))}
      </div>
      {/* Search bar + filter row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="skeleton" style={{ flex: 1, height: '40px', borderRadius: '10px' }} />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton" style={{ width: '80px', height: '40px', borderRadius: '8px' }} />
        ))}
      </div>
      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.75rem' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '16px' }} />
        ))}
      </div>
    </div>
  );
}
