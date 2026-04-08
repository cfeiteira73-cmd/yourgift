export type RFQStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "quoted"
  | "approved"
  | "in_production"
  | "completed"
  | "cancelled";

export type BudgetRange =
  | "under_1k"
  | "1k_5k"
  | "5k_15k"
  | "15k_50k"
  | "over_50k";

export const budgetLabels: Record<BudgetRange, string> = {
  under_1k: "Menos de €1.000",
  "1k_5k": "€1.000 – €5.000",
  "5k_15k": "€5.000 – €15.000",
  "15k_50k": "€15.000 – €50.000",
  over_50k: "Mais de €50.000",
};

export interface RFQItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  brandingMethod?: string;
  notes?: string;
  estimatedPrice?: number;
}

export interface RFQ {
  id: string;
  reference: string;
  status: RFQStatus;

  // Contact
  name: string;
  email: string;
  phone?: string;
  company: string;
  vat?: string;
  role?: string;

  // Project
  objective: string;
  budget: BudgetRange;
  deadline: string;
  quantity: number;
  brandingMethod?: string;

  // Items
  items: RFQItem[];

  // Delivery
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryCountry: string;

  // Files
  files: string[];

  // Notes
  notes?: string;

  // Meta
  createdAt: Date;
  updatedAt: Date;
  quotedAt?: Date;
  respondedAt?: Date;
}
