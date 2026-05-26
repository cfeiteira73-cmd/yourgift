export const PRINT_TECHNIQUES = {
  embroidery: { name: 'Bordado', minQuantity: 12, baseRate: 3.5 },
  dtf: { name: 'DTF', minQuantity: 1, baseRate: 2.0 },
  laser: { name: 'Laser', minQuantity: 1, baseRate: 1.5 },
  pad: { name: 'Pad Printing', minQuantity: 50, baseRate: 1.0 },
  screen: { name: 'Serigrafia', minQuantity: 24, baseRate: 0.8 },
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  created: 'Criado',
  paid: 'Pago',
  approved: 'Aprovado',
  producing: 'Em Produção',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  created: '#6b7280',   // gray
  paid: '#3b82f6',      // blue
  approved: '#8b5cf6',  // purple
  producing: '#f59e0b', // amber
  shipped: '#06b6d4',   // cyan
  delivered: '#10b981', // emerald
  cancelled: '#ef4444', // red
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  pricing: 'A calcular preço',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido em Encomenda',
};

export const APPROVAL_STAGE_LABELS: Record<string, string> = {
  hr: 'RH',
  manager: 'Gestor',
  finance: 'Financeiro',
};

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  onboarding_kit: 'Kit Onboarding',
  event_kit: 'Kit Evento',
  marketing_kit: 'Kit Marketing',
  custom: 'Personalizado',
};

export const SUPPLIER_LABELS: Record<string, string> = {
  midocean: 'Midocean',
  pf_concept: 'PF Concept',
  stricker: 'Stricker',
};

export const MARGIN_RATE = 0.35;
export const VAT_RATE = 0.23;
export const FREE_SHIPPING_THRESHOLD = 500;

export const VOLUME_DISCOUNTS = [
  { minQty: 250, discount: 0.15 },
  { minQty: 100, discount: 0.10 },
  { minQty: 50, discount: 0.05 },
  { minQty: 1, discount: 0 },
] as const;

export const TIER_MARGIN_OVERRIDE: Record<string, number> = {
  enterprise: 0.25,
  premium: 0.30,
  standard: 0.35,
};

export const SHIPPING_RATES: Record<string, number> = {
  PT: 5,
  ES: 8,
  FR: 12,
  DE: 14,
  GB: 15,
  DEFAULT: 18,
};

export const ARTWORK_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/pdf',
  'application/postscript', // .ai / .eps
] as const;

export const ARTWORK_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const S3_PRESIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes
