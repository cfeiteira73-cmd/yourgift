'use client';

/**
 * ArtworkAnnotationLayer — interactive pin annotation overlay for artwork images.
 *
 * Features:
 *   - Click anywhere on the image to add a pin annotation
 *   - Existing annotations rendered as numbered pins
 *   - Hover a pin to see the annotation text in a tooltip
 *   - Click a pin to highlight it
 *   - Submits to /api/artwork-intelligence (add_annotation action)
 *
 * Props:
 *   submissionId  - artwork submission UUID
 *   imageUrl      - image URL to display
 *   readOnly      - if true, only shows existing annotations (no add)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Annotation {
  id: string;
  text: string;
  annotation_x_pct: number;
  annotation_y_pct: number;
  created_at: string;
  author_email?: string;
  parent_id: string | null;
}

interface Props {
  submissionId: string;
  imageUrl: string;
  readOnly?: boolean;
  onAnnotationAdded?: () => void;
}

export function ArtworkAnnotationLayer({ submissionId, imageUrl, readOnly = false, onAnnotationAdded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const loadAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/artwork-intelligence?mode=annotations&submissionId=${submissionId}`);
      if (!res.ok) return;
      const json = await res.json();
      // API returns threads (parents with replies); flatten to just parent annotations for pins
      const parents: Annotation[] = (json.threads ?? []).map((t: { annotation: Annotation }) => t.annotation);
      setAnnotations(parents);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [submissionId]);

  useEffect(() => { loadAnnotations(); }, [loadAnnotations]);

  // Convert click position to percentage coordinates
  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setInputText('');
    setActivePin(null);
  }

  async function submitAnnotation() {
    if (!pendingPin || !inputText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/artwork-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_annotation',
          submissionId,
          text: inputText.trim(),
          annotationXPct: pendingPin.x,
          annotationYPct: pendingPin.y,
        }),
      });
      if (res.ok) {
        setPendingPin(null);
        setInputText('');
        await loadAnnotations();
        onAnnotationAdded?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rootAnnotations = annotations.filter(a => !a.parent_id);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }} ref={containerRef}>
      {/* Image + click layer */}
      <div
        onClick={handleImageClick}
        style={{
          position: 'relative',
          cursor: readOnly ? 'default' : 'crosshair',
          borderRadius: '10px',
          overflow: 'hidden',
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Artwork para revisão"
          onLoad={e => {
            const el = e.currentTarget;
            setImgDims({ w: el.naturalWidth, h: el.naturalHeight });
          }}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '10px',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* Existing annotation pins */}
        {rootAnnotations.map((ann, idx) => (
          <AnnotationPin
            key={ann.id}
            annotation={ann}
            index={idx + 1}
            active={activePin === ann.id}
            onClick={e => {
              e.stopPropagation();
              setActivePin(prev => prev === ann.id ? null : ann.id);
              setPendingPin(null);
            }}
          />
        ))}

        {/* Pending pin (before submit) */}
        {pendingPin && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              left: `${pendingPin.x}%`,
              top: `${pendingPin.y}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', border: '2.5px solid rgb(77,163,255)',
              background: 'rgba(77,163,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 800, color: 'rgb(77,163,255)',
              boxShadow: '0 0 0 4px rgba(77,163,255,0.15)',
            }}>
              +
            </div>
          </motion.div>
        )}
      </div>

      {/* Pending pin input popover */}
      <AnimatePresence>
        {pendingPin && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            style={{
              position: 'absolute',
              left: `clamp(8px, ${pendingPin.x}%, calc(100% - 280px))`,
              top: `${pendingPin.y}%`,
              marginTop: '8px',
              zIndex: 30,
              background: 'rgb(14,22,38)',
              border: '1px solid rgba(77,163,255,0.3)',
              borderRadius: '10px',
              padding: '0.75rem',
              width: '260px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(77,163,255)', marginBottom: '0.4rem' }}>
              📌 Adicionar anotação
            </div>
            <textarea
              autoFocus
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitAnnotation();
                if (e.key === 'Escape') { setPendingPin(null); setInputText(''); }
              }}
              placeholder="Descreve o problema ou comentário…"
              rows={3}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '7px', padding: '0.4rem 0.6rem', color: 'rgb(215,225,240)',
                fontSize: '0.8rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={submitAnnotation}
                disabled={!inputText.trim() || submitting}
                style={{
                  flex: 1, padding: '0.35rem', borderRadius: '7px', fontSize: '0.75rem',
                  fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: inputText.trim() ? 'rgba(77,163,255,0.2)' : 'rgba(255,255,255,0.05)',
                  color: inputText.trim() ? 'rgb(77,163,255)' : 'rgb(80,92,110)',
                  transition: 'all 150ms',
                }}
              >
                {submitting ? '…' : 'Guardar (⌘↵)'}
              </button>
              <button
                type="button"
                onClick={() => { setPendingPin(null); setInputText(''); }}
                style={{
                  padding: '0.35rem 0.6rem', borderRadius: '7px', fontSize: '0.75rem',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgb(100,112,130)',
                }}
              >
                Esc
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Annotation list */}
      {rootAnnotations.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            {rootAnnotations.length} Anotaç{rootAnnotations.length === 1 ? 'ão' : 'ões'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {rootAnnotations.map((ann, idx) => (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setActivePin(prev => prev === ann.id ? null : ann.id)}
                style={{
                  display: 'flex', gap: '0.5rem', padding: '0.5rem 0.625rem',
                  borderRadius: '8px', cursor: 'pointer',
                  background: activePin === ann.id ? 'rgba(77,163,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activePin === ann.id ? 'rgba(77,163,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 150ms',
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(77,163,255,0.2)', border: '1.5px solid rgba(77,163,255,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 800, color: 'rgb(77,163,255)',
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'rgb(210,222,240)', lineHeight: 1.4 }}>{ann.text}</div>
                  <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', marginTop: '0.15rem' }}>
                    {ann.author_email ?? 'Anónimo'} · {new Date(ann.created_at).toLocaleDateString('pt-PT')}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'rgb(60,75,95)' }}>
          💡 Clica na imagem para adicionar uma anotação
        </div>
      )}

      {loading && annotations.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', padding: '0.5rem 0' }}>A carregar anotações…</div>
      )}
    </div>
  );
}

// ── Pin component ─────────────────────────────────────────────────────────────

function AnnotationPin({
  annotation,
  index,
  active,
  onClick,
}: {
  annotation: Annotation;
  index: number;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      style={{
        position: 'absolute',
        left: `${annotation.annotation_x_pct}%`,
        top: `${annotation.annotation_y_pct}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        cursor: 'pointer',
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Pin circle */}
      <motion.div
        animate={{ scale: active || hover ? 1.2 : 1 }}
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          background: active ? 'rgb(77,163,255)' : 'rgba(77,163,255,0.25)',
          border: `2px solid ${active ? 'rgb(77,163,255)' : 'rgba(77,163,255,0.7)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6rem', fontWeight: 800,
          color: active ? '#fff' : 'rgb(77,163,255)',
          boxShadow: active ? '0 0 0 4px rgba(77,163,255,0.25)' : '0 2px 8px rgba(0,0,0,0.5)',
          transition: 'background 150ms, border-color 150ms, box-shadow 150ms',
        }}
      >
        {index}
      </motion.div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {(hover || active) && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: -8, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'absolute',
              bottom: '100%', left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '4px',
              background: 'rgb(14,22,38)',
              border: '1px solid rgba(77,163,255,0.3)',
              borderRadius: '8px',
              padding: '0.4rem 0.6rem',
              width: '180px',
              zIndex: 20,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'rgb(210,225,245)', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {annotation.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
