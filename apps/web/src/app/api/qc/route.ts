import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA X — S5: Computer Vision Quality Control ────────────────────────────
//
// AI-powered quality inspection system with image analysis, defect detection,
// pass/fail scoring, and supplier quality tracking.
//
// GET  ?mode=list                       — all inspections
// GET  ?mode=detail&id=...              — inspection + images + defects
// GET  ?mode=supplier&name=...          — supplier QC history + score
// GET  ?mode=analytics                  — QC KPIs + defect breakdown
// POST { action:'create', ... }         — open new inspection
// POST { action:'analyze_image', ... }  — AI vision analysis on image URL
// POST { action:'add_defect', ... }     — log defect
// POST { action:'close', ... }          — finalize inspection (pass/fail)
//
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_HAIKU    = 'claude-3-haiku-20240307';
const CLAUDE_SONNET   = 'claude-3-5-sonnet-20241022';

async function callClaude(system: string, user: string, maxTokens = 512, model = CLAUDE_HAIKU): Promise<string> {
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
        model, max_tokens: maxTokens,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

async function analyzeImageWithVision(imageUrl: string, productName: string, context: string): Promise<{
  score: number; labels: string[]; defects: string[]; confidence: number; analysis: string;
}> {
  if (!ANTHROPIC_API_KEY) return { score: 0, labels: [], defects: [], confidence: 0, analysis: '' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_SONNET,
        max_tokens: 600,
        system: 'És um inspetor de qualidade especializado em produtos de merchandising/branding. Analisa imagens de produtos e reporta em JSON.',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `Produto: ${productName}. Contexto: ${context}.
Analisa esta imagem de controlo de qualidade. Responde APENAS em JSON:
{ "score": 0-100, "labels": ["label1","label2"], "defects": ["defect1"], "confidence": 0-1, "analysis": "descrição curta em português" }
Onde score 100 = qualidade perfeita, 0 = inaceitável. Se não conseguires ver a imagem, score 50, confidence 0.1.`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) return { score: 50, labels: [], defects: [], confidence: 0.1, analysis: 'Análise não disponível' };
    const d = await res.json();
    const text = d.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    return {
      score: Number(parsed.score ?? 50),
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
      defects: Array.isArray(parsed.defects) ? parsed.defects : [],
      confidence: Number(parsed.confidence ?? 0.5),
      analysis: String(parsed.analysis ?? ''),
    };
  } catch {
    return { score: 50, labels: [], defects: [], confidence: 0.1, analysis: 'Erro na análise' };
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'list';

  // ── Inspection list ───────────────────────────────────────────────────────
  if (mode === 'list') {
    const { data: inspections } = await supabase.from('omega_x_qc_inspections')
      .select('*').order('created_at', { ascending: false });

    return NextResponse.json({ inspections: inspections ?? [] });
  }

  // ── Inspection detail ─────────────────────────────────────────────────────
  if (mode === 'detail') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const [insp, imgs, defects] = await Promise.all([
      supabase.from('omega_x_qc_inspections').select('*').eq('id', id).single(),
      supabase.from('omega_x_qc_images').select('*').eq('inspection_id', id).order('uploaded_at'),
      supabase.from('omega_x_qc_defects').select('*').eq('inspection_id', id).order('created_at'),
    ]);

    return NextResponse.json({
      inspection: insp.data,
      images: imgs.data ?? [],
      defects: defects.data ?? [],
    });
  }

  // ── Supplier QC history ───────────────────────────────────────────────────
  if (mode === 'supplier') {
    const name = searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { data: inspections } = await supabase.from('omega_x_qc_inspections')
      .select('*').eq('supplier_name', name).order('created_at', { ascending: false }).limit(20);

    const all = inspections ?? [];
    const avgScore = all.length > 0
      ? all.reduce((s, i) => s + Number(i.overall_score ?? 0), 0) / all.length
      : 0;
    const passRate = all.length > 0
      ? (all.filter(i => i.status === 'passed').length / all.length) * 100
      : 0;

    return NextResponse.json({ supplier: name, inspections: all, avg_score: avgScore, pass_rate: passRate });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  if (mode === 'analytics') {
    const { data: inspections } = await supabase.from('omega_x_qc_inspections').select('*');
    const { data: defects } = await supabase.from('omega_x_qc_defects').select('defect_type, severity, quantity');

    const all = inspections ?? [];
    const allDefects = defects ?? [];

    const defectBreakdown: Record<string, number> = {};
    allDefects.forEach(d => {
      defectBreakdown[d.defect_type] = (defectBreakdown[d.defect_type] ?? 0) + Number(d.quantity ?? 1);
    });

    const supplierScores: Record<string, { score: number; count: number }> = {};
    all.forEach(i => {
      const s = i.supplier_name ?? 'Unknown';
      if (!supplierScores[s]) supplierScores[s] = { score: 0, count: 0 };
      supplierScores[s].score += Number(i.overall_score ?? 0);
      supplierScores[s].count++;
    });

    return NextResponse.json({
      total_inspections: all.length,
      passed: all.filter(i => i.status === 'passed').length,
      failed: all.filter(i => i.status === 'failed').length,
      pending: all.filter(i => ['pending','in_progress'].includes(i.status)).length,
      avg_score: all.length > 0 ? all.reduce((s, i) => s + Number(i.overall_score ?? 0), 0) / all.length : 0,
      avg_pass_rate: all.length > 0 ? all.reduce((s, i) => s + Number(i.pass_rate ?? 0), 0) / all.length : 0,
      defect_breakdown: defectBreakdown,
      supplier_scores: Object.entries(supplierScores).map(([name, v]) => ({
        name, avg_score: v.count > 0 ? v.score / v.count : 0, inspection_count: v.count,
      })).sort((a, b) => b.avg_score - a.avg_score),
    });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── Create inspection ─────────────────────────────────────────────────────
  if (action === 'create') {
    const { reference_type, reference_id, supplier_name, product_name, batch_number, quantity_inspected } = body;
    if (!reference_id || !product_name) {
      return NextResponse.json({ error: 'reference_id and product_name required' }, { status: 400 });
    }

    const { data: inspection, error } = await supabase.from('omega_x_qc_inspections').insert({
      reference_type: reference_type ?? 'order',
      reference_id,
      supplier_name: supplier_name ?? null,
      product_name,
      batch_number: batch_number ?? null,
      quantity_inspected: Number(quantity_inspected ?? 0),
      quantity_passed: 0,
      quantity_failed: 0,
      status: 'in_progress',
      inspection_date: new Date().toISOString(),
      inspected_by: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inspection, action: 'inspection_created' });
  }

  // ── Analyze image (Computer Vision) ───────────────────────────────────────
  if (action === 'analyze_image') {
    const { inspection_id, image_url, image_type, product_name, context } = body;
    if (!inspection_id || !image_url) {
      return NextResponse.json({ error: 'inspection_id and image_url required' }, { status: 400 });
    }

    // Run vision analysis
    const vision = await analyzeImageWithVision(
      image_url,
      product_name ?? 'Produto',
      context ?? 'Inspeção de qualidade',
    );

    // Save image record
    const { data: imgRecord, error } = await supabase.from('omega_x_qc_images').insert({
      inspection_id,
      image_url,
      image_type: image_type ?? 'product',
      ai_score: vision.score,
      ai_labels: vision.labels,
      ai_defects: vision.defects,
      ai_confidence: vision.confidence,
      analyzed: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-create defect records from vision
    if (vision.defects.length > 0) {
      await supabase.from('omega_x_qc_defects').insert(
        vision.defects.map(d => ({
          inspection_id,
          image_id: imgRecord.id,
          defect_type: 'other',
          severity: vision.score < 40 ? 'major' : 'minor',
          description: d,
          quantity: 1,
          ai_detected: true,
        }))
      );
    }

    return NextResponse.json({ image: imgRecord, vision_analysis: vision, action: 'image_analyzed' });
  }

  // ── Add defect manually ───────────────────────────────────────────────────
  if (action === 'add_defect') {
    const { inspection_id, defect_type, severity, description, quantity, resolution } = body;
    if (!inspection_id || !defect_type) {
      return NextResponse.json({ error: 'inspection_id and defect_type required' }, { status: 400 });
    }

    const { data: defect, error } = await supabase.from('omega_x_qc_defects').insert({
      inspection_id,
      defect_type,
      severity: severity ?? 'minor',
      description: description ?? null,
      quantity: Number(quantity ?? 1),
      ai_detected: false,
      resolution: resolution ?? null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update failed quantity on inspection (direct update — no stored proc needed)
    const failed = Number(quantity ?? 1);
    const { data: curInsp } = await supabase.from('omega_x_qc_inspections')
      .select('quantity_failed, quantity_inspected').eq('id', inspection_id).single();
    if (curInsp) {
      await supabase.from('omega_x_qc_inspections').update({
        quantity_failed: (curInsp.quantity_failed ?? 0) + failed,
        quantity_passed: Math.max(0, (curInsp.quantity_inspected ?? 0) - ((curInsp.quantity_failed ?? 0) + failed)),
        updated_at: new Date().toISOString(),
      }).eq('id', inspection_id);
    }

    return NextResponse.json({ defect, action: 'defect_added' });
  }

  // ── Close inspection ──────────────────────────────────────────────────────
  if (action === 'close') {
    const { inspection_id, quantity_passed, quantity_failed, inspector_notes } = body;
    if (!inspection_id) return NextResponse.json({ error: 'inspection_id required' }, { status: 400 });

    const passed = Number(quantity_passed ?? 0);
    const failed = Number(quantity_failed ?? 0);
    const total  = passed + failed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    // Get all image scores for overall QC score
    const { data: images } = await supabase.from('omega_x_qc_images')
      .select('ai_score').eq('inspection_id', inspection_id);
    const imgScores = (images ?? []).map(i => Number(i.ai_score ?? 0));
    const avgImgScore = imgScores.length > 0 ? imgScores.reduce((s, x) => s + x, 0) / imgScores.length : 0;

    // Overall score: 60% pass rate + 40% image quality
    const overallScore = Math.round(passRate * 0.6 + avgImgScore * 0.4);
    const status = passRate >= 95 ? 'passed' : passRate >= 70 ? 'partial' : 'failed';

    // AI summary
    const { data: defects } = await supabase.from('omega_x_qc_defects').select('*').eq('inspection_id', inspection_id);
    const aiSummary = await callClaude(
      'Escreves relatórios de controlo de qualidade. Sê conciso. Responde em português.',
      `Inspeção: ${passed} aprovadas, ${failed} reprovadas (${passRate.toFixed(1)}% pass rate). Score geral: ${overallScore}/100. Defeitos: ${(defects ?? []).map(d => `${d.defect_type} (${d.severity})`).join(', ') || 'nenhum'}. Notas: ${inspector_notes ?? 'N/A'}. Escreve um resumo executivo em 2 frases.`,
      200,
    );

    const { data: inspection, error } = await supabase.from('omega_x_qc_inspections').update({
      quantity_passed: passed,
      quantity_failed: failed,
      quantity_inspected: total,
      overall_score: overallScore,
      status,
      ai_summary: aiSummary || null,
      inspector_notes: inspector_notes ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', inspection_id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      inspection,
      overall_score: overallScore,
      status,
      pass_rate: passRate,
      action: 'inspection_closed',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
