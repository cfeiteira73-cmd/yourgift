'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── ConfirmDialog ──────────────────────────────────────────────────────────────
//
// Reusable confirmation modal for destructive actions.
// Follows WCAG 2.1 — focus trap, ESC to cancel, focus returns to trigger.
//
// Usage:
//   const [open, setOpen] = useState(false);
//   const triggerRef = useRef<HTMLButtonElement>(null);
//
//   <button ref={triggerRef} onClick={() => setOpen(true)}>Delete</button>
//   <ConfirmDialog
//     open={open}
//     title="Cancelar encomenda?"
//     description="Esta ação não pode ser desfeita. A encomenda será cancelada permanentemente."
//     confirmLabel="Cancelar encomenda"
//     confirmVariant="danger"
//     onConfirm={handleDelete}
//     onCancel={() => setOpen(false)}
//     triggerRef={triggerRef}
//   />
//
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const CONFIRM_STYLES = {
  danger:  { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)',  hover: 'rgba(239,68,68,0.25)'  },
  warning: { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)', hover: 'rgba(245,158,11,0.25)' },
  primary: { bg: 'rgba(154,124,74,0.14)',  text: '#d4b47a', border: 'rgba(154,124,74,0.28)', hover: 'rgba(154,124,74,0.22)' },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const style = CONFIRM_STYLES[confirmVariant];

  // Focus management — move focus into dialog when it opens
  useEffect(() => {
    if (open) {
      // Delay to let AnimatePresence mount the element
      const t = setTimeout(() => cancelBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      // Return focus to trigger when dialog closes
      const t = setTimeout(() => triggerRef?.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, triggerRef]);

  // ESC closes dialog
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Focus trap within dialog
  useEffect(() => {
    if (!open) return;
    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const els = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean) as HTMLElement[];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? 'confirm-dialog-desc' : undefined}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{
              background: 'rgb(12,22,42)',
              border: '1px solid rgba(240,236,228,0.10)',
              borderRadius: '16px',
              padding: '28px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: style.bg, border: `1px solid ${style.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, fontSize: 20,
            }}>
              {confirmVariant === 'danger' ? '🗑' : confirmVariant === 'warning' ? '⚠️' : 'ℹ️'}
            </div>

            {/* Title */}
            <h2
              id="confirm-dialog-title"
              style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 8px', lineHeight: 1.3 }}
            >
              {title}
            </h2>

            {/* Description */}
            {description && (
              <p
                id="confirm-dialog-desc"
                style={{ fontSize: 14, color: 'rgba(240,236,228,0.45)', margin: '0 0 24px', lineHeight: 1.6 }}
              >
                {description}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: description ? 0 : 24 }}>
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={onCancel}
                disabled={loading}
                style={{
                  padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: 'rgba(240,236,228,0.06)', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(240,236,228,0.10)', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'rgba(240,236,228,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,236,228,0.06)'; }}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={onConfirm}
                disabled={loading}
                style={{
                  padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: style.bg, color: style.text,
                  border: `1px solid ${style.border}`, cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms', opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = style.hover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = style.bg; }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 019.6 7.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    A processar…
                  </span>
                ) : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
