'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Cinematic Hero Video ─────────────────────────────────────────────────────
// Apple · Rolex · Porsche · F1 premium feel
// Autoplay · Muted · Loop · No controls
// Fade-in 1200ms ease-out on load
// prefers-reduced-motion: shows poster only
// Fallback: poster image on any error

interface HeroVideoProps {
  src: string;
  poster: string;
  ariaLabel?: string;
}

export function HeroVideo({
  src,
  poster,
  ariaLabel = 'YourGift Premium Brand Video',
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Ensure autoplay starts
  useEffect(() => {
    if (reducedMotion || error) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay blocked — video still shows poster
    });
  }, [reducedMotion, error]);

  const handleCanPlay = () => setLoaded(true);
  const handleError = () => setError(true);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: '#080807',
      }}
    >
      {/* Video — hidden when reduced-motion or error */}
      {!reducedMotion && !error && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={ariaLabel}
          onCanPlay={handleCanPlay}
          onError={handleError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 1200ms ease-out',
            willChange: 'opacity',
          }}
        />
      )}

      {/* Poster image — always present as background, visible before video loads */}
      {/* Also shown for reduced-motion and error states */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          // Hidden behind video once loaded
          opacity: (!reducedMotion && !error && loaded) ? 0 : 1,
          transition: 'opacity 1200ms ease-out',
        }}
      />

      {/* Cinematic overlay gradient for text readability */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.48) 100%)',
          zIndex: 1,
        }}
      />
    </div>
  );
}
