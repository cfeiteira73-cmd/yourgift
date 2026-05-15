import type {
  MidoceanProduct,
  MidoceanStockResponse,
  MidoceanOrderRequest,
  MidoceanOrderResponse,
  MidoceanPriceItem,
} from './midocean.types';

const BASE_URL = 'https://api.midocean.com/gateway';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MidoceanClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('MidoceanClient: apiKey is required');
    this.apiKey = apiKey;
  }

  private get headers(): HeadersInit {
    return {
      'x-Gateway-APIKey': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}, attempt = 1): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal,
      });

      if (res.status === 429 && attempt <= MAX_RETRIES) {
        const wait = parseInt(res.headers.get('Retry-After') ?? '5', 10) * 1_000;
        await sleep(wait);
        return this.request<T>(path, options, attempt + 1);
      }

      if (res.status >= 500 && attempt <= MAX_RETRIES) {
        await sleep(1_000 * attempt);
        return this.request<T>(path, options, attempt + 1);
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Midocean ${res.status} on ${path}: ${body}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Full product catalogue — 2428+ products with variants, images, print info */
  async getProducts(language = 'en'): Promise<MidoceanProduct[]> {
    return this.request<MidoceanProduct[]>(`/products/2.0?language=${language}`);
  }

  /** Real-time stock levels for all SKUs */
  async getStock(): Promise<MidoceanStockResponse> {
    return this.request<MidoceanStockResponse>('/stock/2.0');
  }

  /** Stock as O(1) lookup map: sku → qty */
  async getStockMap(): Promise<Map<string, number>> {
    const { stock } = await this.getStock();
    return new Map(stock.map((s) => [s.sku, s.qty]));
  }

  /** Price list — generated async on first call, ready in ~24h */
  async getPriceList(currency = 'EUR'): Promise<MidoceanPriceItem[]> {
    const raw = await this.request<any>(`/pricelist/2.0?currency=${currency}`);
    if (raw?.PRICELIST_RESPONSE) {
      console.warn('[Midocean] Pricelist status:', raw.PRICELIST_RESPONSE.STATUS_TEXT);
      return [];
    }
    return Array.isArray(raw) ? raw : [];
  }

  /** Place a production order with full branding spec */
  async createOrder(order: MidoceanOrderRequest): Promise<MidoceanOrderResponse> {
    return this.request<MidoceanOrderResponse>('/order/2.0/create', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  /** Track an existing Midocean order */
  async getOrderStatus(orderId: string): Promise<MidoceanOrderResponse> {
    return this.request<MidoceanOrderResponse>(`/order/2.0/status/${orderId}`);
  }

  /** Health check — confirms API key is accepted */
  async ping(): Promise<boolean> {
    try {
      await this.request('/stock/2.0');
      return true;
    } catch {
      return false;
    }
  }
}
