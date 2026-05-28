export default function RunbooksLoading() {
  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '240px' }} />
        <div className="skeleton skeleton-text" style={{ width: '320px' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1rem' }}>
        <div className="skeleton" style={{ flex: 1, height: '38px', borderRadius: '10px' }} />
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '80px', height: '38px', borderRadius: '9999px' }} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '16px' }} />)}
      </div>
    </div>
  );
}
