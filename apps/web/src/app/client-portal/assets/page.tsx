'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

// ── Phase 3 UI + Phase 4 — Artwork Intelligence + AI Design Studio ────────────

interface Asset {
  name: string;
  size: number;
  updated_at: string;
}

interface ArtworkAnalysis {
  score: number;
  printSafe: boolean;
  resolution: 'high' | 'medium' | 'low' | 'vector' | 'unknown';
  colorMode: 'CMYK' | 'RGB' | 'pantone' | 'unknown';
  issues: string[];
  suggestions: string[];
  verdict: 'approved' | 'review' | 'rejected';
  details: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['svg', 'ai', 'eps'].includes(ext ?? '')) return '🎨';
  if (ext === 'pdf') return '📄';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) return '🖼️';
  if (ext === 'zip') return '📦';
  return '📎';
}

function verdictColor(verdict?: ArtworkAnalysis['verdict']) {
  if (verdict === 'approved') return '#b8975e';
  if (verdict === 'review') return 'rgb(245,158,11)';
  if (verdict === 'rejected') return 'rgb(239,68,68)';
  return 'rgba(240,236,228,0.42)';
}

function verdictLabel(verdict?: ArtworkAnalysis['verdict']) {
  if (verdict === 'approved') return '✓ Aprovado';
  if (verdict === 'review') return '⚠ Revisão';
  if (verdict === 'rejected') return '✕ Rejeitado';
  return '—';
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#b8975e' : score >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="800" fill={color} style={{ transform: 'rotate(90deg)', transformOrigin: '24px 24px' }}>
        {score}
      </text>
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClientAssetsPage() {
  const router = useRouter();
  const [client, setClient] = useState<{ id: string; name: string | null; company: string | null; tier: string | null } | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Artwork analysis state
  const [analysisMap, setAnalysisMap] = useState<Record<string, ArtworkAnalysis>>({});
  const [analyzingMap, setAnalyzingMap] = useState<Record<string, boolean>>({});
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  // AI Design Studio state
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioResult, setStudioResult] = useState('');
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/assets'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c as typeof client);
        const { data: files } = await supabase.storage.from('client-assets').list(`${c.id}/`, { sortBy: { column: 'updated_at', order: 'desc' } });
        setAssets((files ?? []).filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder') as unknown as Asset[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !client) return;
    setUploading(true);
    setUploadMsg('');
    const supabase = createClient();
    const results: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowed = ['svg', 'pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
      if (!allowed.includes(ext ?? '')) { setUploadMsg(`⚠️ ${file.name}: formato não suportado.`); continue; }
      if (file.size > 50 * 1024 * 1024) { setUploadMsg(`⚠️ ${file.name}: demasiado grande (máx. 50MB).`); continue; }
      const path = `${client.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('client-assets').upload(path, file, { upsert: true });
      if (!error) results.push(file.name);
    }
    if (results.length > 0) {
      setUploadMsg(`✓ ${results.join(', ')} enviado com sucesso!`);
      const { data: files } = await supabase.storage.from('client-assets').list(`${client.id}/`, { sortBy: { column: 'updated_at', order: 'desc' } });
      setAssets((files ?? []).filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder') as unknown as Asset[]);
    }
    setUploading(false);
  }

  async function handleDelete(name: string) {
    if (!client) return;
    const supabase = createClient();
    await supabase.storage.from('client-assets').remove([`${client.id}/${name}`]);
    setAssets(prev => prev.filter(a => a.name !== name));
    setAnalysisMap(prev => { const next = { ...prev }; delete next[name]; return next; });
  }

  async function analyzeAsset(asset: Asset) {
    if (!client || analyzingMap[asset.name]) return;
    setAnalyzingMap(prev => ({ ...prev, [asset.name]: true }));

    try {
      const supabase = createClient();
      const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(`${client.id}/${asset.name}`);
      const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
      const isRaster = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

      const res = await fetch('/api/artwork-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: asset.name.replace(/^\d+_/, ''),
          fileType: isRaster ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : undefined,
          fileSize: asset.size,
          imageUrl: isRaster ? publicUrl : undefined,
        }),
      });

      if (res.ok) {
        const analysis = await res.json() as ArtworkAnalysis;
        setAnalysisMap(prev => ({ ...prev, [asset.name]: analysis }));
        setExpandedAsset(asset.name);
      }
    } catch {
      // Silent fail — artwork analysis is non-critical
    } finally {
      setAnalyzingMap(prev => ({ ...prev, [asset.name]: false }));
    }
  }

  async function handleStudioGenerate() {
    if (!studioPrompt.trim() || studioLoading) return;
    setStudioLoading(true);
    setStudioResult('');
    try {
      // Use the copilot endpoint with a design-focused message
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skipContext: true,
          messages: [{
            role: 'user',
            content: `DESIGN STUDIO REQUEST: ${studioPrompt.trim()}

Responde como especialista em design de merchandising corporativo. Fornece:
1. Conceito visual (2-3 frases)
2. Paleta de cores sugerida (3-4 cores com justificação)
3. Tipografia recomendada
4. Técnica de impressão adequada (serigrafia/tampografia/bordado/etc.)
5. Produtos recomendados do catálogo para este briefing

Formato: usa secções claras. Responde em Português de Portugal.`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStudioResult(data.content ?? 'Sem resposta do estúdio.');
      }
    } catch {
      setStudioResult('Erro ao gerar conceito. Tenta novamente.');
    } finally {
      setStudioLoading(false);
    }
  }

  return (
    <ClientPortalLayout userName={client?.name ?? undefined} userEmail={userEmail} companyName={client?.company ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '900px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Maquetes & Assets</h1>
            <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.28)' }}>Envia os teus logótipos e artes. Formatos aceites: SVG, PDF, AI, EPS, PNG, JPG (máx. 50MB)</p>
          </div>
          {/* AI Design Studio toggle */}
          <motion.button type="button" onClick={() => setStudioOpen(s => !s)} whileTap={{ scale: 0.96 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', borderRadius: '0px', border: '1px solid rgba(167,139,250,0.3)', background: studioOpen ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.08)', color: '#d4b47a', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            ✦ AI Design Studio
          </motion.button>
        </motion.div>

        {/* ── AI Design Studio ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {studioOpen && (
            <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.06) 0%, rgba(154,124,74,0.04) 100%)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: '16px', padding: '1.375rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>✦</span>
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)' }}>AI Design Studio</p>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.28)' }}>Descreve o teu briefing e recebe um conceito completo com paleta, tipografia e técnica de impressão</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <textarea
                    value={studioPrompt}
                    onChange={e => setStudioPrompt(e.target.value)}
                    placeholder="Ex: Kit de boas-vindas para 200 novos colaboradores. Empresa tech B2B, tom moderno e minimalista, tons de azul e branco..."
                    rows={3}
                    style={{ flex: 1, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.10)', borderRadius: '0px', padding: '0.75rem', color: 'rgba(240,236,228,0.72)', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                  {['Kit corporativo minimalista', 'Evento desportivo vibrante', 'Linha eco-friendly premium', 'Natal & festividades'].map(suggestion => (
                    <button key={suggestion} type="button" onClick={() => setStudioPrompt(suggestion)}
                      style={{ padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 500, cursor: 'pointer', background: 'rgba(240,236,228,0.06)', border: '1px solid rgba(240,236,228,0.10)', color: 'rgba(240,236,228,0.42)', transition: 'all 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.4)'; (e.currentTarget as HTMLElement).style.color = '#d4b47a'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,236,228,0.10)'; (e.currentTarget as HTMLElement).style.color = 'rgba(240,236,228,0.42)'; }}>
                      {suggestion}
                    </button>
                  ))}
                </div>

                <motion.button type="button" onClick={handleStudioGenerate} disabled={!studioPrompt.trim() || studioLoading} whileTap={{ scale: 0.97 }}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '0px', fontSize: '0.78rem', fontWeight: 700, cursor: studioPrompt.trim() && !studioLoading ? 'pointer' : 'not-allowed', background: studioPrompt.trim() && !studioLoading ? '#b8975e' : 'rgba(240,236,228,0.06)', color: studioPrompt.trim() && !studioLoading ? '#fff' : 'rgba(240,236,228,0.28)', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 200ms', marginBottom: '0.875rem' }}>
                  {studioLoading ? (
                    <><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(240,236,228,0.28)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> A gerar conceito...</>
                  ) : '✦ Gerar Conceito de Design'}
                </motion.button>

                <AnimatePresence>
                  {studioResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
                      style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '0px', padding: '1rem 1.125rem' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d4b47a', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>Conceito gerado</p>
                      <pre style={{ fontSize: '0.76rem', color: 'rgb(195,210,230)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', margin: 0 }}>{studioResult}</pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Upload zone ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? '#d4b47a' : 'rgba(240,236,228,0.12)'}`, borderRadius: '16px', padding: '2.5rem', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(154,124,74,0.08)' : 'rgba(255,255,255,0.02)', transition: 'all 200ms', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.625rem' }}>☁️</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)', marginBottom: '0.3rem' }}>
            {uploading ? 'A enviar...' : 'Arrasta ficheiros aqui ou clica para selecionar'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.28)' }}>SVG, PDF, AI, EPS, PNG, JPG — máx. 50MB por ficheiro</div>
          {uploadMsg && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: uploadMsg.startsWith('✓') ? '#b8975e' : 'rgb(245,158,11)', fontWeight: 600 }}>{uploadMsg}</div>
          )}
          <input ref={fileRef} type="file" multiple accept=".svg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.webp,.zip" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files)} />
        </motion.div>

        {/* Info tips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '🎨', title: 'Logótipos', desc: 'SVG ou AI preferível para melhor qualidade de impressão' },
            { icon: '📐', title: 'Resolução', desc: 'PNG/JPG: mínimo 300dpi para impressão de qualidade' },
            { icon: '📋', title: 'Briefing', desc: 'Inclui um PDF com instruções de cor e uso de marca' },
          ].map(tip => (
            <div key={tip.title} style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '0px', padding: '0.875rem' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{tip.icon}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)', marginBottom: '0.2rem' }}>{tip.title}</div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.28)', lineHeight: 1.45 }}>{tip.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Files list ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Os meus ficheiros {assets.length > 0 && `(${assets.length})`}
          </h2>
          {assets.length > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.28)' }}>Clica em "Analisar Arte" para verificação técnica IA</span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '60px', borderRadius: '0px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.28)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '0px' }}>
            Nenhum ficheiro enviado ainda. Começa por carregar o teu logótipo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {assets.map((asset, i) => {
              const analysis = analysisMap[asset.name];
              const isAnalyzing = analyzingMap[asset.name] ?? false;
              const isExpanded = expandedAsset === asset.name && !!analysis;
              const vc = verdictColor(analysis?.verdict);

              return (
                <motion.div key={asset.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  {/* Asset row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(240,236,228,0.04)', border: `1px solid ${analysis ? `${vc}22` : 'rgba(240,236,228,0.06)'}`, borderRadius: isExpanded ? '12px 12px 0 0' : '12px', transition: 'border-color 300ms' }}>
                    {/* Score ring or file icon */}
                    <div style={{ flexShrink: 0, width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {analysis ? <ScoreRing score={analysis.score} /> : <span style={{ fontSize: '1.5rem' }}>{fileIcon(asset.name)}</span>}
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.name.replace(/^\d+_/, '')}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.28)', marginTop: '0.1rem' }}>
                        {formatSize(asset.size)} · {new Date(asset.updated_at).toLocaleDateString('pt-PT')}
                        {analysis && (
                          <span style={{ marginLeft: '0.5rem', color: vc, fontWeight: 700 }}>· {verdictLabel(analysis.verdict)}</span>
                        )}
                      </div>
                      {/* Print-safe badge */}
                      {analysis && (
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '9999px', background: analysis.printSafe ? 'rgba(184,151,94,0.12)' : 'rgba(239,68,68,0.12)', color: analysis.printSafe ? '#b8975e' : 'rgb(239,68,68)', fontWeight: 600 }}>
                            {analysis.printSafe ? '✓ Print-safe' : '✕ Revisão necessária'}
                          </span>
                          <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '9999px', background: 'rgba(240,236,228,0.06)', color: 'rgba(240,236,228,0.42)', fontWeight: 500 }}>
                            {analysis.resolution} · {analysis.colorMode}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                      {/* Analyze button */}
                      <motion.button type="button" whileTap={{ scale: 0.95 }}
                        onClick={() => analysis ? setExpandedAsset(isExpanded ? null : asset.name) : analyzeAsset(asset)}
                        disabled={isAnalyzing}
                        style={{ background: analysis ? `${vc}18` : 'rgba(154,124,74,0.08)', border: `1px solid ${analysis ? `${vc}30` : 'rgba(154,124,74,0.18)'}`, borderRadius: '7px', padding: '0.2rem 0.6rem', cursor: isAnalyzing ? 'wait' : 'pointer', fontSize: '0.62rem', color: analysis ? vc : '#d4b47a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                        {isAnalyzing ? (
                          <><span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid rgba(154,124,74,0.28)', borderTop: '2px solid #d4b47a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> A analisar</>
                        ) : analysis ? (isExpanded ? '▲ Fechar' : '▼ Detalhes') : '🔬 Analisar Arte'}
                      </motion.button>

                      {/* Delete */}
                      <button type="button" onClick={() => handleDelete(asset.name)}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.62rem', color: 'rgb(239,68,68)', fontWeight: 600, transition: 'all 150ms' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}>
                        Remover
                      </button>
                    </div>
                  </div>

                  {/* Analysis expanded panel */}
                  <AnimatePresence>
                    {isExpanded && analysis && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${vc}22`, borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                        <div style={{ padding: '0.875rem 1rem' }}>
                          {/* Details text */}
                          <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.65)', lineHeight: 1.55, marginBottom: '0.75rem' }}>{analysis.details}</p>

                          {/* Issues */}
                          {analysis.issues.length > 0 && (
                            <div style={{ marginBottom: '0.625rem' }}>
                              <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgb(239,68,68)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Problemas detectados</p>
                              {analysis.issues.map((issue, ii) => (
                                <div key={ii} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                                  <span style={{ color: 'rgb(239,68,68)', fontSize: '0.72rem', flexShrink: 0 }}>✕</span>
                                  <span style={{ fontSize: '0.72rem', color: 'rgb(160,175,195)', lineHeight: 1.45 }}>{issue}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Suggestions */}
                          {analysis.suggestions.length > 0 && (
                            <div>
                              <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#b8975e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Sugestões de melhoria</p>
                              {analysis.suggestions.map((s, si) => (
                                <div key={si} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                                  <span style={{ color: '#b8975e', fontSize: '0.72rem', flexShrink: 0 }}>→</span>
                                  <span style={{ fontSize: '0.72rem', color: 'rgb(160,175,195)', lineHeight: 1.45 }}>{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
