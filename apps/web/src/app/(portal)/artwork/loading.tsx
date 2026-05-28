// ── OMEGA PROTOCOL — S14: Streaming — Artwork Approvals skeleton ──────────────

export default function ArtworkLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1300px' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '280px', marginBottom: '0.4rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '340px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ width: '70px', height: '28px', borderRadius: '8px' }} />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '12px' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton skeleton-card" style={{ borderRadius: '16px', height: '320px' }} />
          <div className="skeleton skeleton-card" style={{ borderRadius: '16px', height: '160px' }} />
        </div>
      </div>
    </div>
  );
}
