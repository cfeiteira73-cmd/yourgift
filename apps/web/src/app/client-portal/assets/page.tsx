'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface Asset { name: string; size: number; updated_at: string; }

export default function ClientAssetsPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/assets'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        // List files in client-assets bucket under client's folder
        const { data: files } = await supabase.storage.from('client-assets').list(`${c.id}/`, { sortBy: { column: 'updated_at', order: 'desc' } });
        setAssets((files ?? []).filter((f: any) => f.name !== '.emptyFolderPlaceholder') as Asset[]);
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
    const results = [];
    for (const file of Array.from(files)) {
      // Validate: only design-safe formats
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowed = ['svg', 'pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
      if (!allowed.includes(ext ?? '')) {
        setUploadMsg(`⚠️ ${file.name}: formato não suportado. Use SVG, PDF, AI, EPS, PNG, JPG.`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        setUploadMsg(`⚠️ ${file.name}: ficheiro demasiado grande (máx. 50MB).`);
        continue;
      }
      const path = `${client.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('client-assets').upload(path, file, { upsert: true });
      if (!error) results.push(file.name);
    }
    if (results.length > 0) {
      setUploadMsg(`✓ ${results.join(', ')} enviado com sucesso!`);
      // Refresh list
      const { data: files } = await supabase.storage.from('client-assets').list(`${client.id}/`, { sortBy: { column: 'updated_at', order: 'desc' } });
      setAssets((files ?? []).filter((f: any) => f.name !== '.emptyFolderPlaceholder') as Asset[]);
    }
    setUploading(false);
  }

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

  async function handleDelete(name: string) {
    if (!client) return;
    const supabase = createClient();
    await supabase.storage.from('client-assets').remove([`${client.id}/${name}`]);
    setAssets(prev => prev.filter(a => a.name !== name));
  }

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Maquetes & Assets</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Envia os teus logótipos e artes. Formatos aceites: SVG, PDF, AI, EPS, PNG, JPG (máx. 50MB)</p>
        </motion.div>

        {/* Upload zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'rgb(77,163,255)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '16px', padding: '2.5rem', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.02)',
            transition: 'all 200ms', marginBottom: '1.25rem',
          }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.625rem' }}>☁️</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(210,220,235)', marginBottom: '0.3rem' }}>
            {uploading ? 'A enviar...' : 'Arrasta ficheiros aqui ou clica para selecionar'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>SVG, PDF, AI, EPS, PNG, JPG — máx. 50MB por ficheiro</div>
          {uploadMsg && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: uploadMsg.startsWith('✓') ? 'rgb(99,230,190)' : 'rgb(245,158,11)', fontWeight: 600 }}>{uploadMsg}</div>
          )}
          <input ref={fileRef} type="file" multiple accept=".svg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.webp,.zip" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files)} />
        </motion.div>

        {/* Info boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '🎨', title: 'Logótipos', desc: 'SVG ou AI preferível para melhor qualidade de impressão' },
            { icon: '📐', title: 'Resolução', desc: 'PNG/JPG: mínimo 300dpi para impressão de qualidade' },
            { icon: '📋', title: 'Briefing', desc: 'Inclui um PDF com instruções de cor e uso de marca' },
          ].map(tip => (
            <div key={tip.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.875rem' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{tip.icon}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(200,215,235)', marginBottom: '0.2rem' }}>{tip.title}</div>
              <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', lineHeight: 1.45 }}>{tip.desc}</div>
            </div>
          ))}
        </div>

        {/* Files list */}
        <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Os meus ficheiros {assets.length > 0 && `(${assets.length})`}
        </h2>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '52px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
            Nenhum ficheiro enviado ainda. Começa por carregar o teu logótipo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {assets.map((asset, i) => (
              <motion.div key={asset.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{fileIcon(asset.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(210,220,235)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name.replace(/^\d+_/, '')}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>
                    {formatSize(asset.size)} · {new Date(asset.updated_at).toLocaleDateString('pt-PT')}
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(asset.name)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.62rem', color: 'rgb(239,68,68)', fontWeight: 600, transition: 'all 150ms' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}>
                  Remover
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
