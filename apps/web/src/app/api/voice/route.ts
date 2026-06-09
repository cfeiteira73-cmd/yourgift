import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S14: Voice Command Engine ───────────────────────────────────────
//
// Natural language voice command processing via AI intent extraction.
// Parses utterances → intent + entities → executes OS actions.
// All voice sessions are logged for analytics and correction.
//
// GET  ?mode=history            — user's recent voice commands
// GET  ?mode=intents            — available intents registry
// POST { action:'process' }     — process voice utterance (AI NLU)
// POST { action:'feedback' }    — log user correction for a command
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU = 'claude-3-haiku-20240307';

async function callClaude(system: string, user: string, maxTokens = 300): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

// Available OS intents
const INTENT_REGISTRY = [
  { intent: 'navigate', description: 'Navigate to a portal section', entities: ['page'] },
  { intent: 'show_orders', description: 'Show order list or specific order', entities: ['status', 'client', 'date'] },
  { intent: 'show_kpis', description: 'Show KPI summary or specific metric', entities: ['metric', 'period'] },
  { intent: 'create_rfq', description: 'Create procurement RFQ', entities: ['supplier', 'product', 'quantity'] },
  { intent: 'check_inventory', description: 'Check inventory levels', entities: ['sku', 'product'] },
  { intent: 'show_client', description: 'Pull up client details', entities: ['client_name', 'client_id'] },
  { intent: 'executive_brief', description: 'Generate AI executive brief', entities: [] },
  { intent: 'check_qc', description: 'Check QC inspection status', entities: ['supplier', 'product'] },
  { intent: 'help', description: 'List available commands', entities: [] },
  { intent: 'unknown', description: 'Unrecognised intent', entities: [] },
];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'history';

  if (mode === 'intents') {
    return NextResponse.json({ intents: INTENT_REGISTRY });
  }

  if (mode === 'history') {
    const isAdmin = isAdminEmail(user.email);
    let q = supabase.from('omega_x_voice_commands')
      .select('id, utterance, intent, entities, confidence, action_taken, status, latency_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { data } = await q;
    return NextResponse.json({ commands: data ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'process') {
    const { utterance } = body;
    if (!utterance || typeof utterance !== 'string') {
      return NextResponse.json({ error: 'utterance required' }, { status: 400 });
    }

    const start = Date.now();

    // AI intent extraction
    const intentResponse = await callClaude(
      `Extrais intenção e entidades de comandos de voz para um ERP B2B português (YourGift).
Intents disponíveis: ${INTENT_REGISTRY.map(i => i.intent).join(', ')}.
Responde APENAS em JSON válido: {"intent": string, "entities": {}, "confidence": 0-1, "action_taken": string, "response_text": string}
response_text deve ser uma confirmação curta em português.`,
      `Comando de voz: "${utterance}"`,
      250,
    );

    const latencyMs = Date.now() - start;
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(intentResponse); }
    catch { parsed = { intent: 'unknown', entities: {}, confidence: 0, response_text: 'Não entendi o comando.' }; }

    const intent = String(parsed.intent ?? 'unknown');
    const confidence = Number(parsed.confidence ?? 0);
    const status = intent === 'unknown' ? 'unsupported' : confidence < 0.4 ? 'ambiguous' : 'processed';

    // Map intent to action
    let actionTaken: string | null = null;
    const entities = (parsed.entities as Record<string, string>) ?? {};
    switch (intent) {
      case 'navigate':    actionTaken = `navigate:${entities.page ?? '/dashboard'}`; break;
      case 'show_orders': actionTaken = `navigate:/orders`; break;
      case 'show_kpis':   actionTaken = `navigate:/executive`; break;
      case 'executive_brief': actionTaken = `api:POST /api/executive action:generate`; break;
      case 'check_inventory': actionTaken = `navigate:/inventory`; break;
      case 'create_rfq':  actionTaken = `navigate:/procurement`; break;
      case 'help':        actionTaken = `show_help`; break;
      default:            actionTaken = null;
    }

    // Log to DB
    const { data: logEntry } = await supabase.from('omega_x_voice_commands').insert({
      user_id: user.id,
      utterance,
      intent,
      entities: parsed.entities ?? {},
      confidence,
      action_taken: actionTaken,
      result: parsed,
      status,
      latency_ms: latencyMs,
    }).select('id').single();

    return NextResponse.json({
      id: logEntry?.id,
      intent,
      entities: parsed.entities ?? {},
      confidence,
      action_taken: actionTaken,
      response_text: String(parsed.response_text ?? 'Comando processado.'),
      status,
      latency_ms: latencyMs,
    });
  }

  if (action === 'feedback') {
    const { command_id, correct_intent, notes } = body;
    // Update the command with correction for training
    const { error } = await supabase.from('omega_x_voice_commands')
      .update({ result: { corrected_intent: correct_intent, notes }, status: 'processed' })
      .eq('id', command_id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: 'feedback_recorded' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
