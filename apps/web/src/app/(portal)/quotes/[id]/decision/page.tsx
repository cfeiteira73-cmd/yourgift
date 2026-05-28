'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { DecisionCard, type DecisionCardData } from '@/components/portal/DecisionCard';
import { generateDecisionCard } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

/**
 * /quotes/:id/decision
 *
 * One-screen procurement decision card.
 * Loads quote data from Supabase, calls the Decision Engine API,
 * and renders the full DecisionCard component.
 *
 * "Everything a procurement manager needs to decide, in under 30 seconds."
 */

interface QuoteData {
  id: string;
  ref: string;
  status: string;
  items: Array<{
    product_id: string;
    product_title: string;
    quantity: number;
    unit_price?: number;
  }>;
  pricing?: {
    total?: number;
    shippingCost?: number;
  } | null;
  supplier_id?: string;
  supplier_name?: string;
  origin_country?: string;
  destination_country?: string;
  quoted_lead_days?: number;
  required_by_date?: string | null;
  available_budget_eur?: number | null;
}

export default function QuoteDecisionPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<DecisionCardData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);

  const loadAndGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Load auth + quote in parallel
      const [{ data: { session } }, { data: quoteRaw, error: quoteErr }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .single(),
      ]);

      if (!session) { router.push('/auth/login'); return; }
      if (quoteErr || !quoteRaw) { setError('Orçamento não encontrado'); return; }

      const q = quoteRaw as QuoteData;
      setQuote(q);

      // Determine inputs from quote (with sensible defaults for missing data)
      const firstItem = q.items?.[0];
      if (!firstItem) { setError('Orçamento sem artigos'); return; }

      const tenantId = (session.user.user_metadata as { tenantId?: string }).tenantId
        ?? (session.user.app_metadata as { tenantId?: string }).tenantId
        ?? session.user.id;

      setGenerating(true);
      const decisionCard = await generateDecisionCard({
        tenantId,
        quoteId: q.id,
        productName: firstItem.product_title ?? 'Produto',
        quantity: firstItem.quantity ?? 1,
        unitPriceEur: firstItem.unit_price ?? (q.pricing?.total ?? 0) / (firstItem.quantity ?? 1),
        weightKgTotal: firstItem.quantity * 0.3,  // 300g/unit default — override from product data
        supplierId: q.supplier_id ?? 'default',
        supplierName: q.supplier_name ?? 'Fornecedor',
        originCountry: q.origin_country ?? 'PT',
        destinationCountry: q.destination_country ?? 'PT',
        quotedLeadDays: q.quoted_lead_days ?? 10,
        availableBudgetEur: q.available_budget_eur ?? undefined,
        requiredByDate: q.required_by_date ?? undefined,
        carrier: 'best',
      });

      setCard(decisionCard as DecisionCardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar cartão de decisão');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [quoteId, router]);

  useEffect(() => { loadAndGenerate(); }, [loadAndGenerate]);

  async function handleApprove(_cardId: string) {
    const supabase = createClient();
    await supabase.from('quotes').update({ status: 'approved' }).eq('id', quoteId);
    setTimeout(() => router.push('/orders/new'), 1200);
  }

  async function handleReject(_cardId: string) {
    const supabase = createClient();
    await supabase.from('quotes').update({ status: 'rejected' }).eq('id', quoteId);
    setTimeout(() => router.push('/quotes'), 1200);
  }

  async function handleRevision(_cardId: string) {
    const supabase = createClient();
    await supabase.from('quotes').update({ status: 'revision_requested' }).eq('id', quoteId);
    setTimeout(() => router.push('/quotes'), 1200);
  }

  return (
    <PortalLayout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: '1280px', margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Link href="/quotes" style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', textDecoration: 'none' }}>
            Orçamentos
          </Link>
          <span style={{ color: 'rgb(80,90,110)' }}>›</span>
          <Link href={`/quotes/${quoteId}`} style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', textDecoration: 'none' }}>
            {quote?.ref ?? quoteId}
          </Link>
          <span style={{ color: 'rgb(80,90,110)' }}>›</span>
          <span style={{ fontSize: '0.8rem', color: 'rgb(77,163,255)' }}>Decisão de compra</span>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.25rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid rgba(77,163,255,0.2)', borderTopColor: 'rgb(77,163,255)', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: '0.875rem', color: 'rgb(120,130,150)' }}>
              {generating ? 'A analisar custo landed, confiança do fornecedor e prazo…' : 'A carregar orçamento…'}
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="yg-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '480px', margin: '4rem auto' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.5rem' }}>Não foi possível gerar o cartão</p>
            <p style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', marginBottom: '1.5rem' }}>{error}</p>
            <button type="button"
              type="button"
              onClick={loadAndGenerate}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', background: 'rgb(77,163,255)', color: 'rgb(7,17,31)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Decision card */}
        {!loading && !error && card && (
          <DecisionCard
            card={card}
            onApprove={handleApprove}
            onReject={handleReject}
            onRequestRevision={handleRevision}
          />
        )}
      </div>
    </PortalLayout>
  );
}
