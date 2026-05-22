import type { PFProduct } from './pf.types';

const TIMEOUT_MS = 30_000;
const PAGE_SIZE = 500;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class PFConceptClient {
  private baseUrl = 'https://api.pfconcept.com/v1';
  private apiKey: string;
  private username: string;

  constructor(apiKey: string, username: string) {
    if (!apiKey) throw new Error('PFConceptClient: apiKey is required');
    if (!username) throw new Error('PFConceptClient: username is required');
    this.apiKey = apiKey;
    this.username = username;
  }

  private get authHeader(): string {
    const credentials = Buffer.from(`${this.username}:${this.apiKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(path: string, options: RequestInit = {}, attempt = 1): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
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
        const error = await res.text();
        throw new Error(`PF Concept API error ${res.status} on ${path}: ${error}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch the full PF Concept product catalogue, paginating until all pages
   * are retrieved. Returns all products as a flat array.
   */
  async getCatalog(): Promise<PFProduct[]> {
    const all: PFProduct[] = [];
    let page = 1;

    while (true) {
      const raw = await this.request<PFProduct[] | { products: PFProduct[]; hasMore?: boolean; totalPages?: number }>(
        `/products?pageSize=${PAGE_SIZE}&page=${page}`,
      );

      // Handle both array response and paginated envelope response
      if (Array.isArray(raw)) {
        all.push(...raw);
        // If fewer items than page size, we've reached the last page
        if (raw.length < PAGE_SIZE) break;
      } else {
        const items = raw.products ?? [];
        all.push(...items);
        const hasMore = raw.hasMore ?? (raw.totalPages !== undefined ? page < raw.totalPages : items.length === PAGE_SIZE);
        if (!hasMore) break;
      }

      page++;
    }

    return all;
  }

  /** @deprecated Use getCatalog() for typed results. Kept for backward compatibility. */
  async getProducts(page = 1, limit = 100): Promise<PFProduct[]> {
    return this.request<PFProduct[]>(`/products?page=${page}&limit=${limit}`);
  }

  async createOrder(order: {
    reference: string;
    items: Array<{ articleCode: string; quantity: number }>;
    shippingAddress: Record<string, string>;
  }) {
    return this.request<{ orderId: string; status: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrderTracking(orderId: string) {
    return this.request<{ trackingUrl: string; status: string }>(`/orders/${orderId}/tracking`);
  }
}
