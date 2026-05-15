export type OrderStatus =
  | 'pending'
  | 'payment_confirmed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type SupplierName = 'midocean' | 'pf_concept';

export interface Product {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  category: string;
  supplierId: string;
  supplierRef: string;
  supplier: SupplierName;
  images: string[];
  printAreas: PrintArea[];
  variants: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color?: string;
  size?: string;
  stock: number;
  price: number;
}

export interface PrintArea {
  name: string;
  width: number;
  height: number;
  technique: 'embroidery' | 'dtf' | 'laser' | 'pad' | 'screen';
}

export interface Order {
  id: string;
  clientId: string;
  status: OrderStatus;
  items: OrderItem[];
  artwork?: ArtworkFile;
  pricing: PricingBreakdown;
  supplierId?: string;
  supplierOrderId?: string;
  shippingAddress: Address;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

export interface ArtworkFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  mockupUrl?: string;
}

export interface PricingBreakdown {
  subtotal: number;
  printCost: number;
  shippingCost: number;
  margin: number;
  tax: number;
  total: number;
  currency: 'EUR';
}

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface Client {
  id: string;
  email: string;
  name: string;
  company?: string;
  nif?: string;
  tier: 'standard' | 'premium' | 'enterprise';
  createdAt: Date;
}
