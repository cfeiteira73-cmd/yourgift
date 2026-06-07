'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
//
// React muted prop bug: React keeps resetting video.muted=true on every render.
// useEffect fires OUTSIDE the user gesture call stack → browser blocks audio.
//
// Solution:
//   1. Track intended muted state in a ref (not React state)
//   2. Click handler sets v.muted=false SYNCHRONOUSLY within user gesture stack
//   3. useLayoutEffect (runs after reconciliation, before paint) enforces our ref
//   4. React prop always says `muted` but useLayoutEffect overrides it every time
//
// ─────────────────────────────────────────────────────────────────────────────

interface HeroVideoProps {
  src: string;
  poster?: string;
  ariaLabel?: string;
}

export function HeroVideo({
  src,
  poster = '/images/hero-fallback.jpg',
  ariaLabel = 'YourGift Brand Video',
}: HeroVideoProps) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const intendedMuted  = useRef(true);   // source of truth — never touched by React
  const [isMuted,   setIsMuted]   = useState(true);
  const [visible,   setVisible]   = useState(false);

  // ── A. Autoplay muted on first mount ────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = true;
    v.volume = 1;
    v.play().catch(() => {});
  }, []);

  // ── B. After EVERY React render: enforce intendedMuted via layout effect
  //       useLayoutEffect fires synchronously after DOM mutations,
  //       after React reconciliation → it WINS over the `muted` JSX prop ──
  useLayoutEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = intendedMuted.current;
    v.volume = 1;
  });   // ← no dependency array = runs after every render

  // ── C. Sound toggle ─────────────────────────────────────────────────
  //  Call v.muted=false SYNCHRONOUSLY here (still in user gesture stack)
  //  BEFORE React state update triggers re-render ──────────────────────
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;

    const next = !intendedMuted.current;
    intendedMuted.current = next;   // update ref first

    // SYNC within click → browser user gesture context ✓
    v.muted  = next;
    v.volume = 1;

    // If video somehow paused, restart it
    if (v.paused) {
      v.play().catch(() => {});
    }

    setIsMuted(next);   // trigger re-render for button UI
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#080807' }}>

      {/* Poster while video loads */}
      {!visible && poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
        />
      )}

      {/* Video — `muted` JSX prop is overridden each render by useLayoutEffect */}
      <video
        ref={videoRef}
        src={src}
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
          transition: 'opacity 800ms ease-out',
        }}
      />

      {/* Gradient overlay */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.52) 100%)',
      }} />

      {/* Sound button — z-index 100, always above everything */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Activar som' : 'Silenciar'}
        style={{
          position: 'absolute',
          bottom: '96px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isMuted ? 'rgba(8,8,7,0.78)' : 'rgba(154,124,74,0.22)',
          border: isMuted
            ? '1px solid rgba(212,180,122,0.55)'
            : '1px solid rgba(212,180,122,0.9)',
          color: 'rgba(240,236,228,0.95)',
          padding: '13px 28px',
          cursor: 'pointer',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: 'var(--font-montserrat), sans-serif',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          transition: 'all 0.25s ease',
          outline: 'none',
          animation: isMuted ? 'yg-pulse-sound 2.4s ease-in-out infinite' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {isMuted ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#d4b47a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            Activar Som
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#d4b47a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            Silenciar
          </>
        )}
      </button>

      <style>{`
        @keyframes yg-pulse-sound {
          0%,100%{ opacity:.8;  transform:translateX(-50%) scale(1);    }
          50%    { opacity:1;   transform:translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
