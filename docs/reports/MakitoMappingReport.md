# Makito Mapping Report
**Date:** 2026-06-02  
**Methodology:** Real API payloads verified against live test environment  
**Sample:** 100/4573 random products validated  

## Validation Result: ✅ 100/100 PASS

### Field Mapping — Before vs After Fix

| Field (Code Expected) | Field (Real API) | Status |
|---|---|---|
| `productReference` | **`ref`** | ✅ Fixed |
| `productName` | **`name`** | ✅ Fixed |
| `productDescription` | **`description`** (HTML) | ✅ Fixed |
| `category` (string) | **`categories`** (string array of paths) | ✅ Fixed — parse first path |
| `subcategory` | Derived from `categories[0]` path | ✅ Fixed |
| `media` (array of objects) | **`image`** + **`detail_images`** + **`thumbnail_image`** | ✅ Fixed |
| `variantReference` | **`variant_reference`** e.g. `"5246ROJS/T"` | ✅ Fixed |
| `colorDescription` | **`variant_name`** | ✅ Fixed |
| `colorCode` | **`variant_colorcode`** | ✅ Fixed |
| `eanCode` | **not available in API** | ✅ Empty string (correct) |
| `active` status | **not in API** — all variants active | ✅ Fixed |
| `customsCode` | **`custom_code`** | ✅ Fixed |
| `weight` | **`weight`** (can be `false`) | ✅ Fixed — guard against false |

### Critical Finding: Stock Cross-Reference NOT Possible

**Stock API** uses numeric internal codes: `material: "11011006000"`  
**Catalog API** uses alphanumeric codes: `variant_reference: "5246ROJS/T"`  

**There is no API endpoint to map between these two formats.**

**Impact:** `stock` field in all variants is set to `0`.  
**Workaround:** Contact Makito to request a mapping file or use the stock endpoint differently.  
**Recommendation:** Do not show stock levels to clients until resolved.

### Price Cross-Reference — PARTIALLY POSSIBLE

**Price API** material codes are numeric product-level (e.g. `"11011"`).  
**Catalog** `ref` is also numeric (e.g. `"15246"`) but different format.  

**Result:** 0/100 products found a direct price match by `ref`.  
**Workaround:** Prices must be obtained separately or from Makito account manager.  
**Recommendation:** Show "Request Quote" until price mapping is resolved with Makito support.

### Category Distribution (4573 products)

| Category | Count |
|---|---|
| Gifts And Premiums | ~550 |
| Drinkware | ~520 |
| Technology And Accessories | ~430 |
| Writing | ~410 |
| Decoration And Home | ~295 |
| Personal Care And Pharma | ~230 |
| Sport | ~185 |
| Bags | ~185 |
| Tools And Diy | ~160 |
| Backpacks | ~160 |

### supplierRef Verification (100 samples)

- `makito_undefined`: 0 occurrences ✅  
- Valid `makito_XXXXX` format: 100/100 ✅  
- SKU `undefined`: 0 occurrences ✅  
- Empty SKU: 0 occurrences ✅  

### Remaining Limitations

1. **Stock:** Always 0 — requires material code mapping from Makito
2. **Prices:** Product-level only, no variant-level pricing
3. **EAN/GTIN:** Not provided by Makito catalog API
4. **Print areas:** Available via separate `/print-config/files` endpoint (not yet joined to products)
5. **HTML descriptions:** Stored as-is, needs sanitisation before display
