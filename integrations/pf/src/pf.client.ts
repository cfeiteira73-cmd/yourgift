export class PFConceptClient {
  private baseUrl = 'https://api.pfconcept.com/v1';
  private apiKey: string;
  private username: string;

  constructor(apiKey: string, username: string) {
    this.apiKey = apiKey;
    this.username = username;
  }

  private get authHeader() {
    const credentials = Buffer.from(`${this.username}:${this.apiKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`PF Concept API error ${res.status}: ${error}`);
    }

    return res.json() as Promise<T>;
  }

  async getProducts(page = 1, limit = 100) {
    return this.request<any[]>(`/products?page=${page}&limit=${limit}`);
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
