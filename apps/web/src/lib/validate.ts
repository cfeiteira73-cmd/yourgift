/**
 * Lightweight schema validation utility (no external dependencies).
 * Replace with Zod when `npm install zod` is run (P1 priority).
 *
 * Usage:
 *   const result = validate(body, {
 *     action:    { type: 'string', required: true, enum: ['create', 'update'] },
 *     amount:    { type: 'number', required: true, min: 0, max: 999999 },
 *     order_id:  { type: 'string', required: false, uuid: true },
 *   });
 *   if (!result.ok) return NextResponse.json({ error: result.errors }, { status: 400 });
 */

type FieldSchema =
  | { type: 'string'; required?: boolean; enum?: string[]; uuid?: boolean; maxLength?: number; minLength?: number }
  | { type: 'number'; required?: boolean; min?: number; max?: number }
  | { type: 'boolean'; required?: boolean }
  | { type: 'array'; required?: boolean; maxItems?: number }
  | { type: 'object'; required?: boolean };

type Schema = Record<string, FieldSchema>;

interface ValidateResult {
  ok: boolean;
  errors: Record<string, string>;
  data: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validate(input: unknown, schema: Schema): ValidateResult {
  const errors: Record<string, string> = {};
  const data: Record<string, unknown> = {};

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _root: 'Body must be a JSON object' }, data: {} };
  }

  const body = input as Record<string, unknown>;

  for (const [key, rule] of Object.entries(schema)) {
    const val = body[key];
    const missing = val === undefined || val === null || val === '';

    if (missing) {
      if (rule.required) {
        errors[key] = `${key} is required`;
      }
      continue;
    }

    if (rule.type === 'string') {
      if (typeof val !== 'string') { errors[key] = `${key} must be a string`; continue; }
      if (rule.enum && !rule.enum.includes(val)) {
        errors[key] = `${key} must be one of: ${rule.enum.join(', ')}`;
        continue;
      }
      if (rule.uuid && !UUID_RE.test(val)) { errors[key] = `${key} must be a valid UUID`; continue; }
      if (rule.maxLength && val.length > rule.maxLength) { errors[key] = `${key} exceeds max length ${rule.maxLength}`; continue; }
      if (rule.minLength && val.length < rule.minLength) { errors[key] = `${key} is too short (min ${rule.minLength})`; continue; }
      data[key] = val;
    } else if (rule.type === 'number') {
      const n = typeof val === 'number' ? val : Number(val);
      if (!isFinite(n)) { errors[key] = `${key} must be a finite number`; continue; }
      if (rule.min !== undefined && n < rule.min) { errors[key] = `${key} must be ≥ ${rule.min}`; continue; }
      if (rule.max !== undefined && n > rule.max) { errors[key] = `${key} must be ≤ ${rule.max}`; continue; }
      data[key] = n;
    } else if (rule.type === 'boolean') {
      if (typeof val !== 'boolean') { errors[key] = `${key} must be boolean`; continue; }
      data[key] = val;
    } else if (rule.type === 'array') {
      if (!Array.isArray(val)) { errors[key] = `${key} must be an array`; continue; }
      if (rule.maxItems && val.length > rule.maxItems) { errors[key] = `${key} exceeds max items ${rule.maxItems}`; continue; }
      data[key] = val;
    } else if (rule.type === 'object') {
      if (typeof val !== 'object' || Array.isArray(val)) { errors[key] = `${key} must be an object`; continue; }
      data[key] = val;
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data,
  };
}

/** Quick guard: parse request body and return 400 if validation fails. */
export async function parseAndValidate(
  request: Request,
  schema: Schema,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const result = validate(body, schema);
  if (!result.ok) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Validation failed', details: result.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { ok: true, data: result.data };
}
