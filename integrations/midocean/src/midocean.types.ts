// Real field names from Midocean API v2.0

export interface MidoceanDigitalAsset {
  url: string;
  url_highress?: string;
  type: 'image' | 'document' | 'video';
  subtype: string;
}

export interface MidoceanVariant {
  variant_id: string;
  sku: string;
  release_date: string;
  discontinued_date: string;
  category_level1: string;
  category_level2: string;
  category_level3: string;
  color_description: string;
  color_group: string;
  color_code: string;
  pms_color: string;
  plc_status: string;
  plc_status_description: string;
  gtin: string;
  digital_assets: MidoceanDigitalAsset[];
}

export interface MidoceanProduct {
  master_code: string;
  master_id: string;
  type_of_products: string;
  commodity_code: string;
  number_of_print_positions: string;
  country_of_origin: string;
  brand: string;
  product_name: string;
  category_code: string;
  product_class: string;
  dimensions: string;
  length: string;
  width: string;
  height: string;
  gross_weight: string;
  net_weight: string;
  outer_carton_quantity: string;
  short_description: string;
  long_description: string;
  material: string;
  printable: 'yes' | 'no';
  packaging_after_printing: string;
  digital_assets: MidoceanDigitalAsset[];
  variants: MidoceanVariant[];
}

export interface MidoceanStockItem {
  sku: string;
  qty: number;
  first_arrival_date?: string;
  first_arrival_qty?: number;
}

export interface MidoceanStockResponse {
  modified_at: string;
  stock: MidoceanStockItem[];
}

export interface MidoceanPriceItem {
  sku: string;
  net_price: number;
  gross_price: number;
  currency: string;
}

export interface MidoceanOrderRequest {
  order_reference: string;
  delivery_address: {
    company_name: string;
    attention: string;
    address1: string;
    city: string;
    postal_code: string;
    country_code: string;
    phone?: string;
  };
  order_rows: Array<{
    sku: string;
    quantity: number;
    printing_positions?: Array<{
      position_id: string;
      print_technique: string;
      artwork_url: string;
    }>;
  }>;
}

export interface MidoceanOrderResponse {
  order_id: string;
  order_status: string;
  estimated_delivery_date: string;
  tracking_url?: string;
}
