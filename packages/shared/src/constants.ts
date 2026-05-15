export const PRINT_TECHNIQUES = {
  embroidery: { name: 'Bordado', minQuantity: 12 },
  dtf: { name: 'DTF', minQuantity: 1 },
  laser: { name: 'Laser', minQuantity: 1 },
  pad: { name: 'Pad Printing', minQuantity: 50 },
  screen: { name: 'Serigrafia', minQuantity: 24 },
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  payment_confirmed: 'Pagamento Confirmado',
  in_production: 'Em Produção',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const MARGIN_RATE = 0.35;
export const VAT_RATE = 0.23;
export const FREE_SHIPPING_THRESHOLD = 500;
