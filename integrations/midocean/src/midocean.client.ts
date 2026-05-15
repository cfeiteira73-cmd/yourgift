import type {
  MidoceanProduct,
  MidoceanStockResponse,
  MidoceanOrderRequest,
  MidoceanOrderResponse,
  MidoceanPriceItem,
} from './midocean.types';

const BASE_URL = 'https://api.midocean.com/gateway';

export class MidoceanClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      // Real auth header confirmed against live API
      'x-Gateway-APIKey': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Midocean ${res.status} on ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /** Full product catalogue — 2428+ products with variants and images */
  async getProducts(language = 'en'): Promise<MidoceanProduct[]> {
    return this.request<MidoceanProduct[]>(`/products/2.0?language=${language}`);
  }

  /** Real-time stock levels for all SKUs */
  async getStock(): Promise<MidoceanStockResponse> {
    return this.request<MidoceanStockResponse>('/stock/2.0');
  }

  /** Stock as a lookup map: sku → qty */
  async getStockMap(): Promise<Map<string, number>> {
    const { stock } = await this.getStock();
    return new Map(stock.map((s) => [s.sku, s.qty]));
  }

  /** Price list — generated async by Midocean, retry after 24h on first call */
  async getPriceList(currency = 'EUR'): Promise<MidoceanPriceItem[]> {
    const raw = await this.request<any>(`/pricelist/2.0?currency=${currency}`);
    if (raw?.PRICELIST_RESPONSE) {
      console.warn('[Midocean] Pricelist status:', raw.PRICELIST_RESPONSE.STATUS_TEXT);
      return [];
    }
    return raw as MidoceanPriceItem[];
  }

  /** Place a production order */
  async createOrder(order: MidoceanOrderRequest): Promise<MidoceanOrderResponse> {
    return this.request<MidoceanOrderResponse>('/order/2.0/create', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  /** Order status + tracking */
  async getOrderStatus(orderId: string): Promise<MidoceanOrderResponse> {
    return this.request<MidoceanOrderResponse>(`/order/2.0/status/${orderId}`);
  }
}
