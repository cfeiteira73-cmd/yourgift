import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `És o assistente de IA do YourGift OS — a plataforma B2B premium de merchandising personalizado para empresas.

O teu papel é ajudar os clientes com:
- Encomendas: estado, prazos, rastreamento, faturação
- Orçamentos: como criar, o que incluir, tempos de resposta
- Produtos: catálogo Midocean + PF Concept, artigos eco, personalizações
- Produção: fases de produção, controlo de qualidade, envios
- Assets: upload de logótipos, formatos aceites (SVG, PDF, AI, EPS, PNG 300dpi+)
- Pagamentos: Stripe, faturas, métodos de pagamento
- Conta: definições, perfil, integrações

Regras:
- Responde SEMPRE em Português de Portugal (não brasileiro)
- Sê conciso e direto — máximo 3-4 parágrafos por resposta
- Usa emojis com moderação para tornar as respostas mais amigáveis
- Se não souberes algo específico do cliente, indica como pode encontrar essa info no portal
- Nunca inventes dados como valores, prazos ou estados de encomendas específicas
- Tom: profissional mas amigável, como um gestor de conta premium

Contexto da plataforma:
- Prazos de produção: 10-15 dias úteis (standard), 5-7 dias (urgente)
- Formatos de arte aceites: SVG, PDF, AI, EPS, PNG (300dpi mínimo)
- Quantidades mínimas: variam por produto (geralmente 50-100 unidades)
- Entrega: DHL/CTT, tracking disponível na encomenda
- Suporte: Segunda a Sexta, 9h-18h`;

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const messages: ChatMessage[] = body.messages ?? [];

    if (!messages.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Validate and sanitise messages
    const validMessages = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map(m => ({
        role: m.role,
        content: m.content.trim().slice(0, 2000),
      }));

    if (!validMessages.length) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { content: 'O assistente está temporariamente indisponível. Por favor contacta o suporte.' },
        { status: 200 },
      );
    }

    // Call Anthropic Messages API via fetch
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: validMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic API error:', res.status, err);
      return NextResponse.json(
        { content: 'O assistente não está disponível neste momento. Tenta novamente em instantes.' },
        { status: 200 },
      );
    }

    const data = await res.json();
    const content = data.content?.[0]?.type === 'text'
      ? data.content[0].text
      : 'Não foi possível processar a tua mensagem.';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Copilot API error:', error);
    return NextResponse.json(
      { content: 'Ocorreu um erro inesperado. Por favor tenta novamente.' },
      { status: 200 },
    );
  }
}
