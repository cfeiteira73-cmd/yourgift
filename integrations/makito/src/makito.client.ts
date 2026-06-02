// ── Makito B2B API Client — Real API ─────────────────────────────────────────
//
// Base URL:  https://apis.makito.es
// Auth:      POST /access/auth/login → { token } — JWT Bearer
// Rate limit: Token bucket — 100 max capacity, 25 req/min replenishment
//             429 when bucket empty
//
// Features:
//   • JWT auth with automatic refresh (token stored in-memory)
//   • Token bucket rate limit handling (429 → wait + retry)
//   • Exponential backoff retry (3 attempts)
//   • Circuit breaker (5 consecutive failures → open 60s)
//   • Request logging with duration
//   • Follow file download redirects (S3-style presigned URLs)

import type {
  MakitoLoginRequest,
  MakitoLoginResponse,
  MakitoCatalogFile,
  MakitoStockFile,
  MakitoPriceFile,
  MakitoPrintPriceFile,
  MakitoPrintConfigFile,
  MakitoOrderRequest,
  MakitoOrderResponse,
  MakitoSalesOrder,
  MakitoSalesOrderListResponse,
  MakitoDeliveriesResponse,
  MakitoRegion,
  MakitoCountry,
  MakitoColor,
} from './makito.types';

export const MAKITO_BASE_URL = 'https://apis.makito.es';
const TIMEOUT_MS = 60_000; // catalog files can be large
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
// Token bucket: 100 capacity, 25/min refill → 1 token per 2.4s
// On 429, wait 5s before retry (conservative)
const RATE_LIMIT_WAIT_MS = 5_000;

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
  jwt: string;
  cachedAt: number; // epoch ms — refresh after 1h (JWTs typically valid for longer)
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
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
  // Track in-flight token refresh to prevent concurrent re-auth
  private refreshPromise: Promise<string> | null = null;

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
    this.baseUrl = (opts.baseUrl ?? MAKITO_BASE_URL).replace(/\/$/, '');
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
    this.circuit = { failures: 0, openedAt: null };
  }

  private recordFailure() {
    this.circuit.failures++;
    if (this.circuit.failures >= CIRCUIT_BREAKER_THRESHOLD && this.circuit.openedAt === null) {
      this.circuit.openedAt = Date.now();
      this.log(`Circuit breaker OPEN after ${this.circuit.failures} failures — cooling down 60s`);
    }
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  /** Returns a valid JWT, refreshing if needed (max 1h cache) */
  async authenticate(): Promise<string> {
    const ONE_HOUR_MS = 3_600_000;
    if (this.token && Date.now() - this.token.cachedAt < ONE_HOUR_MS) {
      return this.token.jwt;
    }
    // Prevent concurrent refresh
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshToken().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async refreshToken(): Promise<string> {
    this.log('Authenticating with Makito API...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const body: MakitoLoginRequest = {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      };

      const res = await fetch(`${this.baseUrl}/access/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new MakitoApiError(
          'AUTH_FAILED',
          `Makito auth failed ${res.status}: ${text}`,
          res.status,
          text,
        );
      }

      const data: MakitoLoginResponse = await res.json();
      if (!data.token) {
        throw new MakitoApiError('AUTH_FAILED', 'Makito auth returned no token');
      }

      this.token = { jwt: data.token, cachedAt: Date.now() };
      this.log('Authentication successful');
      return this.token.jwt;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Health Check ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; circuitOpen: boolean }> {
    const start = Date.now();
    if (this.isCircuitOpen()) {
      return { healthy: false, latencyMs: 0, circuitOpen: true };
    }
    try {
      await this.authenticate();
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
      throw new MakitoApiError('CIRCUIT_OPEN', 'Makito circuit breaker is OPEN');
    }

    const jwt = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        redirect: 'manual', // handle file download redirects manually
      });

      const duration = Date.now() - start;
      this.log(`${options.method ?? 'GET'} ${path} → ${res.status} (${duration}ms)`);

      // File download redirect (catalog/stock/price files are served via presigned URLs)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (location) {
          this.log(`Following redirect → ${location.substring(0, 80)}...`);
          const fileRes = await fetch(location, { signal: controller.signal });
          if (!fileRes.ok) {
            throw new MakitoApiError('SERVER_ERROR', `File download failed ${fileRes.status}`, fileRes.status);
          }
          this.recordSuccess();
          return fileRes.json() as Promise<T>;
        }
      }

      // Rate limited — token bucket exhausted
      if (res.status === 429) {
        if (attempt <= MAX_RETRIES) {
          const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10) * 1000;
          const wait = Math.max(retryAfter, RATE_LIMIT_WAIT_MS);
          this.log(`Rate limited (token bucket empty) — waiting ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`);
          await sleep(wait);
          return this.request<T>(path, options, attempt + 1);
        }
        throw new MakitoApiError('RATE_LIMITED', 'Makito rate limit exceeded after retries', 429);
      }

      // Auth expired mid-flight
      if (res.status === 401) {
        this.token = null;
        if (attempt <= 2) {
          this.log('JWT expired — refreshing and retrying');
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
        throw new MakitoApiError('NOT_FOUND', `Not found: ${path}`, 404);
      }

      if (res.status >= 400) {
        const body = await res.text();
        throw new MakitoApiError('VALIDATION', `Makito ${res.status}: ${body}`, res.status, body);
      }

      this.recordSuccess();
      return res.json() as Promise<T>;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.recordFailure();
        if (attempt <= MAX_RETRIES) {
          this.log(`Timeout — retrying (attempt ${attempt}/${MAX_RETRIES})`);
          return this.request<T>(path, options, attempt + 1);
        }
        throw new MakitoApiError('TIMEOUT', `Request timed out: ${path}`);
      }
      if (err instanceof MakitoApiError) throw err;
      this.recordFailure();
      throw new MakitoApiError('UNKNOWN', `Unexpected error: ${String(err)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Catalog ───────────────────────────────────────────────────────────────

  async getCatalog(lang: 'en' | 'es' | 'fr' = 'en'): Promise<MakitoCatalogFile> {
    return this.request<MakitoCatalogFile>(`/catalog/files?format=JSON&lang=${lang}`);
  }

  async getCatalogAsset(prodRef: string, type: 'principal' | 'thumbnail', fileName: string): Promise<Buffer> {
    const jwt = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/catalog/assets/${prodRef}/${type}/${fileName}`, {
      headers: { 'Authorization': `Bearer ${jwt}` },
    });
    if (!res.ok) throw new MakitoApiError('NOT_FOUND', `Asset not found: ${prodRef}/${type}/${fileName}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  async getStock(opts: { plant?: string; storageLocation?: string } = {}): Promise<MakitoStockFile> {
    const params = new URLSearchParams({ format: 'JSON' });
    if (opts.plant) params.set('plant', opts.plant);
    if (opts.storageLocation) params.set('storageLocation', opts.storageLocation);
    return this.request<MakitoStockFile>(`/stock/files?${params}`);
  }

  async getStockMap(): Promise<Map<string, number>> {
    const file = await this.getStock();
    return new Map((file.stocks ?? []).map((s) => [s.material, s.quantity]));
  }

  async getStockByMaterial(material: string): Promise<number> {
    const file = await this.request<MakitoStockFile>(`/stock/stocks/${material}?format=JSON`);
    return file.stocks?.[0]?.quantity ?? 0;
  }

  // ── Pricing ───────────────────────────────────────────────────────────────

  async getPriceList(): Promise<MakitoPriceFile> {
    return this.request<MakitoPriceFile>('/price-list/files?format=JSON');
  }

  /** Returns map: material → lowest unit price (first scale = min qty price) */
  async getPriceMap(): Promise<Map<string, number>> {
    const file = await this.getPriceList();
    const map = new Map<string, number>();
    for (const item of file.priceList ?? []) {
      // Use scale with qty=1 if present, else first scale
      const baseScale = item.scales.find((s) => Number(s.quantity) <= 1) ?? item.scales[0];
      if (baseScale) {
        map.set(item.material, Number(baseScale.amount));
      }
    }
    return map;
  }

  async getPrintPriceList(): Promise<MakitoPrintPriceFile> {
    return this.request<MakitoPrintPriceFile>('/print-price-list/files?format=JSON');
  }

  // ── Print Configuration ───────────────────────────────────────────────────

  async getPrintConfig(lang: 'en' | 'es' | 'fr' = 'en'): Promise<MakitoPrintConfigFile> {
    return this.request<MakitoPrintConfigFile>(`/print-config/files?format=JSON&lang=${lang}`);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async createOrder(order: MakitoOrderRequest): Promise<MakitoOrderResponse> {
    return this.request<MakitoOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrders(filters: {
    status?: string;
    from?: string;
    to?: string;
    customerOrder?: string;
  } = {}): Promise<MakitoSalesOrderListResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.customerOrder) params.set('customerOrder', filters.customerOrder);
    const qs = params.toString() ? `?${params}` : '';
    return this.request<MakitoSalesOrderListResponse>(`/orders/sales-order${qs}`);
  }

  async getOrder(documentNumber: string): Promise<MakitoSalesOrder> {
    return this.request<MakitoSalesOrder>(`/orders/sales-order/${documentNumber}`);
  }

  async getDeliveries(filters: { from?: string; to?: string; customerOrder?: string } = {}): Promise<MakitoDeliveriesResponse> {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.customerOrder) params.set('customerOrder', filters.customerOrder);
    const qs = params.toString() ? `?${params}` : '';
    return this.request<MakitoDeliveriesResponse>(`/orders/deliveries${qs}`);
  }

  async getOrderByCustomerRef(customerOrder: string): Promise<MakitoSalesOrder | null> {
    const result = await this.getOrders({ customerOrder });
    const orders = result.orders ?? [];
    return orders.length > 0 ? orders[0] : null;
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async getRegions(): Promise<MakitoRegion[]> {
    const res = await this.request<{ regions?: MakitoRegion[] } | MakitoRegion[]>('/orders/regions');
    return Array.isArray(res) ? res : (res as any).regions ?? [];
  }

  async getCountries(): Promise<MakitoCountry[]> {
    const res = await this.request<{ countries?: MakitoCountry[] } | MakitoCountry[]>('/orders/countries');
    return Array.isArray(res) ? res : (res as any).countries ?? [];
  }

  async getColors(): Promise<MakitoColor[]> {
    const res = await this.request<{ colors?: MakitoColor[] } | MakitoColor[]>('/orders/colors');
    return Array.isArray(res) ? res : (res as any).colors ?? [];
  }

  // ── Circuit State ─────────────────────────────────────────────────────────

  getCircuitState() {
    return {
      open: this.isCircuitOpen(),
      failures: this.circuit.failures,
      openedAt: this.circuit.openedAt ? new Date(this.circuit.openedAt).toISOString() : null,
    };
  }
}
