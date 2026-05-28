// ── S14: Route streaming — Cockpit skeleton ───────────────────────────────────
export default function CockpitLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className="skeleton skeleton-title" style={{ width: '220px' }} />
          <div className="skeleton skeleton-text" style={{ width: '160px' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '42px', height: '30px', borderRadius: '8px' }} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div className="skeleton" style={{ height: '220px' }} />
        <div className="skeleton" style={{ height: '220px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.75rem' }}>
        <div className="skeleton" style={{ height: '260px' }} />
        <div className="skeleton" style={{ height: '260px' }} />
      </div>
    </div>
  );
}
