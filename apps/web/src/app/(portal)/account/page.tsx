'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Account Management Page ───────────────────────────────────────────────────
//
// Admin account profile, security settings, active sessions.
// Only accessible by admin emails (middleware-gated).
//
// ─────────────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  created_at: string;
  user_agent?: string | null;
  ip?: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [copied, setCopied] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/account'); return; }
      setEmail(user.email ?? '');
      setUserId(user.id);
      setCreatedAt(user.created_at ?? '');

      // Fetch active sessions
      const { data: sessData } = await supabase.auth.getSession();
      if (sessData.session) {
        setSessions([{
          id: sessData.session.access_token.slice(-8),
          created_at: new Date(sessData.session.expires_at ? sessData.session.expires_at * 1000 - 3600000 : Date.now()).toISOString(),
          user_agent: navigator.userAgent.slice(0, 80),
          ip: null,
        }]);
      }
            } catch (err) {
        console.error("[account] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function sendPasswordReset() {
    if (!email) return;
    setChangingPwd(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setPwdMsg(error ? `Erro: ${error.message}` : 'Email enviado! Verifique a sua caixa de entrada.');
    setChangingPwd(false);
  }

  function copyUserId() {
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const initials = email.split('@')[0]?.slice(0, 2).toUpperCase() || 'YG';

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-white text-base font-semibold">Conta</h1>
        <p className="text-white/40 text-xs mt-0.5">Perfil de administrador · Segurança · Sessões ativas</p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* Profile card */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <h2 className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-4">Perfil</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-[#07111f] font-black text-lg flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{email}</p>
                <p className="text-white/40 text-xs mt-0.5">Administrador · Acesso total</p>
                <p className="text-white/25 text-[10px] mt-1 font-mono">
                  Membro desde {createdAt ? fmtDate(createdAt) : '—'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex-shrink-0">
                ● Ativo
              </span>
            </div>
          </div>

          {/* User ID */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <h2 className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-3">Identificador</h2>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-white/50 text-[11px] font-mono bg-white/5 rounded-lg px-3 py-2 truncate">
                {userId}
              </code>
              <button type="button"
                type="button"
                onClick={copyUserId}
                className="px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[11px] transition-colors flex-shrink-0"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
            <h2 className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Segurança</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-xs font-medium">Palavra-passe</p>
                <p className="text-white/30 text-[10px] mt-0.5">Enviar link de redefinição por email</p>
              </div>
              <button type="button"
                type="button"
                onClick={sendPasswordReset}
                disabled={changingPwd}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 text-[11px] font-medium transition-colors disabled:opacity-40"
              >
                {changingPwd ? '⟳ A enviar…' : 'Redefinir →'}
              </button>
            </div>

            {pwdMsg && (
              <div className={`rounded-lg px-3 py-2 text-[11px] ${
                pwdMsg.startsWith('Erro') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {pwdMsg}
              </div>
            )}

            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">Autenticação de dois fatores</p>
                  <p className="text-white/30 text-[10px] mt-0.5">MFA via aplicação autenticadora</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                  Em breve
                </span>
              </div>
            </div>
          </div>

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Sessões Ativas</h2>
                <span className="text-[10px] text-white/20">{sessions.length} sessão</span>
              </div>
              {sessions.map(s => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(77,163,255)" strokeWidth="1.75">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-[11px] font-medium truncate">
                      {s.user_agent ?? 'Browser desconhecido'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-white/25 text-[10px]">
                        Iniciada {timeAgo(s.created_at)}
                      </span>
                      {s.ip && (
                        <span className="text-white/20 text-[10px] font-mono">{s.ip}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-emerald-400 text-[10px] font-semibold flex-shrink-0">● Atual</span>
                </div>
              ))}
            </div>
          )}

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-500/10 bg-red-500/3 p-5 space-y-3">
            <h2 className="text-red-400/60 text-[10px] font-semibold uppercase tracking-wider">Zona Perigosa</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium">Terminar todas as sessões</p>
                <p className="text-white/25 text-[10px] mt-0.5">Encerra a sessão em todos os dispositivos</p>
              </div>
              <button type="button"
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut({ scope: 'global' });
                  router.push('/auth/login');
                }}
                className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 text-[11px] font-medium transition-colors"
              >
                Terminar sessões
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
