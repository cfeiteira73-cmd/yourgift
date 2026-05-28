export default function StrategistLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '300px' }} />
        <div className="skeleton skeleton-text" style={{ width: '200px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0.875rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="skeleton" style={{ height: '44px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '320px' }} />
        </div>
        <div className="skeleton" style={{ height: '580px' }} />
      </div>
    </div>
  );
}
