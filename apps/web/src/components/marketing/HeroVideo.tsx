'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
//
// All previous attempts failed because React's reconciliation keeps resetting
// video.muted = true no matter what we do via JSX props or effects.
//
// SOLUTION: Create the video element imperatively via document.createElement.
// React never touches it. We control it 100% via direct DOM API.
// The toggleMute click calls v.muted=false + v.play() synchronously,
// inside the user gesture call stack → browser MUST allow audio.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement | null>(null);
  const [isMuted,  setIsMuted]  = useState(true);
  const [visible,  setVisible]  = useState(false);

  // ── Create & manage the video element imperatively (bypasses React) ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const v = document.createElement('video');
    v.setAttribute('aria-label', ariaLabel);
    v.src      = src;
    v.autoplay = true;
    v.muted    = true;   // required for autoplay
    v.loop     = true;
    v.setAttribute('playsinline', '');
    v.preload  = 'metadata'; // 'auto' downloads entire 40MB; 'metadata' is enough to start play
    v.volume   = 1;
    Object.assign(v.style, {
      position: 'absolute', inset: '0',
      width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: 'center center',
      opacity: '0',
      transition: 'opacity 800ms ease-out',
    });

    v.addEventListener('playing', () => {
      v.style.opacity = '1';
      setVisible(true);
    });

    container.appendChild(v);
    videoRef.current = v;

    v.play().catch(() => {});

    return () => {
      v.pause();
      if (container.contains(v)) container.removeChild(v);
      videoRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Toggle: called directly from button click (user gesture) ─────────
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;

    if (isMuted) {
      // ── UNMUTE within user gesture call stack ─────────────────────
      v.muted  = false;
      v.volume = 1;
      v.play().catch(() => {}); // direct user-initiated play → always allowed
      setIsMuted(false);
    } else {
      v.muted = true;
      setIsMuted(true);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#080807' }}
    >
      {/* Poster image while video loads — LCP element, must load fast */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="sync"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          opacity: visible ? 0 : 1,
          transition: 'opacity 800ms ease-out',
        }}
      />

      {/* Gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.52) 100%)',
        }}
      />

      {/* Sound button — z-index 100, always clickable */}
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
          background: isMuted ? 'rgba(8,8,7,0.82)' : 'rgba(154,124,74,0.25)',
          border: isMuted
            ? '1px solid rgba(212,180,122,0.6)'
            : '1px solid rgba(212,180,122,0.95)',
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
          animation: isMuted ? 'yg-ps 2.4s ease-in-out infinite' : 'none',
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
        @keyframes yg-ps {
          0%,100%{ opacity:.8;  transform:translateX(-50%) scale(1);    }
          50%    { opacity:1;   transform:translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
