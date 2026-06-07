'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
// Starts MUTED (browser autoplay requirement) with a full-hero click overlay.
// First click → sound on immediately. No controls shown after.

interface HeroVideoProps {
  src: string;
  ariaLabel?: string;
}

export function HeroVideo({ src, ariaLabel = 'YourGift Premium Brand Video' }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible]       = useState(false);
  const [hasSound, setHasSound]     = useState(false);  // true after first click
  const [muted, setMuted]           = useState(true);

  // Autoplay muted on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  // First click anywhere on hero → enable sound
  const enableSound = useCallback(() => {
    const v = videoRef.current;
    if (!v || hasSound) return;
    v.muted = false;
    v.play().catch(() => {});
    setMuted(false);
    setHasSound(true);
  }, [hasSound]);

  // Toggle mute after sound has been enabled
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    if (!next) v.play().catch(() => {});
    setMuted(next);
  }, [muted]);

  return (
    <div
      onClick={!hasSound ? enableSound : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: '#080807',
        cursor: hasSound ? 'default' : 'pointer',
      }}
    >
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
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 700ms ease-out',
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* ── Cinematic gradient ─────────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.52) 100%)',
      }} />

      {/* ── "Click for sound" overlay — disappears after first click ────── */}
      {!hasSound && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '112px',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(8,8,7,0.68)',
            border: '1px solid rgba(212,180,122,0.5)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            padding: '11px 22px',
            fontFamily: 'var(--font-montserrat), sans-serif',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(240,236,228,0.92)',
            animation: 'yg-pulse 2.2s ease-in-out infinite',
          }}>
            {/* Sound wave icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4b47a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            Clica para activar o som
          </div>
        </div>
      )}

      {/* ── Mute toggle (after sound enabled) ─────────────────────────── */}
      {hasSound && (
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Activar som' : 'Silenciar'}
          style={{
            position: 'absolute',
            bottom: '108px',
            right: '80px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(8,8,7,0.68)',
            border: '1px solid rgba(212,180,122,0.45)',
            color: 'rgba(240,236,228,0.88)',
            padding: '9px 16px',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            fontFamily: 'var(--font-montserrat), sans-serif',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
        >
          {muted ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
              Som
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4b47a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
              Silenciar
            </>
          )}
        </button>
      )}

      {/* Pulse animation for click prompt */}
      <style>{`
        @keyframes yg-pulse {
          0%, 100% { opacity: 0.75; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
