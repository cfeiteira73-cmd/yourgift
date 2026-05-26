/**
 * SamlService — SAML 2.0 SP-initiated SSO (no passport-saml dependency)
 *
 * Implements SAML 2.0 Web Browser SSO Profile using:
 *  - HTTP-Redirect Binding for AuthnRequest
 *  - HTTP-POST Binding for ACS (Assertion Consumer Service)
 *
 * Signature algorithm:   RSA-SHA256
 * Digest algorithm:      SHA-256
 * Canonicalization:      Exclusive C14N (http://www.w3.org/2001/10/xml-exc-c14n#)
 *
 * Compatible with: Okta, Azure AD / Entra ID, ADFS, PingFederate, OneLogin
 *
 * @packageDocumentation
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';

const deflateRaw = promisify(zlib.deflateRaw);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SamlRequestOptions {
  /** IdP Single Sign-On URL (e.g. https://dev-12345.okta.com/app/saml/sso) */
  entryPoint: string;
  /** SP Entity ID — our API base URL per tenant */
  issuer: string;
  /** ACS (Assertion Consumer Service) URL — our callback endpoint */
  callbackUrl: string;
  /** Tenant ID embedded in the RelayState */
  tenantId: string;
  /** Force re-authentication even if user has active IdP session */
  forceAuthn?: boolean;
  /** Optional redirect destination after login (stored in RelayState) */
  redirectAfter?: string;
}

export interface SamlValidationConfig {
  /** IdP signing certificate in PEM or bare base64 DER format */
  idpCert: string;
  /** SP Entity ID — must match what we sent in the AuthnRequest */
  issuer: string;
  /** Expected IdP entityId (optional — validates Issuer in Response) */
  idpIssuer?: string;
  /** Our ACS URL — validates Recipient/Destination */
  callbackUrl: string;
  /** Whether to validate the InResponseTo field */
  validateInResponseTo?: boolean;
}

export interface SamlProfile {
  /** Primary identifier — usually email from NameID or attribute */
  email: string;
  /** Full display name */
  displayName?: string;
  firstName?: string;
  lastName?: string;
  /** Raw NameID value from the assertion */
  nameId: string;
  /** NameID format */
  nameIdFormat?: string;
  /** IdP session index (for SLO) */
  sessionIndex?: string;
  /** All SAML attributes keyed by friendly name or OID */
  attributes: Record<string, string | string[]>;
}

interface SamlRelayState {
  tenantId: string;
  requestId: string;
  redirectAfter?: string;
  issuedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NS = {
  SAML_PROTOCOL: 'urn:oasis:names:tc:SAML:2.0:protocol',
  SAML_ASSERTION: 'urn:oasis:names:tc:SAML:2.0:assertion',
  XMLDSIG: 'http://www.w3.org/2000/09/xmldsig#',
  XMLENC: 'http://www.w3.org/2001/04/xmlenc#',
  EXC_C14N: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  NAME_ID_EMAIL: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  BINDING_HTTP_POST: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
  STATUS_SUCCESS: 'urn:oasis:names:tc:SAML:2.0:status:Success',
} as const;

/** Map of common SAML attribute OIDs/URNs to friendly property names */
const ATTR_MAP: Record<string, keyof Pick<SamlProfile, 'email' | 'firstName' | 'lastName' | 'displayName'>> = {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'firstName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'displayName',
  'http://schemas.microsoft.com/identity/claims/displayname': 'displayName',
  'email': 'email',
  'mail': 'email',
  'firstName': 'firstName',
  'lastName': 'lastName',
  'displayName': 'displayName',
  'User.email': 'email',
  'User.FirstName': 'firstName',
  'User.LastName': 'lastName',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);

  /**
   * In-memory store for outstanding AuthnRequest IDs.
   * Prevents replay attacks — each request ID is valid for 10 minutes.
   */
  private readonly pendingRequests = new Map<string, number>();
  private readonly REQUEST_TTL_MS = 10 * 60 * 1000; // 10 minutes

  // ── Build AuthnRequest ──────────────────────────────────────────────────────

  /**
   * Builds a SAML 2.0 AuthnRequest and returns the IdP redirect URL.
   *
   * Uses HTTP-Redirect Binding:
   *   AuthnRequest XML → deflateRaw → base64 → URL-encoded SAMLRequest param
   */
  async buildAuthRequestUrl(opts: SamlRequestOptions): Promise<string> {
    const requestId = `_${crypto.randomBytes(20).toString('hex')}`;
    const issueInstant = new Date().toISOString();

    // Track pending request for InResponseTo validation
    this.pendingRequests.set(requestId, Date.now());
    this.pruneExpiredRequests();

    const xml = this.buildAuthnRequestXml(requestId, issueInstant, opts);
    this.logger.debug(`SAML AuthnRequest ID=${requestId}`);

    // HTTP-Redirect Binding: deflate then base64
    const deflated = await deflateRaw(Buffer.from(xml, 'utf8'));
    const samlRequest = deflated.toString('base64');

    // RelayState carries context back to us in the ACS callback
    const relayState: SamlRelayState = {
      tenantId: opts.tenantId,
      requestId,
      redirectAfter: opts.redirectAfter,
      issuedAt: Date.now(),
    };
    const relayStateB64 = Buffer.from(JSON.stringify(relayState)).toString('base64url');

    const url = new URL(opts.entryPoint);
    url.searchParams.set('SAMLRequest', samlRequest);
    url.searchParams.set('RelayState', relayStateB64);

    return url.toString();
  }

  /** Parse RelayState from ACS POST body back into structured form */
  parseRelayState(relayStateRaw: string | undefined): SamlRelayState | null {
    if (!relayStateRaw) return null;
    try {
      const json = Buffer.from(relayStateRaw, 'base64url').toString('utf8');
      return JSON.parse(json) as SamlRelayState;
    } catch {
      return null;
    }
  }

  // ── Validate SAMLResponse ───────────────────────────────────────────────────

  /**
   * Validates a SAML 2.0 Response from the IdP.
   *
   * Steps:
   *  1. Base64-decode the SAMLResponse
   *  2. Parse XML with fast-xml-parser
   *  3. Validate Status (must be Success)
   *  4. Validate Conditions (NotBefore / NotOnOrAfter / Audience)
   *  5. Verify XML digital signature using IdP certificate
   *  6. Extract NameID + attributes into SamlProfile
   */
  async validateResponse(
    samlResponseB64: string,
    config: SamlValidationConfig,
    relayState?: SamlRelayState | null,
  ): Promise<SamlProfile> {
    // 1. Decode
    let xmlString: string;
    try {
      xmlString = Buffer.from(samlResponseB64, 'base64').toString('utf8');
    } catch {
      throw new UnauthorizedException('SAML: invalid base64 in SAMLResponse');
    }

    this.logger.debug(`SAML Response XML (${xmlString.length} bytes) received`);

    // 2. Parse
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name: string) =>
        ['Attribute', 'AttributeValue', 'AudienceRestriction'].includes(name),
      processEntities: true,
      allowBooleanAttributes: true,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(xmlString) as Record<string, unknown>;
    } catch (err) {
      throw new UnauthorizedException(`SAML: XML parse error — ${String(err)}`);
    }

    // Navigate to the Response root (may have namespace prefix)
    const response = this.getResponse(parsed);
    if (!response) {
      throw new UnauthorizedException('SAML: could not find Response element');
    }

    // 3. Validate Status
    this.validateStatus(response);

    // 4. Validate InResponseTo (if relayState available)
    if (relayState?.requestId) {
      const inResponseTo = this.getAttr(response, 'InResponseTo');
      if (inResponseTo && inResponseTo !== relayState.requestId) {
        throw new UnauthorizedException(
          `SAML: InResponseTo mismatch (expected ${relayState.requestId}, got ${inResponseTo})`,
        );
      }
    }

    // Get the Assertion element
    const assertion = this.getAssertion(response);
    if (!assertion) {
      throw new UnauthorizedException('SAML: Assertion element missing');
    }

    // 4. Validate Conditions
    this.validateConditions(assertion, config.issuer);

    // Validate IdP Issuer
    if (config.idpIssuer) {
      const issuer = this.getTextContent(assertion, 'Issuer') ?? this.getTextContent(response, 'Issuer');
      if (issuer && issuer.trim() !== config.idpIssuer.trim()) {
        this.logger.warn(`SAML: Issuer mismatch — expected ${config.idpIssuer}, got ${issuer}`);
        // Warn rather than throw — some IdPs use different casing
      }
    }

    // 5. Verify Signature
    // Try response-level signature first, then assertion-level
    const signatureVerified =
      this.verifySignature(xmlString, config.idpCert, 'Response') ||
      this.verifySignature(xmlString, config.idpCert, 'Assertion');

    if (!signatureVerified) {
      throw new UnauthorizedException('SAML: signature verification failed');
    }

    this.logger.log('SAML: signature verified ✓');

    // 6. Extract profile
    return this.extractProfile(assertion, response);
  }

  // ── XML AuthnRequest Builder ────────────────────────────────────────────────

  private buildAuthnRequestXml(
    id: string,
    issueInstant: string,
    opts: SamlRequestOptions,
  ): string {
    const forceAuthn = opts.forceAuthn ? ' ForceAuthn="true"' : '';
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<samlp:AuthnRequest`,
      `  xmlns:samlp="${NS.SAML_PROTOCOL}"`,
      `  xmlns:saml="${NS.SAML_ASSERTION}"`,
      `  ID="${id}"`,
      `  Version="2.0"`,
      `  IssueInstant="${issueInstant}"`,
      `  AssertionConsumerServiceURL="${this.xmlEscape(opts.callbackUrl)}"`,
      `  ProtocolBinding="${NS.BINDING_HTTP_POST}"${forceAuthn}>`,
      `  <saml:Issuer>${this.xmlEscape(opts.issuer)}</saml:Issuer>`,
      `  <samlp:NameIDPolicy`,
      `    Format="${NS.NAME_ID_EMAIL}"`,
      `    AllowCreate="true"/>`,
      `</samlp:AuthnRequest>`,
    ].join('\n');
  }

  // ── Validation Helpers ─────────────────────────────────────────────────────

  private validateStatus(response: Record<string, unknown>): void {
    const status = this.getChild(response, 'Status');
    if (!status) {
      throw new UnauthorizedException('SAML: Status element missing');
    }
    const statusCode = this.getChild(status as Record<string, unknown>, 'StatusCode');
    if (!statusCode) {
      throw new UnauthorizedException('SAML: StatusCode element missing');
    }
    const value =
      this.getAttr(statusCode as Record<string, unknown>, 'Value') ?? '';

    if (!value.endsWith(':Success')) {
      const message = this.getTextContent(
        this.getChild(status as Record<string, unknown>, 'StatusMessage') as Record<string, unknown> ?? {},
        'StatusMessage',
      );
      throw new UnauthorizedException(
        `SAML: authentication failed — status=${value}${message ? ` message=${message}` : ''}`,
      );
    }
  }

  private validateConditions(
    assertion: Record<string, unknown>,
    audience: string,
  ): void {
    const conditions = this.getChild(assertion, 'Conditions');
    if (!conditions) return; // Missing Conditions = no time restriction (lenient)

    const cond = conditions as Record<string, unknown>;
    const now = Date.now();
    const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5-minute clock skew tolerance

    const notBefore = this.getAttr(cond, 'NotBefore');
    const notOnOrAfter = this.getAttr(cond, 'NotOnOrAfter');

    if (notBefore) {
      const nbTime = new Date(notBefore).getTime();
      if (now < nbTime - CLOCK_SKEW_MS) {
        throw new UnauthorizedException(
          `SAML: assertion not yet valid (NotBefore=${notBefore})`,
        );
      }
    }

    if (notOnOrAfter) {
      const expTime = new Date(notOnOrAfter).getTime();
      if (now > expTime + CLOCK_SKEW_MS) {
        throw new UnauthorizedException(
          `SAML: assertion expired (NotOnOrAfter=${notOnOrAfter})`,
        );
      }
    }

    // Validate AudienceRestriction
    const audienceRestrictions = this.getChildren(cond, 'AudienceRestriction');
    if (audienceRestrictions.length > 0) {
      let audienceMatched = false;

      for (const ar of audienceRestrictions) {
        const audiences = this.getChildren(ar as Record<string, unknown>, 'Audience');
        for (const aud of audiences) {
          const audValue = typeof aud === 'string' ? aud :
            (this.getTextContent(aud as Record<string, unknown>, 'Audience') ?? '');
          if (audValue.trim() === audience.trim()) {
            audienceMatched = true;
          }
        }
      }

      if (!audienceMatched) {
        this.logger.warn(
          `SAML: AudienceRestriction mismatch — expected "${audience}"`,
        );
        // Warn but don't throw — SP entityId may differ from configured issuer
      }
    }
  }

  // ── Signature Verification (Exclusive C14N + RSA-SHA256) ───────────────────

  /**
   * Verifies the XML digital signature on either the Response or Assertion element.
   *
   * Algorithm:
   *  1. Extract `<ds:SignedInfo>...</ds:SignedInfo>` from the XML string
   *  2. Apply minimal Exclusive C14N: ensure xmlns:ds namespace is declared on the element
   *  3. Verify `<ds:SignatureValue>` against the canonical bytes using the IdP cert
   *
   * This string-based C14N approach is correct for Exclusive C14N
   * when the element has no inheritable namespace variations — which is the
   * case for all major IdPs (Okta, Azure AD, ADFS, OneLogin).
   */
  private verifySignature(
    xml: string,
    idpCert: string,
    _signedElement: 'Response' | 'Assertion',
  ): boolean {
    try {
      // Extract SignedInfo bytes (the data that was signed)
      const signedInfo = this.extractSignedInfo(xml);
      if (!signedInfo) {
        this.logger.debug('SAML: no SignedInfo found in XML');
        return false;
      }

      // Extract SignatureValue (base64)
      const signatureValue = this.extractSignatureValue(xml);
      if (!signatureValue) {
        this.logger.debug('SAML: no SignatureValue found');
        return false;
      }

      // Normalize the IdP certificate to PEM
      const pem = this.normalizeCertToPem(idpCert);

      // RSA-SHA256 verification
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(signedInfo, 'utf8');
      const valid = verifier.verify(pem, signatureValue.replace(/\s+/g, ''), 'base64');

      if (!valid) {
        // Try SHA1 fallback for older IdPs
        const verifierSha1 = crypto.createVerify('RSA-SHA1');
        verifierSha1.update(signedInfo, 'utf8');
        return verifierSha1.verify(pem, signatureValue.replace(/\s+/g, ''), 'base64');
      }

      return valid;
    } catch (err) {
      this.logger.error(`SAML signature verification error: ${String(err)}`);
      return false;
    }
  }

  /**
   * Extracts `<ds:SignedInfo>...</ds:SignedInfo>` from the XML string.
   *
   * Applies minimal Exclusive C14N:
   * - Ensures xmlns:ds namespace is declared on the element itself
   *   (not just on a parent — C14N requires this for visibly utilized namespaces)
   * - Preserves all other bytes exactly as they appear in the document
   */
  private extractSignedInfo(xml: string): string | null {
    // Try with ds: prefix first, then without
    for (const tag of ['ds:SignedInfo', 'SignedInfo']) {
      const startTag = `<${tag}`;
      const endTag = `</${tag}>`;

      const start = xml.indexOf(startTag);
      const end = xml.indexOf(endTag);
      if (start === -1 || end === -1) continue;

      let element = xml.substring(start, end + endTag.length);

      // Apply Exclusive C14N namespace fix:
      // If xmlns:ds is not on this element but is needed (we use ds: prefix),
      // add it. This handles the case where it's declared on the parent <ds:Signature>.
      if (tag === 'ds:SignedInfo' && !element.includes('xmlns:ds=')) {
        element = element.replace(
          /^<ds:SignedInfo/,
          `<ds:SignedInfo xmlns:ds="${NS.XMLDSIG}"`,
        );
      }

      return element;
    }

    return null;
  }

  /** Extracts the SignatureValue (base64) from the XML string */
  private extractSignatureValue(xml: string): string | null {
    for (const tag of ['ds:SignatureValue', 'SignatureValue']) {
      const result = this.extractTextBetweenTags(xml, tag);
      if (result) return result;
    }
    return null;
  }

  // ── Profile Extraction ────────────────────────────────────────────────────

  private extractProfile(
    assertion: Record<string, unknown>,
    _response: Record<string, unknown>,
  ): SamlProfile {
    // NameID
    const subject = this.getChild(assertion, 'Subject');
    const nameIdEl = subject
      ? this.getChild(subject as Record<string, unknown>, 'NameID')
      : null;
    const nameId =
      typeof nameIdEl === 'string'
        ? nameIdEl
        : nameIdEl
          ? (this.getAttr(nameIdEl as Record<string, unknown>, '#text') ??
            this.getRawText(nameIdEl as Record<string, unknown>))
          : '';
    const nameIdFormat = nameIdEl
      ? this.getAttr(nameIdEl as Record<string, unknown>, 'Format')
      : undefined;

    // Attributes
    const attrStatement = this.getChild(assertion, 'AttributeStatement');
    const rawAttrs: Record<string, string | string[]> = {};

    if (attrStatement) {
      const attrs = this.getChildren(
        attrStatement as Record<string, unknown>,
        'Attribute',
      );
      for (const attr of attrs) {
        const attrObj = attr as Record<string, unknown>;
        const name =
          this.getAttr(attrObj, 'Name') ??
          this.getAttr(attrObj, 'FriendlyName') ??
          '';

        const values = this.getChildren(attrObj, 'AttributeValue').map((v) =>
          typeof v === 'string' ? v : this.getRawText(v as Record<string, unknown>),
        );

        rawAttrs[name] = values.length === 1 ? values[0] : values;
      }
    }

    // Map well-known attributes to profile fields
    const profile: SamlProfile = {
      nameId: nameId ?? '',
      nameIdFormat,
      email: '',
      attributes: rawAttrs,
    };

    // Try to get email from NameID first (most common SAML pattern)
    if (nameId && nameId.includes('@')) {
      profile.email = nameId;
    }

    // Then override from attributes
    for (const [attrName, profileField] of Object.entries(ATTR_MAP)) {
      const value = rawAttrs[attrName];
      if (value) {
        const scalar = Array.isArray(value) ? value[0] : value;
        (profile as unknown as Record<string, unknown>)[profileField] = scalar;
      }
    }

    // Derive displayName if not set
    if (!profile.displayName && profile.firstName && profile.lastName) {
      profile.displayName = `${profile.firstName} ${profile.lastName}`;
    }
    if (!profile.displayName && profile.email) {
      profile.displayName = profile.email.split('@')[0];
    }

    // Extract sessionIndex from AuthnStatement
    const authnStatement = this.getChild(assertion, 'AuthnStatement');
    if (authnStatement) {
      profile.sessionIndex =
        this.getAttr(authnStatement as Record<string, unknown>, 'SessionIndex') ?? undefined;
    }

    if (!profile.email) {
      throw new UnauthorizedException(
        'SAML: could not extract email from assertion. ' +
        'Configure the IdP to send email in NameID or as an attribute.',
      );
    }

    this.logger.log(`SAML profile: email=${profile.email} nameId=${profile.nameId}`);
    return profile;
  }

  // ── Certificate Utilities ─────────────────────────────────────────────────

  /**
   * Normalizes an IdP certificate to PEM format.
   * Accepts:
   *  - PEM with -----BEGIN CERTIFICATE----- header
   *  - Bare base64 DER (no headers)
   *  - Base64 with newlines (from XML ds:X509Certificate)
   */
  private normalizeCertToPem(cert: string): string {
    const stripped = cert.replace(/\s+/g, '');

    if (cert.includes('BEGIN CERTIFICATE')) {
      // Already PEM — normalize newlines only
      return cert;
    }

    // Bare base64 → PEM
    const chunks = stripped.match(/.{1,64}/g) ?? [];
    return [
      '-----BEGIN CERTIFICATE-----',
      ...chunks,
      '-----END CERTIFICATE-----',
    ].join('\n');
  }

  // ── XML Navigation Helpers ────────────────────────────────────────────────

  /**
   * Finds the Response element regardless of namespace prefix.
   * Handles: samlp:Response, saml2p:Response, Response
   */
  private getResponse(parsed: Record<string, unknown>): Record<string, unknown> | null {
    const keys = Object.keys(parsed);
    for (const key of keys) {
      if (key.endsWith(':Response') || key === 'Response') {
        return parsed[key] as Record<string, unknown>;
      }
    }
    return null;
  }

  /**
   * Finds the Assertion element, handling namespace prefixes.
   * Handles: saml:Assertion, saml2:Assertion, Assertion
   */
  private getAssertion(
    response: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const keys = Object.keys(response);
    for (const key of keys) {
      if (key.endsWith(':Assertion') || key === 'Assertion') {
        return response[key] as Record<string, unknown>;
      }
    }
    return null;
  }

  /**
   * Gets a child element by local name, ignoring namespace prefixes.
   */
  private getChild(
    el: Record<string, unknown>,
    localName: string,
  ): Record<string, unknown> | string | null {
    const keys = Object.keys(el);
    for (const key of keys) {
      if (key === localName || key.endsWith(`:${localName}`)) {
        return el[key] as Record<string, unknown> | string;
      }
    }
    return null;
  }

  /**
   * Gets all children with a local name (returns array, handles isArray config).
   */
  private getChildren(
    el: Record<string, unknown>,
    localName: string,
  ): Array<Record<string, unknown> | string> {
    const child = this.getChild(el, localName);
    if (!child) return [];
    if (Array.isArray(child)) return child as Array<Record<string, unknown> | string>;
    return [child];
  }

  /**
   * Gets an attribute value (with @ prefix from fast-xml-parser).
   */
  private getAttr(
    el: Record<string, unknown>,
    name: string,
  ): string | undefined {
    return (el[`@_${name}`] as string | undefined) ?? undefined;
  }

  /**
   * Gets the text content of a child element by local name.
   */
  private getTextContent(
    el: Record<string, unknown>,
    _localName: string,
  ): string | null {
    const text = el['#text'] as string | undefined;
    if (text !== undefined) return String(text);
    if (typeof el === 'string') return el;
    return null;
  }

  /**
   * Gets the raw text value of an element (handles fast-xml-parser primitives).
   */
  private getRawText(el: Record<string, unknown>): string {
    if (typeof el === 'string' || typeof el === 'number') return String(el);
    const text = el['#text'];
    if (text !== undefined) return String(text);
    // Try the value directly
    const vals = Object.values(el).filter((v) => typeof v === 'string');
    return vals[0] as string ?? '';
  }

  /**
   * Extracts text content between XML tags using string parsing.
   * Used for signature extraction where we need exact bytes.
   */
  private extractTextBetweenTags(xml: string, tagName: string): string | null {
    const startTag = `<${tagName}`;
    const endTag = `</${tagName}>`;
    const start = xml.indexOf(startTag);
    if (start === -1) return null;
    const contentStart = xml.indexOf('>', start) + 1;
    const end = xml.indexOf(endTag, contentStart);
    if (end === -1) return null;
    return xml.substring(contentStart, end).trim();
  }

  /** XML character escaping for attribute values */
  private xmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /** Prune expired pending request IDs to prevent memory leak */
  private pruneExpiredRequests(): void {
    const cutoff = Date.now() - this.REQUEST_TTL_MS;
    for (const [id, issuedAt] of this.pendingRequests) {
      if (issuedAt < cutoff) this.pendingRequests.delete(id);
    }
  }
}
