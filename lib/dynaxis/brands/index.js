/**
 * Dynaxis Brand public exports (client-safe).
 * Analyzer/scraper stay server-only — do not re-export them here.
 */

export {
  rgbToHex,
  pickPalette,
  dedupeColors,
  normalizeFonts,
} from './colors.js';

export {
  brandDnaDraftSchema,
  textAnalysisSchema,
  visionAnalysisSchema,
  parseModelJson,
  mergeBrandDnaDraft,
  BRAND_TEXT_SYSTEM_PROMPT,
  BRAND_TEXT_USER_TEMPLATE,
  BRAND_VISION_PROMPT,
} from './dna.js';

export {
  BRAND_LOGO_ROLE_PRIORITY,
  normaliseBrandAssetLinks,
  buildBrandMessagingContext,
  buildBrandVisualContext,
  buildBrandContext,
  resolveBrandContext,
  publishBrandGenerationContext,
  clearBrandGenerationContext,
  readBrandGenerationContext,
  buildBrandMessagingSupplement,
} from './consumer.js';
