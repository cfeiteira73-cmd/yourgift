// PII field registry — maps model.field to PII classification level
// Used for GDPR compliance, data masking, and audit

export type PiiLevel = 'DIRECT_IDENTIFIER' | 'QUASI_IDENTIFIER' | 'SENSITIVE' | 'NONE';

export interface PiiFieldDefinition {
  model: string;
  field: string;
  level: PiiLevel;
  description: string;
  retentionDays?: number; // undefined = retain indefinitely
  maskingStrategy: 'redact' | 'hash' | 'partial' | 'none';
}

export const PII_REGISTRY: PiiFieldDefinition[] = [
  // Client model
  { model: 'Client', field: 'email', level: 'DIRECT_IDENTIFIER', description: 'Client email address', retentionDays: 2555, maskingStrategy: 'partial' },
  { model: 'Client', field: 'name', level: 'DIRECT_IDENTIFIER', description: 'Client full name', retentionDays: 2555, maskingStrategy: 'partial' },
  { model: 'Client', field: 'phone', level: 'DIRECT_IDENTIFIER', description: 'Client phone number', retentionDays: 2555, maskingStrategy: 'partial' },
  // Order model
  { model: 'Order', field: 'shippingAddress', level: 'DIRECT_IDENTIFIER', description: 'Delivery address', retentionDays: 2555, maskingStrategy: 'redact' },
  // AuthAuditLog
  { model: 'AuthAuditLog', field: 'ipAddress', level: 'QUASI_IDENTIFIER', description: 'IP address for auth audit', retentionDays: 365, maskingStrategy: 'partial' },
  { model: 'AuthAuditLog', field: 'userAgent', level: 'QUASI_IDENTIFIER', description: 'User agent string', retentionDays: 365, maskingStrategy: 'redact' },
  // AuthAttempt
  { model: 'AuthAttempt', field: 'email', level: 'DIRECT_IDENTIFIER', description: 'Email used in auth attempt', retentionDays: 90, maskingStrategy: 'hash' },
  { model: 'AuthAttempt', field: 'ipAddress', level: 'QUASI_IDENTIFIER', description: 'IP of auth attempt', retentionDays: 90, maskingStrategy: 'partial' },
  // DeviceSession
  { model: 'DeviceSession', field: 'userAgent', level: 'QUASI_IDENTIFIER', description: 'Device user agent', retentionDays: 365, maskingStrategy: 'redact' },
  { model: 'DeviceSession', field: 'ipAddress', level: 'QUASI_IDENTIFIER', description: 'Device IP', retentionDays: 365, maskingStrategy: 'partial' },
  // Company
  { model: 'Company', field: 'taxId', level: 'SENSITIVE', description: 'Company VAT/tax ID', retentionDays: 3650, maskingStrategy: 'partial' },
  // GdprRequest
  { model: 'GdprRequest', field: 'requestorEmail', level: 'DIRECT_IDENTIFIER', description: 'Email of GDPR requestor', retentionDays: 1825, maskingStrategy: 'none' },
];

export function getPiiFields(model: string): PiiFieldDefinition[] {
  return PII_REGISTRY.filter(p => p.model === model);
}

export function isPiiField(model: string, field: string): boolean {
  return PII_REGISTRY.some(p => p.model === model && p.field === field);
}

export function maskValue(value: string, strategy: PiiFieldDefinition['maskingStrategy']): string {
  if (!value) return value;
  switch (strategy) {
    case 'redact': return '[REDACTED]';
    case 'hash': {
      // Simple deterministic hash for logging (not crypto-strength)
      let h = 0;
      for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
      return `[HASH:${Math.abs(h).toString(16).padStart(8, '0')}]`;
    }
    case 'partial': {
      if (value.includes('@')) {
        // Email: show first char + domain
        const [local, domain] = value.split('@');
        return `${(local ?? '').charAt(0)}***@${domain ?? ''}`;
      }
      // Other strings: show first 2 + last 2
      if (value.length <= 4) return '****';
      return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
    }
    case 'none': return value;
  }
}
