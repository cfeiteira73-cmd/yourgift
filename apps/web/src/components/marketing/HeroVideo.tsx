'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
// Apple · Rolex · Porsche · F1 premium feel
// Autoplay muted (browser requirement) + unmute button
// No poster flash — dark background until video plays
// prefers-reduced-motion: paused video, static frame

interface HeroVideoProps {
  src: string;
  poster?: string;
  ariaLabel?: string;
}

export function HeroVideo({
  src,
  ariaLabel = 'YourGift Premium Brand Video',
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
  }, []);

  // Start playback on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => {});
  }, []);

  // Toggle mute via ref (React muted prop doesn't update DOM after mount)
  const toggleSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    // If unmuting, resume play in case browser paused it
    if (!next) {
      video.play().catch(() => {});
    }
    setMuted(next);
  }, [muted]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        // Pure dark background — no photo flash
        background: '#080807',
      }}
    >
      {/* ── Video ─────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        aria-label={ariaLabel}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        // NO poster — avoids old photo flash
        onPlaying={() => setVisible(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 800ms ease-out',
          willChange: 'opacity',
          // Pause if reduced motion
          animationPlayState: reducedMotion ? 'paused' : 'running',
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* ── Cinematic gradient overlay ─────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(0,0,0,.10) 0%, rgba(0,0,0,.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Sound toggle button ────────────────────────────────────────── */}
      <button
        onClick={toggleSound}
        aria-label={muted ? 'Activar som' : 'Silenciar'}
        title={muted ? 'Activar som' : 'Silenciar'}
        style={{
          position: 'absolute',
          bottom: '108px',
          right: '80px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(8,8,7,0.72)',
          border: '1px solid rgba(212,180,122,0.45)',
          color: 'rgba(240,236,228,0.9)',
          padding: '9px 16px',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: 'var(--font-montserrat), sans-serif',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          transition: 'all 0.25s ease',
          outline: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(184,151,94,0.25)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,180,122,0.8)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(8,8,7,0.72)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,180,122,0.45)';
        }}
      >
        {muted ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            Som
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            Silenciar
          </>
        )}
      </button>
    </div>
  );
}
