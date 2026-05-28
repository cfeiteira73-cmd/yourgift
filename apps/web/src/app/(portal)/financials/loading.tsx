export default function FinancialsLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '260px' }} />
        <div className="skeleton skeleton-text" style={{ width: '180px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
      </div>
      <div className="skeleton" style={{ height: '44px', borderRadius: '12px', marginBottom: '0.875rem' }} />
      <div className="skeleton" style={{ height: '220px' }} />
    </div>
  );
}
