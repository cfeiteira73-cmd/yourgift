/**
 * Unit tests for lib/validate.ts
 *
 * Run with: npx tsx src/lib/__tests__/validate.test.ts
 * (No test framework dependency — pure assertion script)
 *
 * When Vitest/Jest is added to the web app, this file is already
 * compatible with the test() / expect() API used in those frameworks.
 */

import { validate } from '../validate';

// ── Minimal assertion engine (no deps) ───────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTrue() { if (actual !== true as unknown as T) throw new Error(`Expected true, got ${JSON.stringify(actual)}`); },
    toBeFalse() { if (actual !== false as unknown as T) throw new Error(`Expected false, got ${JSON.stringify(actual)}`); },
    toContain(key: string) {
      if (typeof actual !== 'object' || actual === null || !(key in (actual as object))) {
        throw new Error(`Expected object to contain key "${key}", got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      if ((actual as unknown as number) < n) throw new Error(`Expected >= ${n}, got ${actual}`);
    },
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

console.log('\nvalidate.ts — Unit Tests\n');

// ── String validation ─────────────────────────────────────────────────────────
console.log('String validation:');

test('accepts valid string', () => {
  const r = validate({ name: 'Carlos' }, { name: { type: 'string', required: true } });
  expect(r.ok).toBeTrue();
  expect(r.data.name).toBe('Carlos');
});

test('rejects missing required string', () => {
  const r = validate({}, { name: { type: 'string', required: true } });
  expect(r.ok).toBeFalse();
  expect(r.errors).toContain('name');
});

test('accepts optional missing string', () => {
  const r = validate({}, { name: { type: 'string', required: false } });
  expect(r.ok).toBeTrue();
});

test('rejects non-string value', () => {
  const r = validate({ name: 123 }, { name: { type: 'string', required: true } });
  expect(r.ok).toBeFalse();
});

test('rejects string not in enum', () => {
  const r = validate({ status: 'invalid' }, { status: { type: 'string', enum: ['active', 'inactive'] } });
  expect(r.ok).toBeFalse();
});

test('accepts valid enum value', () => {
  const r = validate({ status: 'active' }, { status: { type: 'string', enum: ['active', 'inactive'] } });
  expect(r.ok).toBeTrue();
});

test('rejects string exceeding maxLength', () => {
  const r = validate({ note: 'a'.repeat(201) }, { note: { type: 'string', maxLength: 200 } });
  expect(r.ok).toBeFalse();
});

test('accepts string within maxLength', () => {
  const r = validate({ note: 'a'.repeat(200) }, { note: { type: 'string', maxLength: 200 } });
  expect(r.ok).toBeTrue();
});

test('rejects string below minLength', () => {
  const r = validate({ code: 'ab' }, { code: { type: 'string', minLength: 3 } });
  expect(r.ok).toBeFalse();
});

test('rejects invalid UUID', () => {
  const r = validate({ id: 'not-a-uuid' }, { id: { type: 'string', uuid: true } });
  expect(r.ok).toBeFalse();
});

test('accepts valid UUID', () => {
  const r = validate(
    { id: '550e8400-e29b-41d4-a716-446655440000' },
    { id: { type: 'string', uuid: true } }
  );
  expect(r.ok).toBeTrue();
});

// ── Number validation ─────────────────────────────────────────────────────────
console.log('\nNumber validation:');

test('accepts valid number', () => {
  const r = validate({ amount: 99.99 }, { amount: { type: 'number', required: true } });
  expect(r.ok).toBeTrue();
  expect(r.data.amount).toBe(99.99);
});

test('rejects number below min', () => {
  const r = validate({ qty: -1 }, { qty: { type: 'number', min: 0 } });
  expect(r.ok).toBeFalse();
});

test('rejects number above max', () => {
  const r = validate({ qty: 1000001 }, { qty: { type: 'number', max: 1000000 } });
  expect(r.ok).toBeFalse();
});

test('accepts number at boundary', () => {
  const r = validate({ qty: 0 }, { qty: { type: 'number', min: 0, max: 100 } });
  expect(r.ok).toBeTrue();
});

test('coerces numeric string to number', () => {
  const r = validate({ qty: '42' }, { qty: { type: 'number' } });
  expect(r.ok).toBeTrue();
  expect(r.data.qty).toBe(42);
});

test('rejects NaN', () => {
  const r = validate({ qty: NaN }, { qty: { type: 'number', required: true } });
  expect(r.ok).toBeFalse();
});

// ── Boolean validation ────────────────────────────────────────────────────────
console.log('\nBoolean validation:');

test('accepts true', () => {
  const r = validate({ active: true }, { active: { type: 'boolean', required: true } });
  expect(r.ok).toBeTrue();
});

test('accepts false', () => {
  const r = validate({ active: false }, { active: { type: 'boolean', required: true } });
  // false is not "missing" — should pass
  expect(r.ok).toBeTrue();
});

test('rejects string as boolean', () => {
  const r = validate({ active: 'true' }, { active: { type: 'boolean' } });
  expect(r.ok).toBeFalse();
});

// ── Array validation ──────────────────────────────────────────────────────────
console.log('\nArray validation:');

test('accepts valid array', () => {
  const r = validate({ items: [1, 2, 3] }, { items: { type: 'array', required: true } });
  expect(r.ok).toBeTrue();
});

test('rejects non-array', () => {
  const r = validate({ items: 'not-array' }, { items: { type: 'array' } });
  expect(r.ok).toBeFalse();
});

test('rejects array exceeding maxItems', () => {
  const r = validate({ items: [1, 2, 3] }, { items: { type: 'array', maxItems: 2 } });
  expect(r.ok).toBeFalse();
});

// ── Object validation ─────────────────────────────────────────────────────────
console.log('\nObject validation:');

test('accepts valid object', () => {
  const r = validate({ meta: { key: 'value' } }, { meta: { type: 'object' } });
  expect(r.ok).toBeTrue();
});

test('rejects array as object', () => {
  const r = validate({ meta: [1, 2] }, { meta: { type: 'object' } });
  expect(r.ok).toBeFalse();
});

// ── Root-level edge cases ─────────────────────────────────────────────────────
console.log('\nEdge cases:');

test('rejects null body', () => {
  const r = validate(null, { name: { type: 'string', required: true } });
  expect(r.ok).toBeFalse();
  expect(r.errors).toContain('_root');
});

test('rejects array body', () => {
  const r = validate([], { name: { type: 'string', required: true } });
  expect(r.ok).toBeFalse();
});

test('rejects string body', () => {
  const r = validate('hello', { name: { type: 'string', required: true } });
  expect(r.ok).toBeFalse();
});

test('allows extra keys not in schema', () => {
  const r = validate({ name: 'Carlos', extra: 'ignored' }, { name: { type: 'string' } });
  expect(r.ok).toBeTrue();
  // Extra fields are not included in data
  expect(typeof (r.data.extra)).toBe('undefined');
});

test('multiple errors reported together', () => {
  const r = validate({}, {
    name: { type: 'string', required: true },
    amount: { type: 'number', required: true },
  });
  expect(r.ok).toBeFalse();
  expect(r.errors).toContain('name');
  expect(r.errors).toContain('amount');
});

// ── Financial integrity invariants ────────────────────────────────────────────
console.log('\nFinancial validation invariants:');

test('payment amount must be >= 0', () => {
  const r = validate({ amount: -0.01 }, { amount: { type: 'number', required: true, min: 0 } });
  expect(r.ok).toBeFalse();
});

test('valid payment amount passes', () => {
  const r = validate({ amount: 0.01 }, { amount: { type: 'number', required: true, min: 0 } });
  expect(r.ok).toBeTrue();
});

test('order status must be in valid enum', () => {
  const validStatuses = ['draft', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
  const r = validate({ status: 'unknown_status' }, { status: { type: 'string', enum: validStatuses } });
  expect(r.ok).toBeFalse();
});

test('valid order status passes', () => {
  const validStatuses = ['draft', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
  const r = validate({ status: 'confirmed' }, { status: { type: 'string', enum: validStatuses } });
  expect(r.ok).toBeTrue();
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests passed`);
}
