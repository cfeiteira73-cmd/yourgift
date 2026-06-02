// ── Phase 15 — Makito Unit Tests — Updated to Real API Fields ────────────────
// Verified against real API payloads 2026-06-03

import { MakitoClient, MakitoApiError } from '@yourgift/makito';
import { transformMakitoProduct, validateTransformed } from '@yourgift/makito';
import { MakitoPricingEngine } from '@yourgift/makito';
import { MakitoArtworkValidator } from '@yourgift/makito';
import type { MakitoRealProduct, MakitoPrintArea, MakitoPrintTechnique } from '@yourgift/makito';

// ── Fixtures — Real API field names ───────────────────────────────────────────

const mockProduct: MakitoRealProduct = {
  ref: '15246',
  web_reference: '5246',
  name: 'Test Pen',
  description: '<p>A fantastic promotional pen</p>',
  observations: '',
  print_observations: '',
  printcode: 'K(2)',
  length: 140,
  height: 15,
  width: 15,
  diameter: null,
  weight: 20,
  material: 'ABS Plastic',
  pf_type: null,
  pf_units: null,
  pf_length: null,
  pf_height: null,
  pf_width: null,
  pf_weight: null,
  pi1_type: null, pi1_units: null, pi1_length: null, pi1_height: null, pi1_width: null, pi1_weight: null,
  pi2_type: null, pi2_units: null, pi2_length: null, pi2_height: null, pi2_width: null, pi2_weight: null,
  ptc_type: '1003',
  ptc_units: 100,
  ptc_length: 480,
  ptc_height: 255,
  ptc_width: 330,
  ptc_weight: 3.5,
  pallet_units: 4000,
  bundle_pallets: 40,
  pallet_weight: 140,
  sizes: null,
  brand: 'TestBrand',
  web_new: false,
  custom_code: '9608101000',
  batteries: [],
  categories: [
    'Production > PRODUCTS > Writing > Ballpoint Pens',
    'Production > PRODUCTS > Marking Techniques > Serigraphy',
  ],
  image360link: null,
  image: 'https://apis.makito.es/catalog/assets/15246/principal/5246-W.jpg',
  thumbnail_image: 'https://apis.makito.es/catalog/assets/15246/thumbnail/5246-W.jpg',
  detail_images: [
    'https://apis.makito.es/catalog/assets/15246/details/5246-D1.jpg',
  ],
  variants: [
    {
      variant_reference: 'MK001BLU',
      variant_name: 'Test Pen Blue',
      variant_colorcode: 'BLU',
      variant_size: '000',
      variant_image: 'https://apis.makito.es/catalog/assets/15246/15246001000/principal/5246-001-P.jpg',
      variant_thumbnail: 'https://apis.makito.es/catalog/assets/15246/15246001000/thumbnail/5246-001-P.jpg',
    },
    {
      variant_reference: 'MK001RED',
      variant_name: 'Test Pen Red',
      variant_colorcode: 'RED',
      variant_size: '000',
      variant_image: 'https://apis.makito.es/catalog/assets/15246/15246002000/principal/5246-002-P.jpg',
      variant_thumbnail: 'https://apis.makito.es/catalog/assets/15246/15246002000/thumbnail/5246-002-P.jpg',
    },
  ],
};

// ── MakitoClient Tests ────────────────────────────────────────────────────────

describe('MakitoClient', () => {
  it('should throw if clientId is missing', () => {
    expect(() => new MakitoClient({ clientId: '', clientSecret: 'secret' }))
      .toThrow('MakitoClient: clientId is required');
  });

  it('should throw if clientSecret is missing', () => {
    expect(() => new MakitoClient({ clientId: 'id', clientSecret: '' }))
      .toThrow('MakitoClient: clientSecret is required');
  });

  it('should initialize with defaults', () => {
    const client = new MakitoClient({ clientId: 'id', clientSecret: 'secret' });
    expect(client).toBeDefined();
    const circuit = client.getCircuitState();
    expect(circuit.open).toBe(false);
    expect(circuit.failures).toBe(0);
    expect(circuit.openedAt).toBeNull();
  });

  it('should report circuit closed initially', () => {
    const client = new MakitoClient({ clientId: 'id', clientSecret: 'secret' });
    expect(client.getCircuitState().open).toBe(false);
  });
});

// ── transformMakitoProduct Tests — Real API Fields ───────────────────────────

describe('transformMakitoProduct', () => {
  const priceMap = new Map([
    ['15246', { basePrice: 1.20, priceBreaks: [{ minQty: 1, price: 1.20 }, { minQty: 100, price: 0.95 }] }],
    ['5246', { basePrice: 1.20, priceBreaks: [] }],
  ]);

  it('should use correct supplier', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.supplier).toBe('makito');
  });

  it('should build supplierRef from ref field', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.supplierRef).toBe('makito_15246');
    expect(result.supplierRef).not.toContain('undefined');
  });

  it('should use price from priceMap', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.basePrice).toBe(1.20);
  });

  it('should parse categories array into category string', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.category).toBe('Writing');
    expect(result.category).not.toBe('undefined');
  });

  it('should build images from image + detail_images', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]).toContain('apis.makito.es');
  });

  it('should use variant_reference as SKU', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.variants[0].sku).toBe('MK001BLU');
    expect(result.variants[0].sku).not.toContain('undefined');
  });

  it('should use variant_colorcode as colorCode', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.variants[0].colorCode).toBe('BLU');
  });

  it('should use variant_name as color', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    expect(result.variants[0].color).toBe('Test Pen Blue');
  });

  it('should pass validation with 0 errors', () => {
    const result = transformMakitoProduct(mockProduct, priceMap);
    const errors = validateTransformed(result);
    expect(errors).toHaveLength(0);
  });
});

// ── validateTransformed Tests ─────────────────────────────────────────────────

describe('validateTransformed', () => {
  it('should detect undefined supplierRef', () => {
    const bad = { supplierRef: 'makito_undefined', title: 'Test', variants: [] } as any;
    const errors = validateTransformed(bad);
    expect(errors.some(e => e.includes('supplierRef'))).toBe(true);
  });

  it('should detect missing SKU', () => {
    const bad = { supplierRef: 'makito_123', title: 'Test', variants: [{ sku: '' }] } as any;
    const errors = validateTransformed(bad);
    expect(errors.some(e => e.includes('SKU'))).toBe(true);
  });

  it('should pass for valid product', () => {
    const priceMap = new Map([['15246', { basePrice: 1.0, priceBreaks: [] }]]);
    const valid = transformMakitoProduct(mockProduct, priceMap);
    expect(validateTransformed(valid)).toHaveLength(0);
  });
});

// ── MakitoPricingEngine Tests ─────────────────────────────────────────────────

describe('MakitoPricingEngine', () => {
  const engine = new MakitoPricingEngine({ defaultMarginPct: 35, vatRate: 23 });

  it('should calculate basic price with margin', () => {
    const result = engine.calculate({ sku: 'MK001BLU', quantity: 100, basePrice: 0.85 });
    expect(result.unitCost).toBe(0.85);
    expect(result.marginPct).toBeCloseTo(35, 0);
    expect(result.total).toBeGreaterThan(result.subtotal);
  });

  it('should apply price breaks correctly', () => {
    const priceBreaks = [
      { minQty: 100, price: 0.75 },
      { minQty: 500, price: 0.60 },
    ];
    const r100 = engine.calculate({ sku: 'test', quantity: 100, basePrice: 0.85, priceBreaks });
    const r500 = engine.calculate({ sku: 'test', quantity: 500, basePrice: 0.85, priceBreaks });
    expect(r100.unitCost).toBe(0.75);
    expect(r500.unitCost).toBe(0.60);
  });

  it('should apply VAT correctly at 23%', () => {
    const result = engine.calculate({ sku: 'test', quantity: 100, basePrice: 1.00, vatRate: 23 });
    expect(Math.abs(result.vatAmount - result.subtotal * 0.23)).toBeLessThan(0.01);
  });

  it('should give higher profitability for higher volume', () => {
    const low = engine.calculate({ sku: 'test', quantity: 10, basePrice: 1.00 });
    const high = engine.calculate({ sku: 'test', quantity: 1000, basePrice: 1.00 });
    expect(high.profitabilityScore).toBeGreaterThan(low.profitabilityScore);
  });

  it('compareQuantities returns results for each qty', () => {
    const results = engine.compareQuantities('MK001', 0.85, [50, 100, 500]);
    expect(results).toHaveLength(3);
    expect(results[0].quantity).toBe(50);
  });
});

// ── MakitoArtworkValidator Tests ──────────────────────────────────────────────

describe('MakitoArtworkValidator', () => {
  const validator = new MakitoArtworkValidator();

  const printArea: MakitoPrintArea = {
    id: 'pa1', name: 'Barrel', positionCode: 'BARREL',
    maxWidth: 40, maxHeight: 8, techniques: [],
  };

  const screenPrint: MakitoPrintTechnique = {
    code: 'SCREENPRINT', name: 'Screen Printing',
    maxColors: 4, minQty: 50, setupCost: 25, unitCost: 0.5, dpiRequired: 300, colorMode: 'Pantone',
  };

  const laser: MakitoPrintTechnique = {
    code: 'LASER', name: 'Laser Engraving', minQty: 1, setupCost: 15, unitCost: 0.3,
  };

  it('should PASS valid vector artwork for screen printing', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'ai', estimatedColors: 2 },
      printArea, screenPrint,
    );
    expect(result.verdict).toBe('PASS');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should FAIL artwork exceeding print area', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 60, heightMm: 10, fileFormat: 'ai' },
      printArea, screenPrint,
    );
    expect(result.errors.some(e => e.includes('exceeds print area'))).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('should FAIL low DPI artwork', () => {
    const result = validator.validate(
      { dpi: 72, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'jpg' },
      printArea, screenPrint,
    );
    expect(result.errors.some(e => e.includes('DPI'))).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('should WARN on raster format', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'png' },
      printArea, screenPrint,
    );
    expect(result.warnings.some(w => w.includes('Raster format'))).toBe(true);
    expect(result.verdict).toBe('WARN');
  });

  it('should FAIL too many colors for screen print', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'ai', estimatedColors: 6 },
      printArea, screenPrint,
    );
    expect(result.valid).toBe(false);
  });

  it('should PASS laser with vector no transparency', () => {
    const result = validator.validate(
      { dpi: 300, widthMm: 35, heightMm: 6, fileFormat: 'ai', hasTransparency: false },
      printArea, laser,
    );
    expect(result.valid).toBe(true);
  });

  it('quickValidate detects RGB', () => {
    const result = validator.quickValidate({ colorMode: 'RGB' });
    expect(result.ready).toBe(false);
    expect(result.issues.some(i => i.includes('RGB'))).toBe(true);
  });

  it('quickValidate passes clean artwork', () => {
    const result = validator.quickValidate({ dpi: 300, colorMode: 'CMYK', fileFormat: 'ai' });
    expect(result.ready).toBe(true);
  });
});

// ── MakitoApiError Tests ──────────────────────────────────────────────────────

describe('MakitoApiError', () => {
  it('should store type, message and statusCode', () => {
    const err = new MakitoApiError('RATE_LIMITED', 'Too many requests', 429);
    expect(err.type).toBe('RATE_LIMITED');
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('MakitoApiError');
  });

  it('should be instanceof Error', () => {
    expect(new MakitoApiError('TIMEOUT', 'Timeout') instanceof Error).toBe(true);
  });
});
