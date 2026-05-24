/**
 * API client for YourGift OS backend
 * All calls include Bearer token from session.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getToken(): Promise<string | null> {
  // Get JWT from Supabase session cookie
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((error as { message?: string }).message ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Decision Engine ───────────────────────────────────────────────────────────

export interface DecisionCardInput {
  tenantId: string;
  quoteId?: string;
  productName: string;
  quantity: number;
  unitPriceEur: number;
  weightKgTotal: number;
  hsCommodityCode?: string;
  supplierId: string;
  supplierName: string;
  originCountry: string;
  quotedLeadDays: number;
  destinationCountry: string;
  budgetId?: string;
  availableBudgetEur?: number;
  requiredByDate?: string;
  carrier?: 'dhl' | 'dpd' | 'gls' | 'ups' | 'fedex' | 'best';
}

export async function generateDecisionCard(input: DecisionCardInput) {
  return apiFetch('/decision-engine/card', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ── Intelligence / ROI ────────────────────────────────────────────────────────

export async function generateROIReport(input: {
  tenantId: string;
  companyName: string;
  period: string;
  requestedBy?: string;
}) {
  return apiFetch('/intelligence/roi', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getSupplierTrust(supplierId: string) {
  return apiFetch(`/intelligence/suppliers/${supplierId}/trust`);
}

// ── Public (no auth) ──────────────────────────────────────────────────────────

export async function getPublicROIReport(shareToken: string) {
  const res = await fetch(`${API_URL}/api/v1/intelligence/roi/${shareToken}`);
  if (!res.ok) throw new Error('Report not found');
  return res.json();
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export async function getQuote(quoteId: string) {
  return apiFetch(`/quotes/${quoteId}`);
}

export async function approveQuote(quoteId: string) {
  return apiFetch(`/quotes/${quoteId}/approve`, { method: 'POST' });
}

export async function rejectQuote(quoteId: string, reason?: string) {
  return apiFetch(`/quotes/${quoteId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
