import type { Metadata } from 'next';
// ── Premium skeleton loading state ──
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#090907', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '2px solid rgba(154,124,74,0.14)', borderTop: '2px solid #b8975e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '9px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)' }}>A carregar...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
