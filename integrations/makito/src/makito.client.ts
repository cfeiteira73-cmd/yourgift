// ── Makito API Client ─────────────────────────────────────────────────────────
// OAuth2 client_credentials flow with:
//   • Automatic token refresh (300s before expiry)
//   • Rate limit handling (429 → Retry-After)
//   • Exponential backoff retry (3 attempts)
//   • Circuit breaker (5 failures → open 60s)
//   • Request logging with duration
//   • Error classification

import type {
  MakitoTokenResponse,
  MakitoCatalogResponse,
  MakitoProduct,
  MakitoStockResponse,
  MakitoPriceItem,
  MakitoOrderRequest,
  MakitoOrderResponse,
  MakitoRFQRequest,
  MakitoRFQResponse,
  MakitoShipmentTracking,
  MakitoArtworkValidationRequest,
  MakitoArtworkValidationResponse,
} from './makito.types';

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
const TOKEN_REFRESH_BUFFER_S = 300; // refresh 5 min before expiry

export type MakitoErrorType =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN';

export class MakitoApiError extends Error {
  constructor(
    public readonly type: MakitoErrorType,
    message: string,
    public readonly statusCode?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'MakitoApiError';
  }
}

interface TokenState {
  accessToken: string;
  expiresAt: number; // epoch ms
}

interface CircuitState {
  failures: number;
  openedAt: number | null; // epoch ms or null if closed
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class MakitoClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private token: TokenState | null = null;
  private circuit: CircuitState = { failures: 0, openedAt: null };
  private readonly log: (msg: string) => void;

  constructor(opts: {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    logger?: (msg: string) => void;
  }) {
    if (!opts.clientId) throw new Error('MakitoClient: clientId is required');
    if (!opts.clientSecret) throw new Error('MakitoClient: clientSecret is required');
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.baseUrl = (opts.baseUrl ?? 'https://api.makito.es').replace(/\/$/, '');
    this.log = opts.logger ?? ((msg) => console.log(`[Makito] ${msg}`));
  }

  // ── Circuit Breaker ────────────────────────────────────────────────────────

  private isCircuitOpen(): boolean {
    if (this.circuit.openedAt === null) return false;
    if (Date.now() - this.circuit.openedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
      this.log('Circuit breaker: half-open — attempting recovery');
      this.circuit = { failures: 0, openedAt: null };
      return false;
    }
    return true;
  }

  private recordSuccess() {
    this.circuit.failures = 0;
    this.circuit.openedAt = null;
  }

  private recordFailure() {
    this.circuit.failures++;
    if (this.circuit.failures >= CIRCUIT_BREAKER_THRESHOLD && this.circuit.openedAt === null) {
      this.circuit.openedAt = Date.now();
      this.log(`Circuit breaker: OPEN after ${this.circuit.failures} failures`);
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async authenticate(): Promise<string> {
    if (this.token && this.token.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_S * 1000) {
      return this.token.accessToken;
    }
    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    this.log('Refreshing OAuth token...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'catalog orders stock pricing',
      });

      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new MakitoApiError('AUTH_FAILED', `OAuth failed ${res.status}: ${text}`, res.status, text);
      }

      const data: MakitoTokenResponse = await res.json();
      this.token = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      this.log(`Token refreshed — expires in ${data.expires_in}s`);
      return this.token.accessToken;
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; circuitOpen: boolean }> {
    const start = Date.now();
    const circuitOpen = this.isCircuitOpen();
    if (circuitOpen) return { healthy: false, latencyMs: 0, circuitOpen: true };
    try {
      await this.request<{ status: string }>('/api/v1/health');
      return { healthy: true, latencyMs: Date.now() - start, circuitOpen: false };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, circuitOpen: false };
    }
  }

  // ── Core Request ───────────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
    attempt = 1,
  ): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new MakitoApiError('CIRCUIT_OPEN', 'Makito circuit breaker is OPEN — too many recent failures');
    }

    const token = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client-ID': this.clientId,
          ...options.headers,
        },
        signal: controller.signal,
      });

      const duration = Date.now() - start;
      this.log(`${options.method ?? 'GET'} ${path} → ${res.status} (${duration}ms)`);

      // Rate limited
      if (res.status === 429 && attempt <= MAX_RETRIES) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10', 10) * 1000;
        this.log(`Rate limited — waiting ${retryAfter}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(retryAfter);
        return this.request<T>(path, options, attempt + 1);
      }

      // Token expired mid-flight
      if (res.status === 401) {
        this.token = null;
        if (attempt <= 2) {
          this.log('Token expired mid-flight — refreshing and retrying');
          return this.request<T>(path, options, attempt + 1);
        }
        throw new MakitoApiError('AUTH_FAILED', 'Makito auth failed after token refresh', 401);
      }

      // Server errors — retry with backoff
      if (res.status >= 500 && attempt <= MAX_RETRIES) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        this.log(`Server error ${res.status} — retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
        this.recordFailure();
        await sleep(backoff);
        return this.request<T>(path, options, attempt + 1);
      }

      if (res.status === 404) {
        throw new MakitoApiError('NOT_FOUND', `Makito 404: ${path}`, 404);
      }

      if (res.status >= 400) {
        const body = await res.text();
        const type: MakitoErrorType = res.status === 422 ? 'VALIDATION' : 'UNKNOWN';
        throw new MakitoApiError(type, `Makito ${res.status} on ${path}: ${body}`, res.status, body);
      }

      this.recordSuccess();
      return res.json() as Promise<T>;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.recordFailure();
        if (attempt <= MAX_RETRIES) {
          this.log(`Request timeout — retrying (attempt ${attempt}/${MAX_RETRIES})`);
          return this.request<T>(path, options, attempt + 1);
        }
        throw new MakitoApiError('TIMEOUT', `Makito request timed out: ${path}`);
      }
      if (err instanceof MakitoApiError) throw err;
      this.recordFailure();
      throw new MakitoApiError('UNKNOWN', String(err));
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────

  async getProducts(opts: { page?: number; pageSize?: number; since?: string } = {}): Promise<MakitoCatalogResponse> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.since) params.set('since', opts.since);
    return this.request<MakitoCatalogResponse>(`/api/v1/products?${params}`);
  }

  async getProduct(reference: string): Promise<MakitoProduct> {
    return this.request<MakitoProduct>(`/api/v1/products/${reference}`);
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  async getStock(): Promise<MakitoStockResponse> {
    return this.request<MakitoStockResponse>('/api/v1/stock');
  }

  async getStockMap(): Promise<Map<string, number>> {
    const { items } = await this.getStock();
    return new Map(items.map((s) => [s.sku, s.available]));
  }

  // ── Pricing ───────────────────────────────────────────────────────────────

  async getPriceList(currency = 'EUR'): Promise<MakitoPriceItem[]> {
    return this.request<MakitoPriceItem[]>(`/api/v1/prices?currency=${currency}`);
  }

  async getPriceMap(currency = 'EUR'): Promise<Map<string, number>> {
    const prices = await this.getPriceList(currency);
    return new Map(prices.map((p) => [p.sku, p.basePrice]));
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async createOrder(order: MakitoOrderRequest): Promise<MakitoOrderResponse> {
    return this.request<MakitoOrderResponse>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrder(orderId: string): Promise<MakitoOrderResponse> {
    return this.request<MakitoOrderResponse>(`/api/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<{ cancelled: boolean }> {
    return this.request<{ cancelled: boolean }>(`/api/v1/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ── RFQ ───────────────────────────────────────────────────────────────────

  async createRFQ(req: MakitoRFQRequest): Promise<MakitoRFQResponse> {
    return this.request<MakitoRFQResponse>('/api/v1/rfq', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // ── Shipment ──────────────────────────────────────────────────────────────

  async getShipmentTracking(orderId: string): Promise<MakitoShipmentTracking> {
    return this.request<MakitoShipmentTracking>(`/api/v1/orders/${orderId}/tracking`);
  }

  // ── Artwork ───────────────────────────────────────────────────────────────

  async validateArtwork(req: MakitoArtworkValidationRequest): Promise<MakitoArtworkValidationResponse> {
    return this.request<MakitoArtworkValidationResponse>('/api/v1/artwork/validate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // ── Circuit Breaker Status ────────────────────────────────────────────────

  getCircuitState() {
    return {
      open: this.isCircuitOpen(),
      failures: this.circuit.failures,
      openedAt: this.circuit.openedAt ? new Date(this.circuit.openedAt).toISOString() : null,
    };
  }
}
