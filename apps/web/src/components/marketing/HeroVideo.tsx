'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
// Autoplay muted (browser requirement).
// A dedicated button (z-index: 100) unmutes immediately on click.

interface HeroVideoProps {
  src: string;
  ariaLabel?: string;
}

export function HeroVideo({ src, ariaLabel = 'YourGift Premium Brand Video' }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted]     = useState(true);

  // Autoplay muted on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = true;
    v.volume = 1;
    v.play().catch(() => {});
  }, []);

  // Toggle mute — called directly by button click (user gesture ✓)
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (muted) {
      // Unmute
      v.pause();
      v.muted  = false;
      v.volume = 1;
      v.play().catch(() => {});
      setMuted(false);
    } else {
      // Mute
      v.muted = true;
      setMuted(true);
    }
  }, [muted]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#080807' }}>

      {/* ── Video ──────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        aria-label={ariaLabel}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onPlaying={() => setVisible(true)}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 700ms ease-out',
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* ── Cinematic gradient overlay ─────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.52) 100%)',
      }} />

      {/* ── Sound button — z-index 100, above EVERYTHING ───────────────── */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Activar som' : 'Silenciar'}
        style={{
          position: 'absolute',
          // Centre-bottom of hero, above trust bar
          bottom: '96px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,           /* above hero content (z:2), badge (z:3), trust (z:2) */
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: muted ? 'rgba(8,8,7,0.75)' : 'rgba(154,124,74,0.25)',
          border: muted
            ? '1px solid rgba(212,180,122,0.5)'
            : '1px solid rgba(212,180,122,0.9)',
          color: 'rgba(240,236,228,0.95)',
          padding: '12px 24px',
          cursor: 'pointer',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          fontFamily: 'var(--font-montserrat), sans-serif',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          transition: 'all 0.25s ease',
          outline: 'none',
          /* Pulsing when muted to draw attention */
          animation: muted ? 'yg-sound-pulse 2.4s ease-in-out infinite' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {muted ? (
          <>
            {/* Muted icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4b47a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            Activar Som
          </>
        ) : (
          <>
            {/* Sound on icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4b47a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            Silenciar
          </>
        )}
      </button>

      <style>{`
        @keyframes yg-sound-pulse {
          0%, 100% { opacity: 0.80; transform: translateX(-50%) scale(1); }
          50%       { opacity: 1;    transform: translateX(-50%) scale(1.04); }
        }
      `}</style>
    </div>
  );
}
