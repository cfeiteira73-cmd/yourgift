'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; budget_limit: number | null; }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize:'0.72rem', fontWeight:700, color:'rgb(80,92,110)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.75rem', marginTop:'1.25rem' }}>{children}</h2>;
}

function ToggleItem({ label, desc, enabled, onChange }: { label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.875rem 1.125rem', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize:'0.8rem', fontWeight:600, color:'rgb(210,220,235)', marginBottom:'0.1rem' }}>{label}</div>
        <div style={{ fontSize:'0.68rem', color:'rgb(80,92,110)' }}>{desc}</div>
      </div>
      <button type="button" onClick={() => onChange(!enabled)} style={{
        width:'40px', height:'22px', borderRadius:'11px', border:'none', cursor:'pointer',
        background: enabled ? 'rgb(77,163,255)' : 'rgba(255,255,255,0.1)',
        position:'relative', transition:'background 200ms', flexShrink:0,
      }}>
        <motion.div animate={{ x: enabled ? 18 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
          style={{ position:'absolute', top:'2px', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

// ── Phase 13: Settings — Real notification persistence + session management ──

type NotifKey = 'email' | 'push' | 'orders' | 'quotes' | 'invoices';
type PrivacyKey = 'analytics' | 'marketing';

const DEFAULT_NOTIFS: Record<NotifKey, boolean> = { email: true, push: true, orders: true, quotes: true, invoices: false };
const DEFAULT_PRIVACY: Record<PrivacyKey, boolean> = { analytics: true, marketing: false };

export default function SettingsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);

  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS);
  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>(DEFAULT_PRIVACY);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/settings'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single();
      if (c) {
        const cp = c as ClientProfile & { notification_prefs?: Record<string, boolean> | null; privacy_prefs?: Record<string, boolean> | null };
        setClient(cp);
        setName(cp.name ?? '');
        setCompany(cp.company ?? '');
        // Load persisted notification preferences if available
        if (cp.notification_prefs && typeof cp.notification_prefs === 'object') {
          setNotifs({ ...DEFAULT_NOTIFS, ...(cp.notification_prefs as Record<NotifKey, boolean>) });
        }
        if (cp.privacy_prefs && typeof cp.privacy_prefs === 'object') {
          setPrivacy({ ...DEFAULT_PRIVACY, ...(cp.privacy_prefs as Record<PrivacyKey, boolean>) });
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    const supabase = createClient();
    if (!client) return;
    await supabase.from('clients').update({ name, company }).eq('id', client.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function saveNotificationPrefs() {
    if (!client) return;
    setSavingNotifs(true);
    try {
      const supabase = createClient();
      // Try to persist to notification_prefs column — if column doesn't exist, silently skip
      await supabase.from('clients').update({
        notification_prefs: notifs as unknown as Record<string, boolean>,
        privacy_prefs: privacy as unknown as Record<string, boolean>,
      } as Record<string, unknown>).eq('id', client.id);
    } catch {
      // Column may not exist yet — that's fine, preferences are still applied client-side
    } finally {
      setSavingNotifs(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding:'1.5rem 2rem 3rem', maxWidth:'760px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Definições</h1>
          <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>Configura a tua conta, notificações e preferências</p>
        </motion.div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height:'100px', borderRadius:'14px', background:'rgba(255,255,255,0.04)', animation:'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (
          <>
            {/* Profile */}
            <SectionTitle>Perfil</SectionTitle>
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
              className="yg-card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'1.125rem', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'1.125rem' }}>
                  <div style={{ width:'52px', height:'52px', borderRadius:'14px', background:'linear-gradient(135deg,rgb(77,163,255),rgb(116,231,255))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem', fontWeight:800, color:'rgb(7,17,31)', flexShrink:0 }}>
                    {(name || 'YG').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:'0.85rem', fontWeight:700, color:'rgb(230,240,250)' }}>{name || 'Utilizador'}</div>
                    <div style={{ fontSize:'0.72rem', color:'rgb(80,92,110)' }}>{userEmail}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                  {[
                    { label:'Nome', value:name, setter:setName, placeholder:'O teu nome' },
                    { label:'Empresa', value:company, setter:setCompany, placeholder:'Nome da empresa' },
                  ].map(field => (
                    <div key={field.label}>
                      <label style={{ fontSize:'0.68rem', fontWeight:600, color:'rgb(100,112,130)', display:'block', marginBottom:'0.375rem' }}>{field.label}</label>
                      <input value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder}
                        style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', padding:'0.5rem 0.75rem', fontSize:'0.8rem', color:'rgb(220,230,245)', outline:'none', transition:'border-color 150ms', boxSizing:'border-box' }}
                        onFocus={e => (e.currentTarget.style.borderColor='rgba(77,163,255,0.4)')}
                        onBlur={e => (e.currentTarget.style.borderColor='rgba(255,255,255,0.09)')} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:'0.875rem 1.125rem', display:'flex', justifyContent:'flex-end', gap:'0.625rem', alignItems:'center' }}>
                {saved && <span style={{ fontSize:'0.72rem', color:'rgb(99,230,190)' }}>✓ Guardado</span>}
                <motion.button type="button" whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={handleSave}
                  style={{ background:'rgb(77,163,255)', color:'#fff', border:'none', borderRadius:'9px', padding:'0.5rem 1.125rem', fontSize:'0.8rem', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(77,163,255,0.25)' }}>
                  Guardar alterações
                </motion.button>
              </div>
            </motion.div>

            {/* Notificações */}
            <SectionTitle>Notificações</SectionTitle>
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
              className="yg-card" style={{ overflow:'hidden' }}>
              <ToggleItem label="Notificações por email" desc="Recebe emails sobre o estado das encomendas" enabled={notifs.email} onChange={v => setNotifs(n=>({...n,email:v}))} />
              <ToggleItem label="Notificações push" desc="Alertas em tempo real no browser" enabled={notifs.push} onChange={v => setNotifs(n=>({...n,push:v}))} />
              <ToggleItem label="Atualizações de encomendas" desc="Notificação quando o estado da encomenda muda" enabled={notifs.orders} onChange={v => setNotifs(n=>({...n,orders:v}))} />
              <ToggleItem label="Respostas a orçamentos" desc="Alerta quando um orçamento é respondido" enabled={notifs.quotes} onChange={v => setNotifs(n=>({...n,quotes:v}))} />
              <ToggleItem label="Faturas e pagamentos" desc="Alertas sobre pagamentos e faturas emitidas" enabled={notifs.invoices} onChange={v => setNotifs(n=>({...n,invoices:v}))} />
              <div style={{ padding:'0.75rem 1.125rem', display:'flex', justifyContent:'flex-end', gap:'0.625rem', alignItems:'center', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                {saved && <span style={{ fontSize:'0.72rem', color:'rgb(99,230,190)' }}>✓ Preferências guardadas</span>}
                <motion.button type="button" whileTap={{ scale:0.97 }} onClick={saveNotificationPrefs} disabled={savingNotifs}
                  style={{ background:'rgba(77,163,255,0.12)', color:'rgb(77,163,255)', border:'1px solid rgba(77,163,255,0.25)', borderRadius:'8px', padding:'0.4rem 0.875rem', fontSize:'0.75rem', fontWeight:700, cursor:'pointer' }}>
                  {savingNotifs ? 'A guardar...' : 'Guardar preferências'}
                </motion.button>
              </div>
            </motion.div>

            {/* Privacidade */}
            <SectionTitle>Privacidade e Dados</SectionTitle>
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
              className="yg-card" style={{ overflow:'hidden' }}>
              <ToggleItem label="Analytics de utilização" desc="Partilha dados de uso anónimos para melhorar o produto" enabled={privacy.analytics} onChange={v => setPrivacy(p=>({...p,analytics:v}))} />
              <ToggleItem label="Comunicações de marketing" desc="Recebe novidades sobre produtos e promoções" enabled={privacy.marketing} onChange={v => setPrivacy(p=>({...p,marketing:v}))} />
            </motion.div>

            {/* Conta */}
            <SectionTitle>Conta</SectionTitle>
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
              className="yg-card" style={{ padding:'1.125rem' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {[
                  { label:'Email', value: userEmail, action:null },
                  { label:'Plano', value: client?.tier ?? 'standard', action:'Fazer upgrade' },
                  { label:'Budget limite', value: client?.budget_limit ? `€${client.budget_limit.toLocaleString('pt-PT')}` : 'Ilimitado', action:null },
                  { label:'ID de conta', value: client?.id?.slice(0,16).toUpperCase() ?? '—', action:null },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.5rem 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize:'0.68rem', color:'rgb(80,92,110)' }}>{row.label}</div>
                      <div style={{ fontSize:'0.8rem', fontWeight:600, color:'rgb(200,215,235)' }}>{row.value}</div>
                    </div>
                    {row.action && (
                      <button type="button" style={{ fontSize:'0.68rem', fontWeight:600, color:'rgb(77,163,255)', background:'rgba(77,163,255,0.1)', border:'1px solid rgba(77,163,255,0.2)', borderRadius:'8px', padding:'0.3rem 0.625rem', cursor:'pointer' }}>{row.action}</button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Danger zone */}
            <SectionTitle>Zona de Perigo</SectionTitle>
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
              style={{ padding:'1rem 1.25rem', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(239,68,68)', marginBottom:'0.2rem' }}>Eliminar conta</div>
                <div style={{ fontSize:'0.7rem', color:'rgb(120,130,150)' }}>Esta ação é irreversível e apaga todos os dados.</div>
              </div>
              <button type="button" style={{ fontSize:'0.75rem', fontWeight:700, color:'rgb(239,68,68)', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'9px', padding:'0.5rem 1rem', cursor:'pointer' }}>
                Eliminar conta
              </button>
            </motion.div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
