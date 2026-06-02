// ── Phase 5 — Makito Artwork Validator ───────────────────────────────────────

import type { MakitoPrintArea, MakitoPrintTechnique } from './makito.types';

export interface ArtworkSpec {
  dpi?: number;
  colorMode?: string;     // CMYK, RGB, Pantone, Grayscale
  widthMm?: number;
  heightMm?: number;
  fileFormat?: string;    // ai, pdf, png, jpg, eps
  bleedMm?: number;
  hasTransparency?: boolean;
  pantoneColors?: string[];
  estimatedColors?: number;
}

export interface ArtworkValidationResult {
  valid: boolean;
  passedChecks: string[];
  warnings: string[];
  errors: string[];
  suggestions: string[];
  verdict: 'PASS' | 'WARN' | 'FAIL';
  scorecard: {
    dpi: 'pass' | 'warn' | 'fail' | 'unknown';
    colorMode: 'pass' | 'warn' | 'fail' | 'unknown';
    dimensions: 'pass' | 'warn' | 'fail' | 'unknown';
    format: 'pass' | 'warn' | 'fail' | 'unknown';
    technique: 'pass' | 'warn' | 'fail' | 'unknown';
  };
}

export class MakitoArtworkValidator {
  validate(
    artwork: ArtworkSpec,
    printArea: MakitoPrintArea,
    technique: MakitoPrintTechnique,
  ): ArtworkValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const passed: string[] = [];
    const scorecard: ArtworkValidationResult['scorecard'] = {
      dpi: 'unknown',
      colorMode: 'unknown',
      dimensions: 'unknown',
      format: 'unknown',
      technique: 'unknown',
    };

    // ── DPI Check ──────────────────────────────────────────────────────────
    if (artwork.dpi !== undefined) {
      const minDpi = technique.dpiRequired ?? 300;
      if (artwork.dpi >= minDpi) {
        passed.push(`DPI ${artwork.dpi} ≥ required ${minDpi}`);
        scorecard.dpi = 'pass';
      } else if (artwork.dpi >= minDpi * 0.75) {
        warnings.push(`DPI ${artwork.dpi} is below recommended ${minDpi}dpi — print quality may be reduced`);
        suggestions.push(`Recreate artwork at ${minDpi}dpi or higher for best results`);
        scorecard.dpi = 'warn';
      } else {
        errors.push(`DPI ${artwork.dpi} is too low — minimum ${minDpi}dpi required for ${technique.name}`);
        suggestions.push(`Artwork must be at least ${minDpi}dpi. Current: ${artwork.dpi}dpi`);
        scorecard.dpi = 'fail';
      }
    } else {
      warnings.push('DPI not detected — ensure artwork is at least 300dpi');
      scorecard.dpi = 'warn';
    }

    // ── Color Mode Check ──────────────────────────────────────────────────
    if (artwork.colorMode) {
      const mode = artwork.colorMode.toUpperCase();
      const requiredMode = technique.colorMode?.toUpperCase();

      if (technique.code === 'EMBROIDERY') {
        if (mode !== 'PANTONE' && !artwork.pantoneColors?.length) {
          warnings.push('Embroidery requires Pantone thread colours — please specify Pantone codes');
          suggestions.push('Convert colours to Pantone for accurate embroidery matching');
          scorecard.colorMode = 'warn';
        } else {
          passed.push('Colour specification valid for embroidery');
          scorecard.colorMode = 'pass';
        }
      } else if (technique.code.includes('SCREEN') || technique.code.includes('PAD')) {
        if (technique.maxColors && (artwork.estimatedColors ?? 0) > technique.maxColors) {
          errors.push(`${technique.name} supports max ${technique.maxColors} colours — artwork has ${artwork.estimatedColors}`);
          scorecard.colorMode = 'fail';
        } else {
          passed.push(`Colour count within ${technique.name} limits`);
          scorecard.colorMode = 'pass';
        }
      } else if (requiredMode && requiredMode !== 'ANY') {
        if (mode !== requiredMode) {
          warnings.push(`Recommended colour mode for ${technique.name} is ${requiredMode} — current: ${mode}`);
          suggestions.push(`Convert to ${requiredMode} for best reproduction`);
          scorecard.colorMode = 'warn';
        } else {
          passed.push(`Colour mode ${mode} matches requirement`);
          scorecard.colorMode = 'pass';
        }
      } else {
        passed.push(`Colour mode ${mode} accepted`);
        scorecard.colorMode = 'pass';
      }
    }

    // ── Dimensions Check ─────────────────────────────────────────────────
    if (artwork.widthMm !== undefined && artwork.heightMm !== undefined) {
      const maxW = technique.maxWidth ?? printArea.maxWidth;
      const maxH = technique.maxHeight ?? printArea.maxHeight;

      if (artwork.widthMm <= maxW && artwork.heightMm <= maxH) {
        passed.push(`Dimensions ${artwork.widthMm}×${artwork.heightMm}mm fit within print area ${maxW}×${maxH}mm`);
        scorecard.dimensions = 'pass';
      } else {
        errors.push(
          `Artwork ${artwork.widthMm}×${artwork.heightMm}mm exceeds print area ${maxW}×${maxH}mm`,
        );
        suggestions.push(`Resize artwork to fit within ${maxW}×${maxH}mm`);
        scorecard.dimensions = 'fail';
      }
    } else {
      warnings.push('Artwork dimensions not detected — verify fit within print area');
      scorecard.dimensions = 'warn';
    }

    // ── File Format Check ─────────────────────────────────────────────────
    if (artwork.fileFormat) {
      const fmt = artwork.fileFormat.toLowerCase();
      const vectorFormats = ['ai', 'eps', 'pdf', 'svg'];
      const rasterFormats = ['png', 'jpg', 'jpeg', 'tiff'];

      if (vectorFormats.includes(fmt)) {
        passed.push(`Vector format ${fmt} — optimal for print`);
        scorecard.format = 'pass';
      } else if (rasterFormats.includes(fmt)) {
        warnings.push(`Raster format ${fmt} — ensure resolution is sufficient`);
        suggestions.push('Vector formats (AI, EPS, PDF) are preferred for scalable print quality');
        scorecard.format = 'warn';
      } else {
        errors.push(`Unsupported file format: ${fmt}`);
        scorecard.format = 'fail';
      }
    }

    // ── Technique-Specific Checks ─────────────────────────────────────────
    if (technique.code === 'ENGRAVING' || technique.code === 'LASER') {
      if (artwork.hasTransparency) {
        warnings.push('Transparency detected — engraving/laser requires solid fills');
        suggestions.push('Convert transparent areas to solid fills before submitting');
      } else {
        passed.push('No transparency — suitable for engraving/laser');
      }
      scorecard.technique = 'pass';
    } else if (technique.code === 'TRANSFER' || technique.code === 'DTG') {
      if (artwork.colorMode?.toUpperCase() === 'CMYK') {
        passed.push('CMYK mode — ideal for full-colour transfer/DTG');
        scorecard.technique = 'pass';
      } else {
        suggestions.push('Convert to CMYK for most accurate full-colour reproduction');
        scorecard.technique = 'warn';
      }
    } else {
      scorecard.technique = 'pass';
    }

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;
    const verdict: ArtworkValidationResult['verdict'] = hasErrors ? 'FAIL' : hasWarnings ? 'WARN' : 'PASS';

    return {
      valid: !hasErrors,
      passedChecks: passed,
      warnings,
      errors,
      suggestions,
      verdict,
      scorecard,
    };
  }

  /** Quick validate without specific technique — checks general requirements */
  quickValidate(artwork: ArtworkSpec): { ready: boolean; issues: string[] } {
    const issues: string[] = [];
    if (artwork.dpi !== undefined && artwork.dpi < 150) {
      issues.push(`DPI too low: ${artwork.dpi} (minimum 300 recommended)`);
    }
    if (artwork.colorMode?.toUpperCase() === 'RGB') {
      issues.push('RGB colour mode detected — convert to CMYK for print');
    }
    const fmt = artwork.fileFormat?.toLowerCase();
    if (fmt && ['bmp', 'gif', 'webp'].includes(fmt)) {
      issues.push(`File format ${fmt} not recommended for print`);
    }
    return { ready: issues.length === 0, issues };
  }
}
