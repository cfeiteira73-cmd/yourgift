// ── Phase 15 — Makito Unit Tests ─────────────────────────────────────────────

import { MakitoClient, MakitoApiError } from '@yourgift/makito';
import { MakitoCatalogSyncService, transformMakitoProduct } from '@yourgift/makito';
import { MakitoPricingEngine } from '@yourgift/makito';
import { MakitoArtworkValidator } from '@yourgift/makito';
import type { MakitoProduct, MakitoPrintArea, MakitoPrintTechnique } from '@yourgift/makito';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockProduct: MakitoProduct = {
  id: 'test-001',
  reference: 'MK001',
  name: 'Test Pen',
  shortDescription: 'A great pen',
  longDescription: 'A fantastic promotional pen',
  brand: 'Makito',
  category: 'Writing',
  subcategory: 'Ballpoint Pens',
  tags: ['pen', 'writing', 'promo'],
  material: 'ABS Plastic',
  countryOfOrigin: 'CN',
  weight: 20,
  printAreas: [
    {
      id: 'pa1',
      name: 'Barrel',
      positionCode: 'BARREL',
      maxWidth: 40,
      maxHeight: 8,
      techniques: [
        { code: 'SCREENPRINT', name: 'Screen Printing', maxColors: 4, minQty: 50, setupCost: 25, unitCost: 0.5, dpiRequired: 300, colorMode: 'Pantone' },
        { code: 'LASER', name: 'Laser Engraving', minQty: 1, setupCost: 15, unitCost: 0.3 },
      ],
    },
  ],
  sustainability: { isRecycled: false, certifications: [] },
  packaging: { cartonQty: 100 },
  media: [
    { id: 'img1', url: 'https://makito.es/img/MK001.jpg', type: 'image', isPrimary: true, sortOrder: 1 },
    { id: 'doc1', url: 'https://makito.es/docs/MK001.pdf', type: 'technical_sheet' },
  ],
  variants: [
    {
      id: 'v1', sku: 'MK001-BLU', ean: '1234567890123',
      colorCode: 'BLU', colorName: 'Blue', colorFamily: 'Blues',
      price: 0.85, stock: 5000,
      status: 'active',
      media: [{ id: 'vi1', url: 'https://makito.es/img/MK001-BLU.jpg', type: 'image', sortOrder: 1 }],
    },
    {
      id: 'v2', sku: 'MK001-RED', ean: '1234567890124',
      colorCode: 'RED', colorName: 'Red', colorFamily: 'Reds',
      price: 0.85, stock: 3000,
      status: 'active',
      media: [{ id: 'vi2', url: 'https://makito.es/img/MK001-RED.jpg', type: 'image', sortOrder: 1 }],
    },
    {
      id: 'v3', sku: 'MK001-OLD', ean: '1234567890125',
      colorCode: 'GRY', colorName: 'Grey', colorFamily: 'Greys',
      price: 0.80, stock: 0,
      status: 'discontinued',
      media: [],
    },
  ],
  updatedAt: '2026-05-01T00:00:00Z',
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

// ── transformMakitoProduct Tests ──────────────────────────────────────────────

describe('transformMakitoProduct', () => {
  const priceMap = new Map([['MK001-BLU', 1.20], ['MK001-RED', 1.20]]);
  const stockMap = new Map([['MK001-BLU', 4500], ['MK001-RED', 2800]]);

  it('should transform product with correct supplier', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    expect(result.supplier).toBe('makito');
  });

  it('should set correct supplierRef', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    expect(result.supplierRef).toBe('makito_MK001');
  });

  it('should use priceMap values over product prices', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    expect(result.basePrice).toBe(1.20);
    expect(result.variants[0].price).toBe(1.20);
  });

  it('should use stockMap values over product stock', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    expect(result.variants[0].stock).toBe(4500);
  });

  it('should filter out discontinued variants', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    const skus = result.variants.map((v) => v.sku);
    expect(skus).toContain('MK001-BLU');
    expect(skus).toContain('MK001-RED');
    expect(skus).not.toContain('MK001-OLD');
  });

  it('should extract primary image', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    expect(result.images.length).toBeGreaterThan(0);
  });

  it('should include print area data', () => {
    const result = transformMakitoProduct(mockProduct, priceMap, stockMap);
    const pa = result.printAreas as any;
    expect(pa.positions).toBe(1);
    expect(pa.areas).toHaveLength(1);
    expect(pa.areas[0].maxWidth).toBe(40);
  });
});

// ── MakitoPricingEngine Tests ─────────────────────────────────────────────────

describe('MakitoPricingEngine', () => {
  const engine = new MakitoPricingEngine({ defaultMarginPct: 35, vatRate: 23 });

  it('should calculate basic price with margin', () => {
    const result = engine.calculate({ sku: 'MK001-BLU', quantity: 100, basePrice: 0.85 });
    expect(result.unitCost).toBe(0.85);
    expect(result.marginPct).toBeCloseTo(35, 0);
    expect(result.total).toBeGreaterThan(result.subtotal);
  });

  it('should apply price breaks', () => {
    const priceBreaks = [
      { minQty: 100, unitPrice: 0.75, setupCost: 20 },
      { minQty: 500, unitPrice: 0.60, setupCost: 20 },
    ];
    const result100 = engine.calculate({ sku: 'MK001-BLU', quantity: 100, basePrice: 0.85, priceBreaks });
    const result500 = engine.calculate({ sku: 'MK001-BLU', quantity: 500, basePrice: 0.85, priceBreaks });

    expect(result100.unitCost).toBe(0.75);
    expect(result500.unitCost).toBe(0.60);
    expect(result100.priceBreakApplied).toBeDefined();
  });

  it('should apply VAT correctly', () => {
    const result = engine.calculate({ sku: 'test', quantity: 100, basePrice: 1.00, vatRate: 23 });
    const expectedVat = result.subtotal * 0.23;
    expect(Math.abs(result.vatAmount - expectedVat)).toBeLessThan(0.01);
  });

  it('should give higher profitability score for higher volume', () => {
    const low = engine.calculate({ sku: 'test', quantity: 10, basePrice: 1.00 });
    const high = engine.calculate({ sku: 'test', quantity: 1000, basePrice: 1.00 });
    expect(high.profitabilityScore).toBeGreaterThan(low.profitabilityScore);
  });

  it('should compare quantities', () => {
    const results = engine.compareQuantities('MK001', 0.85, [50, 100, 500]);
    expect(results).toHaveLength(3);
    expect(results[0].quantity).toBe(50);
    expect(results[2].quantity).toBe(500);
  });
});

// ── MakitoArtworkValidator Tests ──────────────────────────────────────────────

describe('MakitoArtworkValidator', () => {
  const validator = new MakitoArtworkValidator();

  const printArea: MakitoPrintArea = {
    id: 'pa1',
    name: 'Barrel',
    positionCode: 'BARREL',
    maxWidth: 40,
    maxHeight: 8,
    techniques: [],
  };

  const screenPrint: MakitoPrintTechnique = {
    code: 'SCREENPRINT',
    name: 'Screen Printing',
    maxColors: 4,
    minQty: 50,
    setupCost: 25,
    unitCost: 0.5,
    dpiRequired: 300,
    colorMode: 'Pantone',
  };

  const laser: MakitoPrintTechnique = {
    code: 'LASER',
    name: 'Laser Engraving',
    minQty: 1,
    setupCost: 15,
    unitCost: 0.3,
  };

  it('should PASS valid vector artwork for screen printing', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'ai', estimatedColors: 2 },
      printArea,
      screenPrint,
    );
    expect(result.verdict).toBe('PASS');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should FAIL artwork that exceeds print area', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 60, heightMm: 10, fileFormat: 'ai' },
      printArea,
      screenPrint,
    );
    expect(result.errors.some((e) => e.includes('exceeds print area'))).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.verdict).toBe('FAIL');
  });

  it('should FAIL low DPI artwork', () => {
    const result = validator.validate(
      { dpi: 72, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'jpg' },
      printArea,
      screenPrint,
    );
    expect(result.errors.some((e) => e.includes('DPI'))).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('should WARN on raster format', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'png' },
      printArea,
      screenPrint,
    );
    expect(result.warnings.some((w) => w.includes('Raster format'))).toBe(true);
    expect(result.verdict).toBe('WARN');
  });

  it('should FAIL too many colors for screen print', () => {
    const result = validator.validate(
      { dpi: 300, colorMode: 'CMYK', widthMm: 35, heightMm: 6, fileFormat: 'ai', estimatedColors: 6 },
      printArea,
      screenPrint,
    );
    expect(result.errors.some((e) => e.includes('colours'))).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('should PASS laser engraving with vector and no transparency', () => {
    const result = validator.validate(
      { dpi: 300, widthMm: 35, heightMm: 6, fileFormat: 'ai', hasTransparency: false },
      printArea,
      laser,
    );
    expect(result.valid).toBe(true);
  });

  it('should WARN laser engraving with transparency', () => {
    const result = validator.validate(
      { dpi: 300, widthMm: 35, heightMm: 6, fileFormat: 'ai', hasTransparency: true },
      printArea,
      laser,
    );
    expect(result.warnings.some((w) => w.includes('transparency'))).toBe(true);
  });

  it('quickValidate should detect RGB', () => {
    const result = validator.quickValidate({ colorMode: 'RGB' });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes('RGB'))).toBe(true);
  });

  it('quickValidate should pass clean artwork', () => {
    const result = validator.quickValidate({ dpi: 300, colorMode: 'CMYK', fileFormat: 'ai' });
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ── MakitoApiError Tests ──────────────────────────────────────────────────────

describe('MakitoApiError', () => {
  it('should store error type and message', () => {
    const err = new MakitoApiError('RATE_LIMITED', 'Too many requests', 429);
    expect(err.type).toBe('RATE_LIMITED');
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('MakitoApiError');
    expect(err.message).toBe('Too many requests');
  });

  it('should be an instance of Error', () => {
    const err = new MakitoApiError('TIMEOUT', 'Timeout');
    expect(err instanceof Error).toBe(true);
  });
});
