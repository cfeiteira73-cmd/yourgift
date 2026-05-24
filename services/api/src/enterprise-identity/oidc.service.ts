import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as https_native from 'https';

/**
 * OIDCService
 *
 * Handles OIDC (OpenID Connect) SSO flows for:
 *  - Okta         (https://{domain}.okta.com/oauth2/default)
 *  - Azure AD     (https://login.microsoftonline.com/{tenant}/v2.0)
 *  - Google WS    (https://accounts.google.com)
 *  - Auth0        (https://{domain}.auth0.com)
 *
 * Flow:
 *   1. generateAuthorizationUrl() — redirect user to IdP
 *   2. IdP redirects to /enterprise-identity/oidc/:tenantId/callback?code=...
 *   3. exchangeCode() — exchange auth code for tokens
 *   4. validateIdToken() — verify signature + claims
 *   5. Return normalized user profile
 *
 * Uses jsonwebtoken for token validation (already in dependencies).
 * JWKS fetching is done via Node's built-in https module.
 * No external OIDC library required.
 */

export interface OIDCState {
  tenantId: string;
  nonce: string;
  codeVerifier: string;
  redirectAfter?: string;
}

export interface OIDCTokenSet {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface OIDCUserProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  groups?: string[];
  tenantId: string;
  rawClaims: Record<string, unknown>;
}

interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
}

interface JWKSet {
  keys: JWK[];
}

@Injectable()
export class OIDCService {
  private readonly logger = new Logger(OIDCService.name);
  private readonly stateStore = new Map<string, OIDCState & { expiresAt: number }>();
  private readonly jwksCache = new Map<string, { keys: JWK[]; cachedAt: number }>();
  private readonly JWKS_TTL_MS = 3600_000; // 1 hour

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Step 1: Generate PKCE code challenge + state, return authorization URL.
   */
  generateAuthorizationUrl(config: {
    issuer: string;
    clientId: string;
    callbackUrl: string;
    scopes: string[];
    tenantId: string;
    redirectAfter?: string;
  }): { url: string; state: string } {
    const state = randomBytes(24).toString('hex');
    const nonce = randomBytes(24).toString('hex');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    this.stateStore.set(state, {
      tenantId: config.tenantId,
      nonce,
      codeVerifier,
      redirectAfter: config.redirectAfter,
      expiresAt: Date.now() + 600_000, // 10 minutes
    });

    // Clean expired states
    for (const [k, v] of this.stateStore.entries()) {
      if (v.expiresAt < Date.now()) this.stateStore.delete(k);
    }

    const authEndpoint = this.getAuthorizationEndpoint(config.issuer);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      scope: [...new Set(['openid', 'profile', 'email', ...config.scopes])].join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { url: `${authEndpoint}?${params.toString()}`, state };
  }

  /**
   * Step 2: Validate state, exchange code for tokens.
   */
  async exchangeCode(params: {
    code: string;
    state: string;
    issuer: string;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  }): Promise<{ tokens: OIDCTokenSet; storedState: OIDCState }> {
    const storedState = this.stateStore.get(params.state);
    if (!storedState || storedState.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    this.stateStore.delete(params.state);

    const tokenEndpoint = this.getTokenEndpoint(params.issuer);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.callbackUrl,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code_verifier: storedState.codeVerifier,
    });

    const response = await this.httpPost(tokenEndpoint, body.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const data = JSON.parse(response) as {
      access_token: string;
      id_token: string;
      refresh_token?: string;
      expires_in: number;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      throw new UnauthorizedException(`OIDC token error: ${data.error_description ?? data.error}`);
    }

    return {
      tokens: {
        accessToken: data.access_token,
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 3600,
      },
      storedState,
    };
  }

  /**
   * Step 3: Validate ID token signature + claims, return user profile.
   */
  async validateIdToken(
    idToken: string,
    expectedNonce: string,
    issuer: string,
    clientId: string,
    tenantId: string,
  ): Promise<OIDCUserProfile> {
    // Decode header to get key ID
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Malformed ID token');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { kid?: string; alg: string };

    // Fetch JWKS and verify signature
    const jwksUri = this.getJWKSUri(issuer);
    const jwks = await this.fetchJWKS(jwksUri);
    const key = header.kid
      ? jwks.keys.find(k => k.kid === header.kid)
      : jwks.keys[0];

    if (!key) {
      throw new UnauthorizedException('No matching JWK found for token signature');
    }

    // Build PEM from JWK x5c (certificate chain) or n/e (RSA key)
    const pem = this.jwkToPem(key);

    let claims: Record<string, unknown>;
    try {
      claims = this.jwtService.verify(idToken, {
        secret: undefined as unknown as string, // will use publicKey below
        publicKey: pem,
        algorithms: ['RS256', 'RS384', 'RS512'],
        issuer,
        audience: clientId,
      } as Parameters<JwtService['verify']>[1]) as Record<string, unknown>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token verification failed';
      throw new UnauthorizedException(`ID token validation failed: ${message}`);
    }

    // Nonce check (replay protection)
    if (expectedNonce && claims['nonce'] !== expectedNonce) {
      throw new UnauthorizedException('ID token nonce mismatch — possible replay attack');
    }

    return {
      sub: claims['sub'] as string,
      email: (claims['email'] as string ?? '').toLowerCase(),
      emailVerified: Boolean(claims['email_verified']),
      name: claims['name'] as string | undefined,
      givenName: (claims['given_name'] ?? claims['firstName']) as string | undefined,
      familyName: (claims['family_name'] ?? claims['lastName']) as string | undefined,
      picture: claims['picture'] as string | undefined,
      groups: (claims['groups'] ?? claims['roles']) as string[] | undefined,
      tenantId,
      rawClaims: claims,
    };
  }

  // ── Well-known endpoint helpers ───────────────────────────────────────────

  private getAuthorizationEndpoint(issuer: string): string {
    // Azure AD / Okta well-known endpoints
    if (issuer.includes('microsoftonline.com')) {
      return `${issuer}/oauth2/v2.0/authorize`;
    }
    if (issuer.includes('.okta.com')) {
      return `${issuer}/v1/authorize`;
    }
    if (issuer.includes('accounts.google.com')) {
      return 'https://accounts.google.com/o/oauth2/v2/auth';
    }
    // Generic OIDC — append /authorize
    return `${issuer}/authorize`;
  }

  private getTokenEndpoint(issuer: string): string {
    if (issuer.includes('microsoftonline.com')) return `${issuer}/oauth2/v2.0/token`;
    if (issuer.includes('.okta.com')) return `${issuer}/v1/token`;
    if (issuer.includes('accounts.google.com')) return 'https://oauth2.googleapis.com/token';
    return `${issuer}/token`;
  }

  private getJWKSUri(issuer: string): string {
    if (issuer.includes('microsoftonline.com')) {
      return `${issuer}/discovery/v2.0/keys`;
    }
    if (issuer.includes('.okta.com')) return `${issuer}/v1/keys`;
    if (issuer.includes('accounts.google.com')) {
      return 'https://www.googleapis.com/oauth2/v3/certs';
    }
    return `${issuer}/.well-known/jwks.json`;
  }

  // ── JWKS fetching with 1h cache ───────────────────────────────────────────

  private async fetchJWKS(uri: string): Promise<JWKSet> {
    const cached = this.jwksCache.get(uri);
    if (cached && Date.now() - cached.cachedAt < this.JWKS_TTL_MS) {
      return { keys: cached.keys };
    }

    const raw = await this.httpGet(uri);
    const jwks = JSON.parse(raw) as JWKSet;
    this.jwksCache.set(uri, { keys: jwks.keys, cachedAt: Date.now() });
    return jwks;
  }

  /** Convert JWK to PEM for jsonwebtoken verification */
  private jwkToPem(jwk: JWK): string {
    // Use x5c (certificate chain) if available — most IdPs provide this
    if (jwk.x5c && jwk.x5c.length > 0) {
      const cert = jwk.x5c[0];
      return [
        '-----BEGIN CERTIFICATE-----',
        ...((cert.match(/.{1,64}/g)) ?? [cert]),
        '-----END CERTIFICATE-----',
      ].join('\n');
    }
    // RSA public key from n + e
    if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
      // Minimal RSA PEM construction for jsonwebtoken
      // For production: use 'jwk-to-pem' package (passport-saml milestone)
      return this.rsaJwkToPem(jwk.n, jwk.e);
    }
    throw new UnauthorizedException('Cannot construct PEM from JWK — unsupported key format');
  }

  /**
   * Minimal RSA public key PEM from JWK n/e components.
   * Pure Node.js crypto — no external packages.
   */
  private rsaJwkToPem(n: string, e: string): string {
    const modulus = Buffer.from(n, 'base64url');
    const exponent = Buffer.from(e, 'base64url');

    // ASN.1 DER encoding of RSAPublicKey ::= SEQUENCE { modulus INTEGER, exponent INTEGER }
    const encodeLength = (len: number): Buffer => {
      if (len < 128) return Buffer.from([len]);
      if (len < 256) return Buffer.from([0x81, len]);
      return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
    };

    const encodeInteger = (buf: Buffer): Buffer => {
      // Add 0x00 prefix if high bit set (to keep it positive)
      const prefixed = buf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
      return Buffer.concat([Buffer.from([0x02]), encodeLength(prefixed.length), prefixed]);
    };

    const rsaSeq = Buffer.concat([encodeInteger(modulus), encodeInteger(exponent)]);
    const rsaSeqWithHeader = Buffer.concat([Buffer.from([0x30]), encodeLength(rsaSeq.length), rsaSeq]);

    // SubjectPublicKeyInfo wrapping (algorithm: rsaEncryption OID)
    const algorithmId = Buffer.from('300d06092a864886f70d0101010500', 'hex');
    const bitString = Buffer.concat([Buffer.from([0x03]), encodeLength(rsaSeqWithHeader.length + 1), Buffer.from([0x00]), rsaSeqWithHeader]);
    const spki = Buffer.concat([Buffer.from([0x30]), encodeLength(algorithmId.length + bitString.length), algorithmId, bitString]);

    const b64 = spki.toString('base64').match(/.{1,64}/g) ?? [];
    return ['-----BEGIN PUBLIC KEY-----', ...b64, '-----END PUBLIC KEY-----'].join('\n');
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https_native.get(url, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => resolve(body));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private httpPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      };
      const req = https_native.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
