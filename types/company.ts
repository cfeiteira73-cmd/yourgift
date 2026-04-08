export type CompanyPlan = "starter" | "growth" | "enterprise";

export type MemberRole = "owner" | "admin" | "buyer" | "viewer";

export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  role: MemberRole;
  name: string;
  email: string;
  avatar?: string;
  department?: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  legalName?: string;
  vat?: string;
  logo?: string;
  plan: CompanyPlan;
  members: CompanyMember[];
  addresses: Address[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export interface CompanyStore {
  id: string;
  slug: string;
  companyId: string;
  name: string;
  logo?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  active: boolean;
  allowedDomains?: string[];
  catalogItems: StoreCatalogItem[];
  createdAt: Date;
}

export interface StoreCatalogItem {
  id: string;
  storeId: string;
  productId: string;
  customPrice?: number;
  visible: boolean;
  sortOrder: number;
}
