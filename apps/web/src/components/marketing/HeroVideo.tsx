'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
// React has a known bug: the `muted` prop on <video> is not properly updated
// after initial render (React resets it on re-render).
// Fix: control `video.muted` exclusively via useEffect + ref.
// See: https://github.com/facebook/react/issues/6544

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
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // ── 1. Start muted autoplay on mount ────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = true;   // force muted so autoplay is allowed
    v.volume = 1;
    v.play().catch(() => {});
  }, []);

  // ── 2. Sync muted state → DOM (bypasses React's broken muted prop) ──
  // This runs AFTER every React reconciliation, so it always wins.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = isMuted;
    v.volume = 1;
    // If unmuting while paused, resume
    if (!isMuted && v.paused) {
      v.play().catch(() => {});
    }
  }, [isMuted]);

  // ── 3. Toggle — just flip React state, useEffect handles DOM ────────
  const toggleMute = () => setIsMuted(prev => !prev);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#080807' }}>

      {/* Poster — shows while video loads, no black screen */}
      {!visible && (
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

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        aria-label={ariaLabel}
        autoPlay
        muted        /* initial HTML attr → allows autoplay; React state takes over via useEffect */
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

      {/* Sound button — z-index 100 */}
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
          border: isMuted ? '1px solid rgba(212,180,122,0.55)' : '1px solid rgba(212,180,122,0.9)',
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4b47a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            Activar Som
          </>
        ) : (
          <>
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
        @keyframes yg-pulse-sound {
          0%,100%{ opacity:.8;  transform:translateX(-50%) scale(1); }
          50%    { opacity:1;   transform:translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
