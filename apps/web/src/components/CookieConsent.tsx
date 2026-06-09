'use client';

import { useState, useEffect } from 'react';

const COOKIE_KEY = 'yg_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
    } catch { setVisible(true); }
  }, []);

  const accept = () => {
    try { localStorage.setItem(COOKIE_KEY, 'accepted'); } catch { /* */ }
    setVisible(false);
  };
  const decline = () => {
    try { localStorage.setItem(COOKIE_KEY, 'declined'); } catch { /* */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        right: '24px',
        maxWidth: '480px',
        background: '#0f0f0c',
        border: '1px solid rgba(154,124,74,0.22)',
        padding: '20px 24px',
        zIndex: 9999,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}
    >
      <p style={{
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '9px',
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: '#9a7c4a',
        fontWeight: 600,
        margin: '0 0 8px',
      }}>
        · Privacidade
      </p>
      <p style={{
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '13px',
        color: 'rgba(240,236,228,0.72)',
        lineHeight: '1.6',
        fontWeight: 300,
        margin: '0 0 18px',
      }}>
        Usamos cookies essenciais para o funcionamento do site e cookies de análise para melhorar a experiência.{' '}
        <a
          href="/privacy-policy"
          style={{ color: '#d4b47a', textDecoration: 'none', fontWeight: 400 }}
        >
          Política de Privacidade
        </a>
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={accept}
          type="button"
          style={{
            background: '#b8975e',
            color: '#090907',
            border: 'none',
            padding: '10px 22px',
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Aceitar Todos
        </button>
        <button
          onClick={decline}
          type="button"
          style={{
            background: 'transparent',
            color: 'rgba(240,236,228,0.42)',
            border: '1px solid rgba(154,124,74,0.18)',
            padding: '10px 22px',
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Só Essenciais
        </button>
      </div>
    </div>
  );
}
