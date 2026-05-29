import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Artwork Intelligence API ───────────────────────────────
//
// X4 Artwork Intelligence: Visual diff, collaborative annotations,
// production readiness scoring, and artwork lifecycle analytics.
//
// GET  ?mode=diff&submissionId=&v1=&v2=   — compare two artwork versions
// GET  ?mode=annotations&submissionId=    — all annotations with thread replies
// GET  ?mode=pipeline                     — artwork approval pipeline overview
// GET  ?mode=analytics                    — artwork quality trends + SLA times
// POST { action:'add_annotation', ...}    — add pinned annotation on artwork
// POST { action:'reply_annotation', ...}  — reply to annotation thread
// POST { action:'resolve_annotation', id} — mark annotation resolved
// POST { action:'ai_diff', v1Url, v2Url } — AI-powered visual diff summary
// POST { action:'production_check', submissionId } — final pre-production AI check
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function callClaudeVision(imageUrl: string, prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY || !imageUrl) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

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
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return '';
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  } catch { return ''; }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'pipeline';
  const { searchParams } = req.nextUrl;

  try {
    if (mode === 'diff') {
      const submissionId = searchParams.get('submissionId');
      if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });

      // Get all versions for this submission
      const { data: versions } = await db
        .from('artwork_versions')
        .select('id, version_number, file_url, file_name, file_size, analysis_score, created_at, notes')
        .eq('submission_id', submissionId)
        .order('version_number', { ascending: true });

      if (!versions?.length) return NextResponse.json({ diff: null, versions: [] });

      // Build diff between consecutive versions
      const diffs = [];
      for (let i = 1; i < versions.length; i++) {
        const prev = versions[i - 1] as Record<string, unknown>;
        const curr = versions[i] as Record<string, unknown>;
        const scoreDelta = ((curr.analysis_score as number) ?? 0) - ((prev.analysis_score as number) ?? 0);
        diffs.push({
          fromVersion: prev.version_number,
          toVersion: curr.version_number,
          fromFile: prev.file_name,
          toFile: curr.file_name,
          scoreDelta,
          scoreImproved: scoreDelta > 0,
          fromUrl: prev.file_url,
          toUrl: curr.file_url,
          changedAt: curr.created_at,
          notes: curr.notes,
        });
      }

      return NextResponse.json({
        submissionId,
        versions,
        diffs,
        latestVersion: versions[versions.length - 1],
        versionCount: versions.length,
      });
    }

    if (mode === 'annotations') {
      const submissionId = searchParams.get('submissionId');
      if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });

      const { data: comments } = await db
        .from('artwork_comments')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      // Group into threads (parent + replies)
      type Comment = { id: string; parent_id?: string | null; [key: string]: unknown };
      const parents = (comments ?? []).filter((c) => !(c as Comment).parent_id);
      const replies = (comments ?? []).filter((c) => (c as Comment).parent_id);

      const threads = parents.map(p => ({
        ...p,
        replies: replies.filter(r => (r as Comment).parent_id === (p as Comment).id),
      }));

      const openCount = (comments ?? []).filter(c => !(c as { resolved?: boolean }).resolved).length;
      const resolvedCount = (comments ?? []).filter(c => (c as { resolved?: boolean }).resolved).length;

      return NextResponse.json({
        threads,
        openAnnotations: openCount,
        resolvedAnnotations: resolvedCount,
        totalComments: (comments ?? []).length,
      });
    }

    if (mode === 'pipeline') {
      // Artwork approval pipeline overview
      const { data: submissions } = await (isAdmin ? db : supabase)
        .from('artwork_submissions')
        .select(`
          id, order_id, client_id, status, created_at, updated_at,
          artwork_versions(version_number, analysis_score, created_at)
        `)
        .order('updated_at', { ascending: false })
        .limit(50);

      type Submission = {
        id: string;
        status: string;
        created_at: string;
        updated_at: string;
        artwork_versions: Array<{ version_number: number; analysis_score?: number; created_at: string }>;
      };

      const statusCounts: Record<string, number> = {};
      const avgTimeByStatus: Record<string, number[]> = {};

      for (const sub of (submissions ?? []) as Submission[]) {
        statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1;
        const ageHours = (Date.now() - new Date(sub.updated_at).getTime()) / 3600000;
        if (!avgTimeByStatus[sub.status]) avgTimeByStatus[sub.status] = [];
        avgTimeByStatus[sub.status].push(ageHours);
      }

      const slaBreached = (submissions ?? [] as Submission[]).filter(s => {
        const ageHours = (Date.now() - new Date((s as Submission).updated_at).getTime()) / 3600000;
        return ['pending_review', 'revision_requested'].includes((s as Submission).status) && ageHours > 24;
      });

      return NextResponse.json({
        submissions: (submissions ?? []).slice(0, 20),
        statusCounts,
        slaBreached: slaBreached.length,
        avgWaitTimes: Object.fromEntries(
          Object.entries(avgTimeByStatus).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])
        ),
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'analytics') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: recentVersions } = await db
        .from('artwork_versions')
        .select('analysis_score, created_at, submission_id')
        .gte('created_at', thirtyDaysAgo)
        .not('analysis_score', 'is', null)
        .order('created_at', { ascending: true })
        .limit(200);

      type Version = { analysis_score: number; created_at: string };
      const scores = (recentVersions ?? [] as Version[]).map(v => (v as Version).analysis_score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const highQuality = scores.filter(s => s >= 80).length;
      const needsRevision = scores.filter(s => s < 60).length;

      // Weekly trend
      const weekBuckets: Record<number, number[]> = {};
      for (const v of (recentVersions ?? [] as Version[])) {
        const week = Math.floor((Date.now() - new Date((v as Version).created_at).getTime()) / (7 * 86400000));
        if (!weekBuckets[week]) weekBuckets[week] = [];
        weekBuckets[week].push((v as Version).analysis_score);
      }
      const weeklyAvg = Object.entries(weekBuckets)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .slice(0, 4)
        .map(([w, vals]) => ({
          week: Number(w),
          avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          count: vals.length,
        }))
        .reverse();

      return NextResponse.json({
        avgScore,
        totalVersions: scores.length,
        highQualityPct: scores.length > 0 ? Math.round((highQuality / scores.length) * 100) : 0,
        needsRevisionPct: scores.length > 0 ? Math.round((needsRevision / scores.length) * 100) : 0,
        weeklyTrend: weeklyAvg,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[artwork-intelligence GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb() ?? supabase;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = body.action as string;
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());

  try {
    // ── Add annotation (pinned comment with optional XY coords) ───────────
    if (action === 'add_annotation') {
      const { submissionId, text, xPct, yPct, versionNumber, type: annotationType } = body as {
        submissionId?: string; text?: string;
        xPct?: number; yPct?: number;
        versionNumber?: number; type?: string;
      };
      if (!submissionId || !text) return NextResponse.json({ error: 'Missing submissionId or text' }, { status: 400 });

      const { data: comment, error: cErr } = await supabase
        .from('artwork_comments')
        .insert({
          submission_id: submissionId,
          author_id: user.id,
          author_email: user.email,
          content: text,
          annotation_x_pct: xPct ?? null,
          annotation_y_pct: yPct ?? null,
          version_number: versionNumber ?? null,
          comment_type: annotationType ?? 'annotation',
          resolved: false,
        })
        .select('id')
        .single();

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, commentId: comment.id });
    }

    // ── Reply to annotation thread ─────────────────────────────────────────
    if (action === 'reply_annotation') {
      const { parentId, submissionId, text } = body as { parentId?: string; submissionId?: string; text?: string };
      if (!parentId || !submissionId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data: reply, error: rErr } = await supabase
        .from('artwork_comments')
        .insert({
          submission_id: submissionId,
          parent_id: parentId,
          author_id: user.id,
          author_email: user.email,
          content: text,
          comment_type: 'reply',
          resolved: false,
        })
        .select('id')
        .single();

      if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, replyId: reply.id });
    }

    // ── Resolve annotation ─────────────────────────────────────────────────
    if (action === 'resolve_annotation') {
      const { annotationId } = body as { annotationId?: string };
      if (!annotationId) return NextResponse.json({ error: 'Missing annotationId' }, { status: 400 });

      await supabase.from('artwork_comments')
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq('id', annotationId);

      return NextResponse.json({ ok: true });
    }

    // ── AI visual diff summary ─────────────────────────────────────────────
    if (action === 'ai_diff') {
      const { v1Url, v2Url, v1Name, v2Name } = body as { v1Url?: string; v2Url?: string; v1Name?: string; v2Name?: string };
      if (!v1Url || !v2Url) return NextResponse.json({ error: 'Missing image URLs' }, { status: 400 });

      // Analyze each version with vision
      const [v1Analysis, v2Analysis] = await Promise.all([
        callClaudeVision(v1Url, 'Descreve brevemente esta arte gráfica em termos de produção: cores, elementos visuais, qualidade aparente, problemas visíveis. Máx 3 frases.'),
        callClaudeVision(v2Url, 'Descreve brevemente esta arte gráfica em termos de produção: cores, elementos visuais, qualidade aparente, problemas visíveis. Máx 3 frases.'),
      ]);

      // AI comparison summary
      const diffSummary = await callClaude(
        'És um especialista em artes gráficas para produção. Compara duas versões de artwork.',
        `Versão ${v1Name ?? '1'}: ${v1Analysis}\n\nVersão ${v2Name ?? '2'}: ${v2Analysis}\n\nResume as diferenças principais e indica qual é tecnicamente melhor para produção. Máx 3 frases em português.`,
        200
      );

      return NextResponse.json({
        ok: true,
        v1Analysis,
        v2Analysis,
        diffSummary,
        recommendation: v2Analysis.length > 0 ? `v${v2Name ?? '2'}` : null,
      });
    }

    // ── Final pre-production AI check ─────────────────────────────────────
    if (action === 'production_check') {
      if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const { submissionId } = body as { submissionId?: string };
      if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });

      const { data: latest } = await db
        .from('artwork_versions')
        .select('id, file_url, file_name, analysis_score, analysis_data')
        .eq('submission_id', submissionId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (!latest) return NextResponse.json({ error: 'No versions found' }, { status: 404 });

      const latestTyped = latest as { file_url?: string; file_name?: string; analysis_score?: number; analysis_data?: Record<string, unknown> };

      // Vision check on latest file
      const productionAnalysis = latestTyped.file_url
        ? await callClaudeVision(
            latestTyped.file_url,
            'Analisa esta arte para produção de merchandising. Verifica: resolução adequada, margens de segurança, qualidade de texto, modo de cor adequado para impressão. Dá um veredicto final: APROVADO, REVISÃO NECESSÁRIA, ou REJEITADO. Justifica em 2-3 frases em português.'
          )
        : '';

      const passed = productionAnalysis.toUpperCase().includes('APROVADO') && !productionAnalysis.toUpperCase().includes('REJEITADO');

      // Update submission with production check result
      await db.from('artwork_submissions').update({
        production_check_at: new Date().toISOString(),
        production_check_passed: passed,
        production_check_notes: productionAnalysis,
      }).eq('id', submissionId);

      await db.from('omega_final_audit_log').insert({
        entity_type: 'artwork_submission',
        entity_id: submissionId,
        action: 'production_check_completed',
        performed_by: user.id,
        metadata: { passed, score: latestTyped.analysis_score },
      });

      return NextResponse.json({
        ok: true,
        passed,
        analysis: productionAnalysis,
        score: latestTyped.analysis_score,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[artwork-intelligence POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
