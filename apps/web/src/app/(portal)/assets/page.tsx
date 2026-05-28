'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useRef, useEffect } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { createClient } from '@/lib/supabase/client';

export default function AssetsPage() {
  return (
    <PortalLayout>
      <AssetIntelligencePlatform />
    </PortalLayout>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
  folder?: string;
}

// ── File type config ──────────────────────────────────────────────────────────

function fileConfig(type: string): { icon: string; color: string; label: string } {
  if (type.includes('svg')) return { icon: '✦', color: 'rgb(99,230,190)', label: 'SVG' };
  if (type.includes('pdf')) return { icon: '📄', color: 'rgb(239,68,68)', label: 'PDF' };
  if (type.includes('png')) return { icon: '🖼️', color: 'rgb(77,163,255)', label: 'PNG' };
  if (type.includes('jpg') || type.includes('jpeg')) return { icon: '📷', color: 'rgb(245,158,11)', label: 'JPG' };
  if (type.includes('ai') || type.includes('illustrator')) return { icon: '🎨', color: 'rgb(245,158,11)', label: 'AI' };
  if (type.includes('psd') || type.includes('photoshop')) return { icon: '🎨', color: 'rgb(77,163,255)', label: 'PSD' };
  if (type.includes('zip')) return { icon: '📦', color: 'rgb(120,130,150)', label: 'ZIP' };
  return { icon: '📁', color: 'rgb(120,130,150)', label: type.split('/')[1]?.toUpperCase() ?? 'FILE' };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'agora mesmo';
  if (hours < 24) return `há ${hours}h`;
  if (days < 30) return `há ${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (files: FileList) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files);
  }, [onUpload]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? 'rgba(77,163,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '18px',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        background: dragging ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        marginBottom: '1.5rem',
        boxShadow: dragging ? '0 0 30px rgba(77,163,255,0.1)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!dragging) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)';
        }
      }}
      onMouseLeave={(e) => {
        if (!dragging) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.svg,.ai,.psd,.eps,.zip"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); }}
      />
      <motion.div
        animate={{ scale: dragging ? 1.1 : 1 }}
        style={{ fontSize: '2.5rem', marginBottom: '0.875rem' }}
      >
        {dragging ? '📥' : '☁️'}
      </motion.div>
      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgb(200,210,225)', marginBottom: '0.375rem' }}>
        {dragging ? 'Solta os ficheiros aqui' : 'Arrasta ficheiros ou clica para fazer upload'}
      </p>
      <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>
        PNG · JPG · SVG · PDF · AI · PSD · EPS · ZIP — até 50 MB por ficheiro
      </p>
    </motion.div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────

function AssetCard({ asset, onDelete, selected, onSelect }: {
  asset: Asset;
  onDelete: (id: string) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const fc = fileConfig(asset.type);
  const isImage = asset.type.startsWith('image/');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(asset.id)}
      style={{
        background: selected
          ? 'linear-gradient(145deg, rgba(77,163,255,0.1) 0%, rgba(77,163,255,0.04) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)',
        border: `1px solid ${selected ? 'rgba(77,163,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '14px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        position: 'relative',
      }}
    >
      {/* Preview area */}
      <div style={{
        height: '110px',
        background: 'rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {isImage && asset.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '12px' }}
          />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{fc.icon}</div>
            <div style={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
              color: fc.color, background: `${fc.color}18`,
              border: `1px solid ${fc.color}30`,
              borderRadius: '4px', padding: '0.15rem 0.4rem',
            }}>
              {fc.label}
            </div>
          </div>
        )}

        {/* Selection indicator */}
        {selected && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'rgb(77,163,255)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(7,17,31)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.75rem' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(200,210,225)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>
          {asset.name}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'rgb(70,82,100)' }}>
            {formatBytes(asset.size)}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'rgb(70,82,100)' }}>
            {timeAgo(asset.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Upload progress item ──────────────────────────────────────────────────────

interface UploadJob { id: string; name: string; progress: number; error?: string }

function UploadProgress({ jobs }: { jobs: UploadJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        background: 'rgba(77,163,255,0.06)', border: '1px solid rgba(77,163,255,0.15)',
        borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem',
      }}
    >
      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(77,163,255)', marginBottom: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        A fazer upload…
      </p>
      {jobs.map((job) => (
        <div key={job.id} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgb(170,180,198)' }}>{job.name}</span>
            <span style={{ fontSize: '0.72rem', color: job.error ? 'rgb(239,68,68)' : 'rgb(77,163,255)' }}>
              {job.error ? 'Erro' : `${job.progress}%`}
            </span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${job.progress}%` }}
              style={{ height: '100%', background: job.error ? 'rgb(239,68,68)' : 'rgb(77,163,255)', borderRadius: '99px' }}
            />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Main Platform ─────────────────────────────────────────────────────────────

function AssetIntelligencePlatform() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'image' | 'vector' | 'doc'>('all');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user + assets from Supabase Storage
  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: files } = await supabase.storage
        .from('client-assets')
        .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (files) {
        const mapped: Asset[] = await Promise.all(
          files.map(async (f) => {
            const { data: { publicUrl } } = supabase.storage
              .from('client-assets')
              .getPublicUrl(`${user.id}/${f.name}`);
            return {
              id: f.id ?? f.name,
              name: f.name,
              size: f.metadata?.size ?? 0,
              type: f.metadata?.mimetype ?? 'application/octet-stream',
              url: publicUrl,
              createdAt: f.created_at ?? new Date().toISOString(),
            };
          })
        );
        setAssets(mapped);
      }
            } catch (err) {
        console.error("[assets] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Upload handler
  const handleUpload = useCallback(async (files: FileList) => {
    if (!userId) return;
    const supabase = createClient();

    const jobs: UploadJob[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}`,
      name: f.name,
      progress: 0,
    }));
    setUploadJobs((prev) => [...prev, ...jobs]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const job = jobs[i];
      const path = `${userId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;

      // Simulate progress
      const progTimer = setInterval(() => {
        setUploadJobs((prev) =>
          prev.map((j) => j.id === job.id && j.progress < 85 ? { ...j, progress: j.progress + 15 } : j)
        );
      }, 200);

      const { data, error } = await supabase.storage
        .from('client-assets')
        .upload(path, file, { upsert: false });

      clearInterval(progTimer);

      if (error) {
        setUploadJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, progress: 100, error: error.message } : j));
      } else {
        setUploadJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, progress: 100 } : j));
        const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path);
        const newAsset: Asset = {
          id: data.id ?? path,
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl,
          createdAt: new Date().toISOString(),
        };
        setAssets((prev) => [newAsset, ...prev]);
      }
    }

    // Clear completed jobs after 3s
    setTimeout(() => {
      setUploadJobs((prev) => prev.filter((j) => j.error));
    }, 3000);
  }, [userId]);

  // Delete selected
  async function deleteSelected() {
    if (selected.size === 0 || !userId) return;
    const supabase = createClient();
    const toDelete = assets.filter((a) => selected.has(a.id));

    for (const asset of toDelete) {
      const filePath = `${userId}/${asset.name}`;
      await supabase.storage.from('client-assets').remove([filePath]);
    }
    setAssets((prev) => prev.filter((a) => !selected.has(a.id)));
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = assets.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'image') return a.type.startsWith('image/');
    if (filter === 'vector') return a.type.includes('svg') || a.type.includes('ai') || a.type.includes('eps');
    if (filter === 'doc') return a.type.includes('pdf') || a.type.includes('zip');
    return true;
  });

  const filterOpts: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'image', label: 'Imagens' },
    { key: 'vector', label: 'Vetores' },
    { key: 'doc', label: 'Docs' },
  ];

  return (
    <div style={{ padding: '2rem 2rem 4rem', maxWidth: '1100px' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.3rem' }}>
            Ficheiros & Artes
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgb(100,112,130)' }}>
            {assets.length} ficheiro{assets.length !== 1 ? 's' : ''} · Brand Asset Intelligence Platform
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selected.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              type="button"
              onClick={deleteSelected}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: 'rgb(239,68,68)', padding: '0.5rem 0.875rem',
                borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              🗑️ Eliminar ({selected.size})
            </motion.button>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            {(['grid', 'list'] as const).map((v) => (
              <button type="button"
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  padding: '0.5rem 0.75rem', border: 'none', cursor: 'pointer',
                  background: view === v ? 'rgba(77,163,255,0.15)' : 'transparent',
                  color: view === v ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
                  fontSize: '0.9rem', transition: 'all 150ms',
                }}
              >
                {v === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Upload zone */}
      <UploadZone onUpload={handleUpload} />

      {/* Upload progress */}
      <AnimatePresence>
        {uploadJobs.length > 0 && <UploadProgress jobs={uploadJobs} />}
      </AnimatePresence>

      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}
      >
        {filterOpts.map((opt) => (
          <button type="button"
            key={opt.key}
            type="button"
            onClick={() => setFilter(opt.key)}
            style={{
              padding: '0.4rem 0.875rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
              border: `1px solid ${filter === opt.key ? 'rgba(77,163,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
              background: filter === opt.key ? 'rgba(77,163,255,0.12)' : 'rgba(255,255,255,0.03)',
              color: filter === opt.key ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
              cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            {opt.label}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              style={{ height: '180px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '18px',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem', opacity: 0.5 }}>🎨</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'rgb(200,210,225)', marginBottom: '0.5rem' }}>
            {filter === 'all' ? 'Ainda não tens ficheiros' : `Sem ficheiros do tipo "${filterOpts.find(f => f.key === filter)?.label}"`}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'rgb(80,92,110)', marginBottom: '1.5rem', maxWidth: '340px', margin: '0 auto 1.5rem' }}>
            Faz upload dos teus logos, artes finais e ficheiros de marca para teres tudo num só lugar.
          </p>
        </motion.div>
      ) : view === 'grid' ? (
        <motion.div
          layout
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={(id) => setAssets((p) => p.filter((a) => a.id !== id))}
                selected={selected.has(asset.id)}
                onSelect={toggleSelect}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        // List view
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {filtered.map((asset, i) => {
            const fc = fileConfig(asset.type);
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => toggleSelect(asset.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  background: selected.has(asset.id) ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.02)',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer', transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { if (!selected.has(asset.id)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.035)'; }}
                onMouseLeave={(e) => { if (!selected.has(asset.id)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${fc.color}15`, border: `1px solid ${fc.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                  {fc.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(200,210,225)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgb(70,82,100)' }}>{fc.label} · {formatBytes(asset.size)}</p>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'rgb(70,82,100)', flexShrink: 0 }}>{timeAgo(asset.createdAt)}</span>
                {selected.has(asset.id) && (
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgb(77,163,255)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(7,17,31)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
