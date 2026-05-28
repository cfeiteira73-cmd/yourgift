'use client';

// ── OMEGA PROTOCOL — S15: Human Operations Layer ──────────────────────────────
//
// SOPs · Runbooks · Escalation matrices · Incident protocols
// Interactive operational procedures with step-by-step execution tracking
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, fadeUp, delayedFadeUp, tapScale } from '@/lib/motion';

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

// ── Runbook definitions ───────────────────────────────────────────────────────

interface RunbookStep { id: string; title: string; description: string; owner: string; duration: string; critical?: boolean; }
interface Runbook {
  id: string; category: string; title: string; description: string; severity: 'info' | 'warning' | 'critical';
  trigger: string; steps: RunbookStep[]; escalation: string; adminOnly?: boolean;
}

const RUNBOOKS: Runbook[] = [
  {
    id: 'sla-breach',
    category: 'SLA',
    title: 'Resposta a Quebra de SLA',
    description: 'Procedimento de resposta imediata quando uma encomenda viola o SLA definido.',
    severity: 'critical',
    trigger: 'Encomenda em estado activo durante mais de 100% do tempo crítico do SLA',
    adminOnly: true,
    escalation: 'Director Operacional → CEO se > 24h sem resolução',
    steps: [
      { id: '1', title: 'Identificar a encomenda', description: 'Aceder ao Cockpit Executivo > Radar SLA. Identificar encomenda(s) em vermelho com tempo de permanência acima do critical_hours.', owner: 'Ops Team', duration: '2 min' },
      { id: '2', title: 'Contactar o fornecedor', description: 'Ligar directamente ao fornecedor prioritário. Obter ETA actualizado e razão do atraso. Documentar no sistema.', owner: 'Account Manager', duration: '10 min', critical: true },
      { id: '3', title: 'Notificar o cliente', description: 'Enviar email personalizado ao cliente explicando a situação e o novo ETA. Tom empático, proactivo e com acção de compensação se necessário.', owner: 'Account Manager', duration: '5 min', critical: true },
      { id: '4', title: 'Activar fornecedor de failover', description: 'Se ETA > 48h adicional, contactar fornecedor alternativo (score mais próximo). Avaliar custo vs. impacto no cliente.', owner: 'Procurement', duration: '20 min' },
      { id: '5', title: 'Actualizar status no sistema', description: 'Actualizar notas internas da encomenda. Registar acção no audit log. Marcar como "incident_open" no sistema.', owner: 'Ops Team', duration: '3 min' },
      { id: '6', title: 'Post-mortem', description: 'Após resolução, preencher análise de causa raiz. Propor melhoria no SLA ou processo de sourcing para evitar recorrência.', owner: 'Operations Director', duration: '30 min' },
    ],
  },
  {
    id: 'stock-critical',
    category: 'Inventário',
    title: 'Stock Crítico / Ruptura',
    description: 'Protocolo de gestão quando produto-chave atinge nível crítico ou ruptura total.',
    severity: 'critical',
    trigger: 'inventory_alerts com alert_type = out_of_stock para SKU activo em pipeline',
    adminOnly: true,
    escalation: 'Procurement Manager → Operations Director se ruptura > 48h',
    steps: [
      { id: '1', title: 'Confirmar ruptura', description: 'Verificar alerta no Cockpit. Confirmar stock real no sistema do fornecedor. Validar quantidades em encomendas abertas que afectam este SKU.', owner: 'Procurement', duration: '5 min' },
      { id: '2', title: 'Mapear impacto em encomendas', description: 'Listar todas as encomendas activas que incluem o produto em ruptura. Priorizar por data de entrega e valor de cliente.', owner: 'Ops Team', duration: '10 min', critical: true },
      { id: '3', title: 'Alternativa de produto', description: 'Identificar produto substituto do catálogo com especificações similares. Propor ao cliente via email com comparativo.', owner: 'Account Manager', duration: '15 min' },
      { id: '4', title: 'Reorder emergência', description: 'Emitir pedido de emergência ao fornecedor primário ou alternativo. Documentar lead time extra e custo adicional.', owner: 'Procurement', duration: '20 min', critical: true },
      { id: '5', title: 'Comunicação proactiva', description: 'Para cada encomenda afectada: contactar cliente, explicar, propor alternativa ou novo prazo. Oferecer compensação se necessário.', owner: 'Account Manager', duration: '30 min' },
      { id: '6', title: 'Rever nível de safety stock', description: 'Após resolução, actualizar threshold de safety stock para o produto. Aumentar buffer em 20-30% para SKUs críticos.', owner: 'Procurement Manager', duration: '15 min' },
    ],
  },
  {
    id: 'client-onboarding',
    category: 'Clientes',
    title: 'Onboarding de Novo Cliente',
    description: 'Processo de activação e boas-vindas para clientes novos da plataforma.',
    severity: 'info',
    trigger: 'Novo registo de cliente no sistema (client_joined event)',
    adminOnly: true,
    escalation: 'N/A — processo standard',
    steps: [
      { id: '1', title: 'Verificar perfil', description: 'Confirmar dados da empresa, NIF, morada de facturação e contacto primário. Validar tier atribuído automaticamente.', owner: 'Account Manager', duration: '5 min' },
      { id: '2', title: 'Email de boas-vindas', description: 'Enviar email personalizado de boas-vindas com credenciais, link para o portal, catálogo PDF e contacto directo do account manager.', owner: 'Account Manager', duration: '10 min', critical: true },
      { id: '3', title: 'Reunião de kick-off', description: 'Agendar call de 30min para apresentar a plataforma, perceber necessidades e definir primeiro briefing de merchandise.', owner: 'Account Manager', duration: '2 dias' },
      { id: '4', title: 'Configurar budget e limites', description: 'Definir budget_limit no perfil do cliente. Configurar threshold de aprovação automática. Activar notificações relevantes.', owner: 'Ops Team', duration: '5 min' },
      { id: '5', title: 'Primeiro orçamento', description: 'Proactivamente preparar um orçamento de exemplo com 3 produtos do catálogo relevantes ao sector do cliente.', owner: 'Account Manager', duration: '20 min' },
    ],
  },
  {
    id: 'artwork-approval',
    category: 'Artes Finais',
    title: 'Fluxo de Aprovação de Arte Final',
    description: 'Procedimento padrão para validação e aprovação de artes finais antes de produção.',
    severity: 'warning',
    trigger: 'Arte final submetida pelo cliente via portal (assets page)',
    adminOnly: false,
    escalation: 'Se cliente não responde em 48h → enviar reminder automático; 72h → contacto directo',
    steps: [
      { id: '1', title: 'Receber e catalogar', description: 'Verificar formato (PDF/AI/EPS), resolução mínima 300dpi, modo de cor CMYK, sangrias correctas. Usar análise AI disponível no portal.', owner: 'Pre-press Team', duration: '10 min' },
      { id: '2', title: 'Análise técnica', description: 'Verificar: fontes incorporadas, imagens linked vs. embedded, perfil de cor, área de segurança respeitada, dimensões correctas.', owner: 'Pre-press Team', duration: '20 min', critical: true },
      { id: '3', title: 'Mockup digital', description: 'Gerar mockup digital com a arte aplicada ao produto. Enviar ao cliente para aprovação visual antes de avançar para produção.', owner: 'Design', duration: '30 min' },
      { id: '4', title: 'Aprovação do cliente', description: 'Cliente confirma por email ou via portal. Guardar evidência de aprovação no sistema. Criar versão aprovada no histórico de artes.', owner: 'Account Manager', duration: '24h (cliente)', critical: true },
      { id: '5', title: 'Envio para produção', description: 'Enviar ficheiro aprovado para o fornecedor com especificações técnicas completas. Confirmar recepção e prazo de produção.', owner: 'Procurement', duration: '1h' },
    ],
  },
  {
    id: 'high-value-order',
    category: 'Encomendas',
    title: 'Processamento de Encomenda de Alto Valor',
    description: 'Protocolo especial para encomendas acima de €10.000 — validação extra e acompanhamento dedicado.',
    severity: 'warning',
    trigger: 'Encomenda criada com total_amount > €10.000',
    adminOnly: true,
    escalation: 'Director Operacional acompanha directamente. CEO notificado se > €50K.',
    steps: [
      { id: '1', title: 'Validação financeira', description: 'Confirmar limite de crédito do cliente. Verificar histórico de pagamentos. Para clientes novos: solicitar pré-pagamento de 30%.', owner: 'Finance', duration: '15 min', critical: true },
      { id: '2', title: 'Confirmar stock e capacidade', description: 'Verificar disponibilidade de todos os itens com o fornecedor. Garantir que a produção cabe no calendário actual.', owner: 'Procurement', duration: '20 min', critical: true },
      { id: '3', title: 'Proposta formal', description: 'Emitir proposta formal com detalhamento de preços, condições, timeline e termos. Enviar para assinatura digital.', owner: 'Account Manager', duration: '1h' },
      { id: '4', title: 'Aprovação interna', description: 'Obter aprovação do Director Operacional antes de confirmar ao cliente. Documentar no sistema.', owner: 'Operations Director', duration: '4h' },
      { id: '5', title: 'Confirmação ao cliente', description: 'Confirmar encomenda formalmente. Atribuir account manager dedicado. Definir check-ins semanais de acompanhamento.', owner: 'Account Manager', duration: '30 min' },
      { id: '6', title: 'Acompanhamento dedicado', description: 'Check-in semanal com cliente. Update de produção quinzenal. Notificação imediata de qualquer desvio no prazo ou qualidade.', owner: 'Account Manager', duration: 'Contínuo' },
    ],
  },
  {
    id: 'invoice-overdue',
    category: 'Faturação',
    title: 'Gestão de Fatura em Atraso',
    description: 'Procedimento de cobranças para faturas não pagas após data de vencimento.',
    severity: 'warning',
    trigger: 'Fatura com due_date < hoje e status != paid',
    adminOnly: true,
    escalation: 'Finance Manager → Director Financeiro se > 30 dias de atraso',
    steps: [
      { id: '1', title: 'Identificar faturas em atraso', description: 'Aceder ao dashboard financeiro. Listar todas as faturas com due_date expirada. Priorizar por valor e dias de atraso.', owner: 'Finance', duration: '5 min' },
      { id: '2', title: 'Primeiro reminder (D+1)', description: 'Email cortês a lembrar a fatura. Incluir link de pagamento. Tom amigável — pode ser esquecimento.', owner: 'Finance', duration: '5 min' },
      { id: '3', title: 'Segundo reminder (D+7)', description: 'Segundo email, tom mais directo. Mencionar juros de mora a partir de D+15. Oferecer plano de pagamento se necessário.', owner: 'Finance', duration: '5 min', critical: true },
      { id: '4', title: 'Contacto telefónico (D+15)', description: 'Ligar directamente ao responsável financeiro do cliente. Perceber razão do atraso. Negociar plano de pagamento se adequado.', owner: 'Account Manager', duration: '20 min', critical: true },
      { id: '5', title: 'Suspender novos pedidos (D+30)', description: 'Bloquear novos orçamentos e encomendas para o cliente até regularização. Notificar o cliente por escrito.', owner: 'Operations Director', duration: '5 min' },
      { id: '6', title: 'Processo formal (D+60)', description: 'Enviar carta de incumprimento com prazo de 15 dias. Se não resolvido: encaminhar para cobranças/jurídico.', owner: 'Finance Manager', duration: '1h' },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

function SeverityChip({ s }: { s: 'info' | 'warning' | 'critical' }) {
  const map = {
    info:     { label: 'Info',      color: 'rgb(77,163,255)',   bg: 'rgba(77,163,255,0.1)',   border: 'rgba(77,163,255,0.2)' },
    warning:  { label: 'Atenção',   color: 'rgb(245,158,11)',   bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)' },
    critical: { label: 'Crítico',   color: 'rgb(239,68,68)',    bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)' },
  };
  const v = map[s];
  return <span style={{ fontSize: '0.58rem', fontWeight: 700, color: v.color, background: v.bg, border: `1px solid ${v.border}`, borderRadius: '9999px', padding: '0.12rem 0.45rem' }}>{v.label}</span>;
}

export default function RunbooksPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter] = useState('Todos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/runbooks'); return; }
      const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
      setIsAdmin(admin);
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
    }
    load();
  }, [router]);

  const visible = RUNBOOKS
    .filter(r => !r.adminOnly || isAdmin)
    .filter(r => catFilter === 'Todos' || r.category === catFilter)
    .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()));

  const categories = ['Todos', ...Array.from(new Set(RUNBOOKS.filter(r => !r.adminOnly || isAdmin).map(r => r.category)))];

  const progress = selectedRunbook
    ? Math.round((completedSteps.size / selectedRunbook.steps.length) * 100)
    : 0;

  function toggleStep(sid: string) {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }

  function openRunbook(r: Runbook) {
    setSelectedRunbook(r);
    setCompletedSteps(new Set());
  }

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>

        {/* Header */}
        <motion.div variants={fadeUp(0)} initial="hidden" animate="visible" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Runbooks Operacionais</h1>
            <p style={{ fontSize: '0.75rem', color: 'rgb(80,92,110)' }}>SOPs · Matrizes de Escalação · Protocolos de Incidente · S15 Omega Protocol</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: '9999px', padding: '0.3rem 0.75rem' }}>
              {visible.length} runbooks
            </span>
          </div>
        </motion.div>

        {/* Search + filter */}
        <motion.div {...delayedFadeUp(0, 0.06)} style={{ display: 'flex', gap: '0.625rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar runbooks..."
            style={{ flex: '1', minWidth: '180px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px', padding: '0.45rem 0.875rem', fontSize: '0.78rem', color: 'rgb(220,230,245)', outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
          />
          {categories.map(cat => (
            <button type="button" key={cat} type="button" onClick={() => setCatFilter(cat)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: catFilter === cat ? 700 : 400, cursor: 'pointer', background: catFilter === cat ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: catFilter === cat ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: catFilter === cat ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 150ms' }}>
              {cat}
            </button>
          ))}
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedRunbook ? '1fr 1.2fr' : '1fr', gap: '0.875rem', alignItems: 'start' }}>

          {/* Runbook list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visible.map((rb, i) => (
              <motion.div
                key={rb.id}
                {...delayedFadeUp(i, 0.08, 0.06)}
                onClick={() => openRunbook(rb)}
                whileHover={{ y: -1 }}
                transition={springSnappy}
                className="yg-card"
                style={{
                  padding: '1rem 1.125rem', cursor: 'pointer',
                  borderColor: selectedRunbook?.id === rb.id ? 'rgba(77,163,255,0.35)' : 'rgba(255,255,255,0.08)',
                  background: selectedRunbook?.id === rb.id ? 'linear-gradient(180deg,rgba(77,163,255,0.06) 0%,rgba(255,255,255,0.02) 100%)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgb(80,92,110)', flexShrink: 0 }}>{rb.category}</span>
                    {rb.adminOnly && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgb(245,158,11)', background: 'rgba(245,158,11,0.1)', borderRadius: '4px', padding: '0.1rem 0.3rem', flexShrink: 0 }}>ADMIN</span>}
                  </div>
                  <SeverityChip s={rb.severity} />
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(220,230,245)', marginBottom: '0.25rem' }}>{rb.title}</div>
                <div style={{ fontSize: '0.68rem', color: 'rgb(100,112,130)', lineHeight: 1.4, marginBottom: '0.5rem' }}>{rb.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{rb.steps.length} passos</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(77,163,255)' }}>Abrir →</span>
                </div>
              </motion.div>
            ))}
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgb(80,92,110)', fontSize: '0.78rem' }}>
                Nenhum runbook encontrado.
              </div>
            )}
          </div>

          {/* Runbook detail */}
          <AnimatePresence mode="wait">
            {selectedRunbook && (
              <motion.div
                key={selectedRunbook.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={springSnappy}
                className="yg-card"
                style={{ padding: '1.25rem', position: 'sticky', top: '5rem' }}
              >
                {/* Detail header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <SeverityChip s={selectedRunbook.severity} />
                      <span style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)' }}>{selectedRunbook.category}</span>
                    </div>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(230,240,250)', letterSpacing: '-0.02em' }}>{selectedRunbook.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedRunbook(null)} style={{ fontSize: '1rem', color: 'rgb(80,92,110)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}>✕</button>
                </div>

                {/* Trigger */}
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgb(245,158,11)', marginBottom: '0.2rem' }}>TRIGGER</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgb(180,190,205)' }}>{selectedRunbook.trigger}</div>
                </div>

                {/* Progress */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>Progresso</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: progress === 100 ? 'rgb(99,230,190)' : 'rgb(77,163,255)' }}>{progress}%</span>
                  </div>
                  <div className="prog-track">
                    <motion.div
                      className="prog-fill"
                      style={{ background: progress === 100 ? 'rgb(99,230,190)' : 'rgb(77,163,255)' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ...springSnappy }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  {selectedRunbook.steps.map((step, i) => {
                    const done = completedSteps.has(step.id);
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springSnappy, delay: i * 0.06 }}
                        onClick={() => toggleStep(step.id)}
                        style={{
                          display: 'flex', gap: '0.625rem', padding: '0.625rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                          background: done ? 'rgba(99,230,190,0.08)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${done ? 'rgba(99,230,190,0.2)' : step.critical ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                          transition: 'all 180ms',
                          opacity: done ? 0.75 : 1,
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${done ? 'rgb(99,230,190)' : 'rgba(255,255,255,0.2)'}`,
                          background: done ? 'rgba(99,230,190,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: '1px', transition: 'all 150ms',
                        }}>
                          {done && <span style={{ fontSize: '0.7rem', color: 'rgb(99,230,190)' }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: done ? 'rgb(99,230,190)' : 'rgb(210,220,235)', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>
                              {i + 1}. {step.title}
                            </span>
                            {step.critical && !done && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgb(239,68,68)', flexShrink: 0 }}>CRÍTICO</span>}
                          </div>
                          <p style={{ fontSize: '0.65rem', color: 'rgb(110,122,140)', lineHeight: 1.45, marginBottom: '0.25rem' }}>{step.description}</p>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>👤 {step.owner}</span>
                            <span style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>⏱ {step.duration}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Escalation */}
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(77,163,255,0.07)', border: '1px solid rgba(77,163,255,0.15)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgb(77,163,255)', marginBottom: '0.2rem' }}>ESCALAÇÃO</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgb(160,175,195)' }}>{selectedRunbook.escalation}</div>
                </div>

                {progress === 100 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(99,230,190,0.1)', border: '1px solid rgba(99,230,190,0.25)', borderRadius: '10px', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>✅</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>Runbook completo!</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>Todos os passos foram executados.</div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PortalLayout>
  );
}
