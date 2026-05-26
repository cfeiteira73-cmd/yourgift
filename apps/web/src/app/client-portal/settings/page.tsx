'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

export default function ClientSettingsPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nif, setNif] = useState('');

  // Notification prefs
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifQuotes, setNotifQuotes] = useState(true);
  const [notifDelivery, setNotifDelivery] = useState(true);
  const [notifNewsletter, setNotifNewsletter] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/settings'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        setName(c.name ?? '');
        setCompany(c.company ?? '');
        setPhone(c.phone ?? '');
        setAddress(c.address ?? '');
        setNif(c.nif ?? '');
        if (c.notification_prefs) {
          setNotifOrders(c.notification_prefs.orders ?? true);
          setNotifQuotes(c.notification_prefs.quotes ?? true);
          setNotifDelivery(c.notification_prefs.delivery ?? true);
          setNotifNewsletter(c.notification_prefs.newsletter ?? false);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    if (!client) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('clients').update({
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      address: address.trim(),
      nif: nif.trim(),
      notification_prefs: { orders: notifOrders, quotes: notifQuotes, delivery: notifDelivery, newsletter: notifNewsletter },
    }).eq('id', client.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '9px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: 'rgb(220,230,245)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms',
  };

  function Field({ label, value, onChange, placeholder, type = 'text', readOnly = false }: { label: string; value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean }) {
    return (
      <div>
        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>{label}</label>
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? 'not-allowed' : 'text' }}
          onFocus={e => !readOnly && (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
        {readOnly && <div style={{ fontSize: '0.6rem', color: 'rgb(60,72,90)', marginTop: '0.2rem' }}>Gerido pela conta de autenticação</div>}
      </div>
    );
  }

  function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(200,215,235)' }}>{label}</div>
          <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', marginTop: '0.1rem' }}>{desc}</div>
        </div>
        <button type="button" onClick={() => onChange(!checked)}
          style={{ width: '40px', height: '22px', borderRadius: '11px', background: checked ? 'rgb(77,163,255)' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: checked ? '21px' : '3px', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>
    );
  }

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '620px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Definições</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Gere o teu perfil e preferências</p>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: '52px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (
          <>
            {/* Account info */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Conta & Autenticação</h2>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {(client?.name ?? userEmail).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgb(220,230,245)' }}>{client?.name || 'Sem nome'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)', marginTop: '0.1rem' }}>{userEmail}</div>
                  {client?.tier && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(245,158,11)', background: 'rgba(245,158,11,0.12)', borderRadius: '6px', padding: '0.1rem 0.4rem', marginTop: '0.2rem', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {client.tier}
                    </span>
                  )}
                </div>
              </div>

              <Field label="Email" value={userEmail} readOnly />
            </motion.section>

            {/* Profile */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Dados de Perfil</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field label="Nome Completo" value={name} onChange={setName} placeholder="O teu nome" />
                <Field label="Empresa / Marca" value={company} onChange={setCompany} placeholder="Nome da empresa" />
                <Field label="Telefone" value={phone} onChange={setPhone} placeholder="+351 912 345 678" type="tel" />
                <Field label="NIF" value={nif} onChange={setNif} placeholder="123456789" />
                <Field label="Morada de Faturação" value={address} onChange={setAddress} placeholder="Rua, cidade, código postal" />
              </div>
            </motion.section>

            {/* Notifications */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Notificações por Email</h2>
              <Toggle label="Actualizações de Encomendas" desc="Recebe notificações quando o estado das encomendas muda" checked={notifOrders} onChange={setNotifOrders} />
              <Toggle label="Respostas a Orçamentos" desc="Notificação quando um orçamento for respondido" checked={notifQuotes} onChange={setNotifQuotes} />
              <Toggle label="Confirmação de Entrega" desc="Email de confirmação quando a encomenda for entregue" checked={notifDelivery} onChange={setNotifDelivery} />
              <Toggle label="Newsletter & Novidades" desc="Novos produtos, campanhas e promoções especiais" checked={notifNewsletter} onChange={setNotifNewsletter} />
            </motion.section>

            {/* Support */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>Suporte & Contacto</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { icon: '✉️', label: 'Email Suporte', value: 'geral@yourgift.pt', href: 'mailto:geral@yourgift.pt?subject=Suporte Portal Cliente' },
                  { icon: '📱', label: 'WhatsApp', value: '+351 912 345 678', href: 'https://wa.me/351912345678' },
                ].map(item => (
                  <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textDecoration: 'none', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}>
                    <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'rgb(77,163,255)', fontWeight: 600 }}>{item.value}</div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.section>

            {/* Save + Sign out */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={handleSignOut}
                style={{ padding: '0.5rem 1rem', borderRadius: '9px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgb(239,68,68)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                Terminar Sessão
              </button>
              <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '9px', background: saved ? 'rgb(99,230,190)' : 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', border: 'none', color: saved ? 'rgb(7,17,31)' : '#fff', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1, transition: 'background 300ms' }}>
                {saving ? 'A guardar...' : saved ? '✓ Guardado!' : 'Guardar Alterações'}
              </motion.button>
            </motion.div>
          </>
        )}
      </div>
    </ClientPortalLayout>
  );
}
