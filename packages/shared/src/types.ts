// ─────────────────────────────────────────────
// ORDER TYPES
// ─────────────────────────────────────────────

export type OrderStatus =
  | 'created'
  | 'paid'
  | 'approved'
  | 'producing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type QuoteStatus =
  | 'draft'
  | 'submitted'
  | 'pricing'
  | 'approved'
  | 'rejected'
  | 'converted';

export type ApprovalStage = 'hr' | 'manager' | 'finance';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ArtworkStatus =
  | 'pending'
  | 'uploaded'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

export type PrintTechnique = 'embroidery' | 'dtf' | 'laser' | 'pad' | 'screen';

export type SupplierName = 'midocean' | 'pf_concept' | 'stricker';

export type ClientTier = 'standard' | 'premium' | 'enterprise';

export type CampaignType =
  | 'onboarding_kit'
  | 'event_kit'
  | 'marketing_kit'
  | 'custom';

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom';

// ─────────────────────────────────────────────
// CORE ENTITIES
// ─────────────────────────────────────────────

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface PrintArea {
  name: string;
  width: number;
  height: number;
  technique: PrintTechnique;
}

export interface PricingBreakdown {
  subtotal: number;
  printCost: number;
  shippingCost: number;
  margin: number;
  marginRate: number;
  tax: number;
  total: number;
  currency: 'EUR';
}

// ─────────────────────────────────────────────
// CLIENT & COMPANY
// ─────────────────────────────────────────────

export interface Client {
  id: string;
  email: string;
  name: string;
  company?: string;
  nif?: string;
  tier: ClientTier;
  companyId?: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  nif?: string;
  domain?: string;
  logoUrl?: string;
  primaryColor?: string;
  tier: ClientTier;
  billingEmail?: string;
  shippingAddress?: Address;
  createdAt: Date;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  headEmail?: string;
}

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────

export interface Product {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  category: string;
  supplierRef: string;
  supplier: SupplierName;
  images: string[];
  printAreas: PrintArea[];
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color?: string;
  colorGroup?: string;
  size?: string;
  stock: number;
  price: number;
  images: string[];
}

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────

export interface Order {
  id: string;
  ref: string;
  clientId: string;
  companyId?: string;
  departmentId?: string;
  campaignId?: string;
  status: OrderStatus;
  items: OrderItem[];
  artworks: ArtworkFile[];
  approvals: Approval[];
  eventLogs: EventLog[];
  pricingSnapshot?: PricingBreakdown;
  totalAmount?: number;
  marginAmount?: number;
  supplier?: SupplierName;
  supplierOrderId?: string;
  shippingAddress: Address;
  trackingNumber?: string;
  approvedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  printCost: number;
  technique?: PrintTechnique;
}

// ─────────────────────────────────────────────
// QUOTES / RFQ
// ─────────────────────────────────────────────

export interface Quote {
  id: string;
  ref: string;
  clientId: string;
  companyId?: string;
  status: QuoteStatus;
  items: QuoteItem[];
  eventDate?: Date;
  deliveryDate?: Date;
  notes?: string;
  artworkUrl?: string;
  pricingSnapshot?: PricingBreakdown;
  totalAmount?: number;
  marginAmount?: number;
  convertedOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  technique?: PrintTechnique;
  unitCost?: number;
  unitPrice?: number;
  notes?: string;
}

// ─────────────────────────────────────────────
// ARTWORK
// ─────────────────────────────────────────────

export interface ArtworkFile {
  id: string;
  orderId: string;
  filename: string;
  originalUrl: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  mockupUrl?: string;
  status: ArtworkStatus;
  reviewNotes?: string;
  reviewedAt?: Date;
  uploadedAt: Date;
}

export interface ArtworkUploadIntent {
  artworkId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: Date;
}

// ─────────────────────────────────────────────
// APPROVALS
// ─────────────────────────────────────────────

export interface Approval {
  id: string;
  orderId: string;
  requestedById: string;
  stage: ApprovalStage;
  status: ApprovalStatus;
  approvedById?: string;
  notes?: string;
  requestedAt: Date;
  resolvedAt?: Date;
}

// ─────────────────────────────────────────────
// BUDGETS
// ─────────────────────────────────────────────

export interface Budget {
  id: string;
  companyId: string;
  departmentId?: string;
  name: string;
  period: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  limitAmount: number;
  spentAmount: number;
  alertThreshold: number;
  alertSent: boolean;
  isActive: boolean;
  remaining: number; // computed: limitAmount - spentAmount
  utilization: number; // computed: spentAmount / limitAmount
}

export interface BudgetAvailability {
  available: boolean;
  remaining: number;
  budget?: Budget;
  reason?: string;
}

// ─────────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────────

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  type: CampaignType;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  totalOrders: number;
  totalSpent: number;
  items: CampaignItem[];
  createdAt: Date;
}

export interface CampaignItem {
  id: string;
  campaignId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

// ─────────────────────────────────────────────
// COMPANY STORES
// ─────────────────────────────────────────────

export interface CompanyStore {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  bannerUrl?: string;
  welcomeMessage?: string;
  isActive: boolean;
  allowedEmails: string[];
  monthlyBudget?: number;
  products?: CompanyStoreProduct[];
  createdAt: Date;
}

export interface CompanyStoreProduct {
  id: string;
  storeId: string;
  productId: string;
  customPrice?: number;
  isAvailable: boolean;
  sortOrder: number;
  product?: Product;
}

// ─────────────────────────────────────────────
// EVENT LOG
// ─────────────────────────────────────────────

export interface EventLog {
  id: string;
  orderId?: string;
  entity: string;
  entityId: string;
  event: string;
  actorId?: string;
  actorType?: 'client' | 'admin' | 'system';
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface OrderTimelineEntry {
  event: string;
  label: string;
  timestamp: Date;
  actorId?: string;
  actorType?: string;
  payload?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────

export interface DashboardKpis {
  revenueMtd: number;
  revenueGrowth: number;
  activeOrders: number;
  pendingApprovals: number;
  avgMargin: number;
  topSupplier: string;
}

export interface RevenueAnalytics {
  total: number;
  byDay: { date: string; revenue: number }[];
  byStatus: { status: string; count: number; revenue: number }[];
  bySupplier: { supplier: string; count: number; revenue: number }[];
}

export interface MarginAnalytics {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  avgMarginRate: number;
  bySupplier: { supplier: string; revenue: number; margin: number; rate: number }[];
  byCategory: { category: string; revenue: number; margin: number; rate: number }[];
}

export interface SupplierPerformance {
  supplier: string;
  orderCount: number;
  revenue: number;
  avgDeliveryDays: number;
  onTimeRate: number;
}

export interface OrderFunnel {
  stage: string;
  count: number;
  conversionRate: number;
}
