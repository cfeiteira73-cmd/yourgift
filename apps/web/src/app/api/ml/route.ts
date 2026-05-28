import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA X — S10: ML Platform ────────────────────────────────────────────────
//
// ML model registry, versioning, and prediction logging.
// Integrates with existing AI modules (demand_forecast, churn_prediction, etc.)
// and provides a unified prediction API with latency tracking.
//
// GET  ?mode=models             — model registry
// GET  ?mode=model&id=          — model detail + recent predictions
// GET  ?mode=predictions        — prediction log with filters
// POST { action:'register' }    — register new model
// POST { action:'activate' }    — promote model to active (deprecates previous)
// POST { action:'predict' }     — run prediction via active model (stub)
// POST { action:'log_prediction' } — log an external prediction
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// Built-in prediction logic stubs per model type
function runPrediction(modelType: string, features: Record<string, unknown>): Record<string, unknown> {
  switch (modelType) {
    case 'demand_forecast': {
      const baseQty = Number(features.avg_monthly_qty ?? 100);
      const trend = Number(features.trend ?? 1.05);
      const seasonal = Number(features.seasonal_factor ?? 1.0);
      return {
        predicted_qty_30d: Math.round(baseQty * trend * seasonal),
        predicted_qty_90d: Math.round(baseQty * trend * seasonal * 3),
        confidence: 0.72 + Math.random() * 0.15,
        drivers: ['trend', 'seasonality', 'avg_historical'],
      };
    }
    case 'churn_prediction': {
      const daysSince = Number(features.days_since_last_order ?? 60);
      const healthScore = Number(features.health_score ?? 60);
      const risk = Math.min(1, (daysSince / 180) * (1 - healthScore / 100) * 2);
      return {
        churn_probability: Math.round(risk * 100) / 100,
        risk_level: risk > 0.7 ? 'high' : risk > 0.4 ? 'medium' : 'low',
        days_to_churn_estimated: risk > 0.5 ? Math.round((1 - risk) * 120) : null,
        top_factors: daysSince > 90 ? ['inactivity', 'low_engagement'] : ['price_sensitivity'],
      };
    }
    case 'price_optimization': {
      const cost = Number(features.unit_cost ?? 10);
      const market = Number(features.market_price ?? 25);
      const elasticity = Number(features.price_elasticity ?? -1.5);
      const optimal = cost * 1.35 + (market - cost) * 0.4;
      return {
        recommended_price: Math.round(optimal * 100) / 100,
        price_range: { min: Math.round(cost * 1.2 * 100) / 100, max: Math.round(market * 1.1 * 100) / 100 },
        expected_margin_pct: Math.round(((optimal - cost) / optimal) * 100),
        elasticity_note: elasticity < -1 ? 'elastic — discount cautiously' : 'inelastic — room to increase',
      };
    }
    case 'lead_scoring': {
      const company_size = Number(features.company_size ?? 50);
      const industry_fit = Number(features.industry_fit ?? 0.6);
      const engagement = Number(features.engagement_score ?? 0.5);
      const score = Math.round((company_size / 1000 * 0.2 + industry_fit * 0.4 + engagement * 0.4) * 100);
      return {
        lead_score: Math.min(100, score),
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
        recommended_action: score >= 70 ? 'immediate_outreach' : score >= 50 ? 'nurture' : 'deprioritise',
      };
    }
    default:
      return { result: 'unsupported_model_type', model_type: modelType };
  }
}

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'models';

  if (mode === 'models') {
    const { data } = await supabase.from('omega_x_ml_models')
      .select('*').order('updated_at', { ascending: false });
    return NextResponse.json({ models: data ?? [] });
  }

  if (mode === 'model') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const [model, predictions] = await Promise.all([
      supabase.from('omega_x_ml_models').select('*').eq('id', id).single(),
      supabase.from('omega_x_ml_predictions')
        .select('id, entity_type, entity_id, confidence, latency_ms, created_at')
        .eq('model_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (model.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ model: model.data, recent_predictions: predictions.data ?? [] });
  }

  if (mode === 'predictions') {
    const modelId = searchParams.get('model_id');
    const entityType = searchParams.get('entity_type');
    let q = supabase.from('omega_x_ml_predictions')
      .select('*, omega_x_ml_models(name, model_type)')
      .order('created_at', { ascending: false }).limit(100);
    if (modelId) q = q.eq('model_id', modelId);
    if (entityType) q = q.eq('entity_type', entityType);
    const { data } = await q;
    return NextResponse.json({ predictions: data ?? [] });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[ml] GET error:', error);
    return NextResponse.json({ error: 'Ml unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'register') {
    const { name, model_type, version = '1.0.0', accuracy, f1_score,
      training_samples, feature_schema = {}, hyperparams = {}, artifact_url } = body;
    if (!name || !model_type) return NextResponse.json({ error: 'name and model_type required' }, { status: 400 });

    const { data, error } = await supabase.from('omega_x_ml_models').insert({
      name, model_type, version, accuracy, f1_score, training_samples,
      feature_schema, hyperparams, artifact_url, status: 'draft',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ model: data, action: 'registered' });
  }

  if (action === 'activate') {
    const { id } = body;
    const { data: model } = await supabase.from('omega_x_ml_models').select('model_type').eq('id', id).single();
    if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

    // Deprecate all other active models of same type
    await supabase.from('omega_x_ml_models')
      .update({ status: 'deprecated', updated_at: new Date().toISOString() })
      .eq('model_type', model.model_type).eq('status', 'active').neq('id', id);

    const { data, error } = await supabase.from('omega_x_ml_models')
      .update({ status: 'active', trained_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ model: data, action: 'activated' });
  }

  if (action === 'predict') {
    const { model_type, entity_type, entity_id, features = {} } = body;
    if (!model_type) return NextResponse.json({ error: 'model_type required' }, { status: 400 });

    const { data: model } = await supabase.from('omega_x_ml_models')
      .select('id, model_type').eq('model_type', model_type).eq('status', 'active').maybeSingle();

    const start = Date.now();
    const prediction = runPrediction(model_type, features as Record<string, unknown>);
    const latencyMs = Date.now() - start;

    // Log prediction
    if (model) {
      await supabase.from('omega_x_ml_predictions').insert({
        model_id: model.id,
        entity_type: entity_type ?? null,
        entity_id: entity_id ? String(entity_id) : null,
        input_features: features,
        prediction,
        confidence: (prediction.confidence as number) ?? null,
        latency_ms: latencyMs,
      });
    }

    return NextResponse.json({ prediction, model_type, latency_ms: latencyMs, action: 'predicted' });
  }

  if (action === 'log_prediction') {
    const { model_id, entity_type, entity_id, input_features, prediction, confidence, latency_ms } = body;
    const { data, error } = await supabase.from('omega_x_ml_predictions').insert({
      model_id, entity_type, entity_id, input_features, prediction, confidence, latency_ms,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ prediction: data, action: 'logged' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ml] POST error:', error);
    return NextResponse.json({ error: 'Ml action failed' }, { status: 500 });
  }
}
