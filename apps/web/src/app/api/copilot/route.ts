import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimitFast } from '@/lib/rate-limit';

// ── AI Copilot — Phase 9: AI Operating Brain ───────────────────────────────────
// Context-aware assistant that reads live DB state before responding

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: OperationalContext): string {
  return `És o YourGift AI Copilot — assistente operacional inteligente da plataforma B2B premium de merchandising.

Tens acesso ao estado em tempo real do sistema. Usa estes dados para dar respostas precisas:

${ctx.clientName ? `CLIENTE ACTUAL: ${ctx.clientName}${ctx.companyName ? ` (${ctx.companyName})` : ''} · Tier: ${ctx.tier ?? 'standard'}` : 'MODO: Admin / Sistema'}
${ctx.activeOrders != null ? `ENCOMENDAS ATIVAS: ${ctx.activeOrders}` : ''}
${ctx.pendingQuotes != null ? `ORÇAMENTOS PENDENTES: ${ctx.pendingQuotes}` : ''}
${ctx.totalThisMonth != null ? `RECEITA ESTE MÊS: €${ctx.totalThisMonth.toLocaleString('pt-PT')}` : ''}
${ctx.inventoryAlerts != null ? `ALERTAS INVENTÁRIO: ${ctx.inventoryAlerts.critical} ruturas, ${ctx.inventoryAlerts.lowStock} stock baixo` : ''}
${ctx.slaViolations != null && ctx.slaViolations > 0 ? `⚠️ SLA VIOLADO: ${ctx.slaViolations} encomendas em violação` : ''}
${ctx.recentOrderRefs ? `ÚLTIMAS ENCOMENDAS: ${ctx.recentOrderRefs}` : ''}

CAPACIDADES DO SISTEMA:
- Catálogo: ${ctx.totalProducts ?? '2.400+'} produtos Midocean + PF Concept + fornecedores parceiros
- SLA Produção: 10-15 dias úteis (standard) · 5-7 dias (urgente)
- Formatos de arte: SVG, PDF, AI, EPS, PNG 300dpi+ (análise IA disponível)
- Entregas: DHL/CTT com tracking integrado
- Suporte: Segunda a Sexta 9h-18h · geral@yourgift.pt

REGRAS:
- Responde SEMPRE em Português de Portugal (nunca brasileiro)
- Sê conciso e directo — máximo 3-4 parágrafos
- Usa os dados em tempo real para respostas concretas e personalizadas
- Para valores específicos de encomendas/orçamentos, remete para a secção correspondente do portal
- Tom: profissional, eficiente, premium — como um gestor de conta top
- Nunca inventes dados — usa apenas o contexto fornecido ou admite que não tens essa informação`;
}

// ── Operational context ───────────────────────────────────────────────────────

interface OperationalContext {
  clientName?: string;
  companyName?: string;
  tier?: string;
  activeOrders?: number;
  pendingQuotes?: number;
  totalThisMonth?: number;
  inventoryAlerts?: { critical: number; lowStock: number };
  slaViolations?: number;
  recentOrderRefs?: string;
  totalProducts?: number;
}

async function buildContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<OperationalContext> {
  try {
    const [clientRes, statsRes, alertsRes, ordersRes, productsRes] = await Promise.all([
      supabase.from('clients').select('name, company, tier, id').eq('auth_user_id', userId).single(),
      supabase.from('orders').select('status, total_amount, created_at, ref').order('created_at', { ascending: false }).limit(10),
      supabase.from('inventory_alerts').select('alert_type').eq('resolved', false).limit(100),
      supabase.from('quotes').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ]);

    const client = clientRes.data;
    const orders = ordersRes.data ?? [];
    const alerts = alertsRes.data ?? [];

    // Monthly revenue
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthOrders = (statsRes.data ?? []).filter(o => new Date(o.created_at) >= monthStart && o.status !== 'cancelled');
    const totalThisMonth = monthOrders.reduce((s, o) => s + ((o as any).total_amount ?? 0), 0);

    const activeOrders = (statsRes.data ?? []).filter(o => !['delivered', 'cancelled', 'draft'].includes((o as any).status)).length;

    const recentRefs = orders.slice(0, 3).map((o: any) => o.ref).join(', ');

    return {
      clientName: client?.name ?? undefined,
      companyName: client?.company ?? undefined,
      tier: client?.tier ?? undefined,
      activeOrders,
      totalThisMonth: Math.round(totalThisMonth),
      inventoryAlerts: {
        critical: alerts.filter((a: any) => a.alert_type === 'out_of_stock').length,
        lowStock: alerts.filter((a: any) => a.alert_type === 'low_stock').length,
      },
      recentOrderRefs: recentRefs || undefined,
      totalProducts: productsRes.count ?? undefined,
    };
  } catch {
    return {};
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: 30 AI requests per user per 60 seconds
    const { limited } = checkRateLimitFast(`copilot:${user.id}`, 30, 60);
    if (limited) {
      return NextResponse.json(
        { error: 'Demasiados pedidos. Aguarda um momento antes de continuar.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json();
    const messages: ChatMessage[] = body.messages ?? [];
    const skipContext: boolean = body.skipContext ?? false;

    if (!messages.length) return NextResponse.json({ error: 'No messages provided' }, { status: 400 });

    // Cap history to last 20 messages (token cost control); trim each to 3000 chars
    const validMessages = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.trim().slice(0, 3000) }))
      .slice(-20);

    if (!validMessages.length) return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ content: 'O assistente está temporariamente indisponível. Por favor contacta o suporte em geral@yourgift.pt.' });
    }

    // Build live operational context (skip for rapid follow-ups to save latency)
    const ctx = skipContext ? {} : await buildContext(supabase, user.id);
    const systemPrompt = buildSystemPrompt(ctx);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 768,
        system: systemPrompt,
        messages: validMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic copilot error:', res.status, err);
      return NextResponse.json({ content: 'O assistente não está disponível neste momento. Tenta novamente em instantes.' });
    }

    const data = await res.json();
    const content = data.content?.[0]?.type === 'text'
      ? data.content[0].text
      : 'Não foi possível processar a tua mensagem.';

    // Return context summary for UI display (optional)
    const contextSummary = Object.keys(ctx).length > 0 ? {
      hasRealTimeData: true,
      activeOrders: ctx.activeOrders,
      inventoryAlerts: ctx.inventoryAlerts?.critical ?? 0,
    } : null;

    return NextResponse.json({ content, context: contextSummary });
  } catch (error) {
    console.error('Copilot error:', error);
    return NextResponse.json({ content: 'Ocorreu um erro inesperado. Por favor tenta novamente.' });
  }
}
