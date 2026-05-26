import { Injectable, Logger } from '@nestjs/common';
import { PII_REGISTRY, maskValue, getPiiFields, PiiFieldDefinition } from './pii-registry';

@Injectable()
export class PiiService {
  private readonly logger = new Logger(PiiService.name);

  // Mask PII fields in a plain object for safe logging
  maskForLog<T extends Record<string, unknown>>(model: string, data: T): T {
    const fields = getPiiFields(model);
    if (fields.length === 0) return data;
    const result = { ...data };
    for (const def of fields) {
      if (typeof result[def.field] === 'string') {
        (result as Record<string, unknown>)[def.field] = maskValue(result[def.field] as string, def.maskingStrategy);
      }
    }
    return result;
  }

  // Get all PII fields for a model with their definitions
  getModelPiiFields(model: string): PiiFieldDefinition[] {
    return getPiiFields(model);
  }

  // Get full registry report (used by GDPR admin endpoint)
  getFullRegistry(): typeof PII_REGISTRY {
    return PII_REGISTRY;
  }

  // Check if a request to export data should include a field
  shouldIncludeInExport(model: string, field: string): boolean {
    const def = PII_REGISTRY.find(p => p.model === model && p.field === field);
    return def?.level !== 'NONE';
  }
}
