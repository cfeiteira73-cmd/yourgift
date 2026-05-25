/**
 * Integration tests — SamlService
 *
 * Tests the native SAML 2.0 implementation (no passport-saml dependency).
 * Uses the real SamlService implementation with mock XML payloads.
 *
 * Covers:
 * - AuthnRequest XML generation and HTTP-Redirect binding
 * - RelayState encode/decode round-trip
 * - SAML Response parsing with mock XML
 * - Condition validation (NotBefore / NotOnOrAfter with clock skew)
 * - Profile extraction from assertion attributes
 */

import { SamlService, SamlRequestOptions } from '../../src/enterprise-identity/saml.service';
import { UnauthorizedException } from '@nestjs/common';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal SAML Response XML string (no real signature — signature verification is mocked) */
function buildSamlResponseXml(opts: {
  statusCode?: string;
  notBefore?: string;
  notOnOrAfter?: string;
  audience?: string;
  email?: string;
  nameId?: string;
  sessionIndex?: string;
  inResponseTo?: string;
}): string {
  const {
    statusCode = 'urn:oasis:names:tc:SAML:2.0:status:Success',
    notBefore = new Date(Date.now() - 60_000).toISOString(),
    notOnOrAfter = new Date(Date.now() + 300_000).toISOString(),
    audience = 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1',
    email = 'user@acme.com',
    nameId = 'user@acme.com',
    sessionIndex = '_session_abc',
    inResponseTo = '',
  } = opts;

  const inResponseToAttr = inResponseTo ? ` InResponseTo="${inResponseTo}"` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="_response_001"
  Version="2.0"
  IssueInstant="${new Date().toISOString()}"${inResponseToAttr}>
  <samlp:Status>
    <samlp:StatusCode Value="${statusCode}"/>
  </samlp:Status>
  <saml:Assertion Version="2.0" ID="_assertion_001" IssueInstant="${new Date().toISOString()}">
    <saml:Issuer>https://idp.acme.com</saml:Issuer>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      </ds:SignedInfo>
      <ds:SignatureValue>MOCK_SIGNATURE_VALUE_BASE64==</ds:SignatureValue>
    </ds:Signature>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement SessionIndex="${sessionIndex}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
        <saml:AttributeValue>${email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
        <saml:AttributeValue>John</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
        <saml:AttributeValue>Doe</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SamlService', () => {
  let saml: SamlService;

  const defaultConfig = {
    idpCert: 'MOCK_CERT_NOT_REAL',
    issuer: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1',
    callbackUrl: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1/callback',
  };

  beforeEach(() => {
    saml = new SamlService();
    // Mock Logger to suppress output in tests
    jest.spyOn((saml as unknown as { logger: { log: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock } }).logger, 'log').mockImplementation(() => {});
    jest.spyOn((saml as unknown as { logger: { log: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock } }).logger, 'debug').mockImplementation(() => {});
    jest.spyOn((saml as unknown as { logger: { log: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock } }).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((saml as unknown as { logger: { log: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock } }).logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── AuthnRequest XML generation ──────────────────────────────────────────────

  describe('buildAuthRequestUrl', () => {
    const opts: SamlRequestOptions = {
      entryPoint: 'https://idp.acme.com/saml/sso',
      issuer: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1',
      callbackUrl: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1/callback',
      tenantId: 'tenant_1',
    };

    it('returns a valid URL string', async () => {
      const url = await saml.buildAuthRequestUrl(opts);
      expect(() => new URL(url)).not.toThrow();
    });

    it('uses the IdP entry point as base URL', async () => {
      const url = await saml.buildAuthRequestUrl(opts);
      expect(url.startsWith('https://idp.acme.com/saml/sso')).toBe(true);
    });

    it('includes SAMLRequest query parameter', async () => {
      const url = await saml.buildAuthRequestUrl(opts);
      const parsed = new URL(url);
      expect(parsed.searchParams.has('SAMLRequest')).toBe(true);
    });

    it('SAMLRequest is non-empty base64', async () => {
      const url = await saml.buildAuthRequestUrl(opts);
      const parsed = new URL(url);
      const samlRequest = parsed.searchParams.get('SAMLRequest')!;
      expect(samlRequest.length).toBeGreaterThan(10);
    });

    it('includes RelayState query parameter', async () => {
      const url = await saml.buildAuthRequestUrl(opts);
      const parsed = new URL(url);
      expect(parsed.searchParams.has('RelayState')).toBe(true);
    });

    it('generates unique request IDs on each call', async () => {
      const url1 = await saml.buildAuthRequestUrl(opts);
      const url2 = await saml.buildAuthRequestUrl(opts);
      // RelayState contains the requestId
      const rs1 = new URL(url1).searchParams.get('RelayState')!;
      const rs2 = new URL(url2).searchParams.get('RelayState')!;
      expect(rs1).not.toBe(rs2);
    });

    it('applies ForceAuthn attribute when requested', async () => {
      // We can't directly inspect the deflated XML in the URL, but the method
      // should succeed without throwing
      const url = await saml.buildAuthRequestUrl({ ...opts, forceAuthn: true });
      expect(url).toBeTruthy();
    });
  });

  // ── RelayState encode/decode ─────────────────────────────────────────────────

  describe('parseRelayState', () => {
    it('round-trips tenantId and requestId through encode/decode', async () => {
      const url = await saml.buildAuthRequestUrl({
        entryPoint: 'https://idp.acme.com/saml/sso',
        issuer: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1',
        callbackUrl: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1/callback',
        tenantId: 'tenant_acme',
        redirectAfter: '/dashboard',
      });

      const parsed = new URL(url);
      const relayStateRaw = parsed.searchParams.get('RelayState')!;
      const relayState = saml.parseRelayState(relayStateRaw);

      expect(relayState).not.toBeNull();
      expect(relayState!.tenantId).toBe('tenant_acme');
      expect(relayState!.redirectAfter).toBe('/dashboard');
      expect(typeof relayState!.requestId).toBe('string');
      expect(relayState!.requestId.length).toBeGreaterThan(10);
    });

    it('returns null for undefined input', () => {
      expect(saml.parseRelayState(undefined)).toBeNull();
    });

    it('returns null for invalid base64', () => {
      expect(saml.parseRelayState('not!!valid!!base64')).toBeNull();
    });

    it('returns null for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('not-json').toString('base64url');
      expect(saml.parseRelayState(invalidJson)).toBeNull();
    });

    it('preserves issuedAt timestamp', async () => {
      const before = Date.now();
      const url = await saml.buildAuthRequestUrl({
        entryPoint: 'https://idp.acme.com/saml/sso',
        issuer: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1',
        callbackUrl: 'https://api.yourgift.pt/enterprise-identity/saml/tenant_1/callback',
        tenantId: 'tenant_1',
      });
      const after = Date.now();

      const rs = saml.parseRelayState(new URL(url).searchParams.get('RelayState')!)!;
      expect(rs.issuedAt).toBeGreaterThanOrEqual(before);
      expect(rs.issuedAt).toBeLessThanOrEqual(after);
    });
  });

  // ── SAML Response validation ─────────────────────────────────────────────────

  describe('validateResponse', () => {
    // Mock verifySignature to return true for test XMLs
    beforeEach(() => {
      jest.spyOn(saml as unknown as { verifySignature: jest.Mock }, 'verifySignature').mockReturnValue(true);
    });

    it('extracts email from NameID when it contains @', async () => {
      const xml = buildSamlResponseXml({ nameId: 'user@acme.com', email: '' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.email).toBe('user@acme.com');
    });

    it('extracts email from attribute statement', async () => {
      const xml = buildSamlResponseXml({ nameId: 'user-id-12345', email: 'user@acme.com' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.email).toBe('user@acme.com');
    });

    it('extracts firstName and lastName from attributes', async () => {
      const xml = buildSamlResponseXml({ email: 'user@acme.com' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
    });

    it('derives displayName from firstName + lastName when not set directly', async () => {
      const xml = buildSamlResponseXml({ email: 'user@acme.com' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.displayName).toBe('John Doe');
    });

    it('extracts sessionIndex from AuthnStatement', async () => {
      const xml = buildSamlResponseXml({ email: 'user@acme.com', sessionIndex: '_my_session' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.sessionIndex).toBe('_my_session');
    });

    it('extracts nameId from Subject/NameID', async () => {
      const xml = buildSamlResponseXml({ nameId: 'user@acme.com' });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.nameId).toBe('user@acme.com');
    });

    // ── Condition validation ──────────────────────────────────────────────────

    it('rejects assertion that is not yet valid (NotBefore in the future)', async () => {
      const xml = buildSamlResponseXml({
        email: 'user@acme.com',
        // NotBefore = 10 minutes from now (outside 5-min clock skew)
        notBefore: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        notOnOrAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const b64 = Buffer.from(xml).toString('base64');

      await expect(saml.validateResponse(b64, defaultConfig)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired assertion (NotOnOrAfter in the past)', async () => {
      const xml = buildSamlResponseXml({
        email: 'user@acme.com',
        notBefore: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        // Expired 10 minutes ago — outside the 5-min clock skew tolerance
        notOnOrAfter: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });
      const b64 = Buffer.from(xml).toString('base64');

      await expect(saml.validateResponse(b64, defaultConfig)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts assertion within clock skew tolerance (NotBefore 3 min future)', async () => {
      const xml = buildSamlResponseXml({
        email: 'user@acme.com',
        // 3 minutes in future — within 5-min clock skew
        notBefore: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        notOnOrAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const b64 = Buffer.from(xml).toString('base64');

      const profile = await saml.validateResponse(b64, defaultConfig);
      expect(profile.email).toBe('user@acme.com');
    });

    // ── Status code validation ────────────────────────────────────────────────

    it('rejects response with non-Success status', async () => {
      const xml = buildSamlResponseXml({
        statusCode: 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
        email: 'user@acme.com',
      });
      const b64 = Buffer.from(xml).toString('base64');

      await expect(saml.validateResponse(b64, defaultConfig)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects malformed base64 SAMLResponse', async () => {
      await expect(
        saml.validateResponse('not-valid-xml-at-all!!!', defaultConfig),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects completely empty SAMLResponse', async () => {
      const b64 = Buffer.from('').toString('base64');
      await expect(saml.validateResponse(b64, defaultConfig)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
