/**
 * Dynaxis Labs Studios — shared platform types & constants (contracts).
 * Separated from Drizzle schema so clients/docs can import without DB drivers.
 */

/** @typedef {'active' | 'archived'} ProjectStatus */

/** @typedef {'image' | 'video' | 'audio' | 'other'} AssetType */

/** @typedef {'generated' | 'uploaded' | 'imported' | 'external'} AssetSource */

/**
 * @typedef {'queued' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled'} JobStatus
 */

/** @typedef {JobStatus} GenerationStatus */

export const PROJECT_STATUSES = /** @type {const} */ (['active', 'archived']);

export const ASSET_TYPES = /** @type {const} */ (['image', 'video', 'audio', 'other']);

export const ASSET_SOURCES = /** @type {const} */ ([
  'generated',
  'uploaded',
  'imported',
  'external',
]);

export const JOB_STATUSES = /** @type {const} */ ([
  'queued',
  'submitted',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
]);

export const GENERATION_STATUSES = JOB_STATUSES;

export const DEFAULT_PROJECT_NAME = 'Default Project';

export const PROVIDER_MUAPI = 'muapi';
export const PROVIDER_HIGGSFIELD = 'higgsfield';
export const PROVIDER_FAL = 'fal';
export const PROVIDER_REPLICATE = 'replicate';
export const PROVIDER_LOCAL = 'local';

export const KNOWN_PROVIDER_IDS = /** @type {const} */ ([
  PROVIDER_MUAPI,
  PROVIDER_HIGGSFIELD,
  PROVIDER_FAL,
  PROVIDER_REPLICATE,
  PROVIDER_LOCAL,
]);

const providerIdPattern = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/;

/**
 * Normalize a provider identifier while preserving the persistence boundary as
 * an extensible string. Known provider constants are vocabulary, not a DB enum.
 * @param {unknown} providerId
 * @returns {string|null}
 */
export function normalizeProviderId(providerId) {
  const id = String(providerId || '')
    .trim()
    .toLowerCase();
  if (!id || id.length > 100 || !providerIdPattern.test(id)) return null;
  return id;
}

/**
 * @param {unknown} providerId
 * @returns {boolean}
 */
export function isValidProviderId(providerId) {
  return normalizeProviderId(providerId) != null;
}

/** @typedef {'active' | 'archived'} CharacterStatus */

export const CHARACTER_STATUSES = /** @type {const} */ (['active', 'archived']);

export const CHARACTER_CATEGORIES = /** @type {const} */ ([
  'Original',
  'Fantasy',
  'Sci-Fi',
  'Anime',
  'Historical',
  'Contemporary',
  'Other',
]);

/** Reference-based continuity — not trained identity embeddings. */
export const CHARACTER_CONTINUITY_STRATEGY = 'reference-based';

export const DEFAULT_CHARACTER_LLM_MODEL = 'google/gemini-2.5-flash';

export const CHARACTER_VISUAL_MODELS = /** @type {const} */ ({
  generate: 'nano-banana-pro',
  edit: 'nano-banana-pro-edit',
});

/** @typedef {'active' | 'archived'} ProductStatus */

export const PRODUCT_STATUSES = /** @type {const} */ (['active', 'archived']);

export const PRODUCT_TYPES = /** @type {const} */ ([
  'physical',
  'digital',
  'consumable',
  'apparel',
  'other',
]);

/** Product continuity via reference Assets — not catalogue/ERP identity. */
export const PRODUCT_CONTINUITY_STRATEGY = 'reference-based';

export const PRODUCT_VISUAL_MODELS = /** @type {const} */ ({
  edit: 'nano-banana-2-edit',
});

export const PRODUCT_ASSET_ROLES = /** @type {const} */ ([
  'product_reference',
  'packaging_reference',
  'label_reference',
  'logo_reference',
  'detail_reference',
  'transparent_product_reference',
  'generated_product_scene',
]);

/** @typedef {'active' | 'archived'} BrandStatus */

export const BRAND_STATUSES = /** @type {const} */ (['active', 'archived']);

export const BRAND_ASSET_ROLES = /** @type {const} */ ([
  'primary_logo',
  'alternate_logo',
  'brand_mark',
  'wordmark',
  'brand_reference',
  'brand_screenshot',
  'imagery_reference',
]);

/** Brand continuity via reference Assets + DNA snapshot — not CRM identity. */
export const BRAND_CONTINUITY_STRATEGY = 'reference-based';

/** @typedef {'draft' | 'concepting' | 'active' | 'completed' | 'archived'} CampaignStatus */

export const CAMPAIGN_STATUSES = /** @type {const} */ ([
  'draft',
  'concepting',
  'active',
  'completed',
  'archived',
]);

/** @typedef {'draft' | 'selected' | 'archived'} CampaignConceptStatus */

export const CAMPAIGN_CONCEPT_STATUSES = /** @type {const} */ ([
  'draft',
  'selected',
  'archived',
]);

/** @typedef {'planned' | 'copy_ready' | 'generating' | 'completed' | 'failed' | 'cancelled'} CampaignDeliverableStatus */

export const CAMPAIGN_DELIVERABLE_STATUSES = /** @type {const} */ ([
  'planned',
  'copy_ready',
  'generating',
  'completed',
  'failed',
  'cancelled',
]);

export const CAMPAIGN_CHARACTER_ROLES = /** @type {const} */ ([
  'presenter',
  'spokesperson',
  'subject',
  'campaign_persona',
]);

export const CAMPAIGN_ASSET_ROLES = /** @type {const} */ ([
  'campaign_reference',
  'creative_reference',
  'source_material',
  'generated_campaign_creative',
  'brand_logo',
  'product_reference',
  'character_reference',
]);

/** @typedef {'draft' | 'active' | 'archived'} CompositionStatus */

export const COMPOSITION_STATUSES = /** @type {const} */ (['draft', 'active', 'archived']);

export const COMPOSITION_LAYER_ROLES = /** @type {const} */ ([
  'headline',
  'body',
  'cta',
  'brand_logo',
  'product',
  'character',
  'decorative',
  'custom',
]);

export const COMPOSITION_EXPORT_FORMATS = /** @type {const} */ (['png']);

export const COMPOSITION_RENDER_VERSION = 'resvg-1';

export const COMPOSITION_MAX_CANVAS_PX = 4096;
export const COMPOSITION_MIN_CANVAS_PX = 64;

export const COMPOSITION_DOCUMENT_VERSION = 1;

/** @typedef {'draft' | 'active' | 'archived'} DesignTemplateStatus */

export const DESIGN_TEMPLATE_STATUSES = /** @type {const} */ ([
  'draft',
  'active',
  'archived',
]);

export const DESIGN_TEMPLATE_CATEGORIES = /** @type {const} */ ([
  'social',
  'advertising',
  'presentation',
  'product',
  'campaign',
  'thumbnail',
  'banner',
  'custom',
]);

export const DESIGN_TEMPLATE_DOCUMENT_VERSION = 1;

export const ADAPTATION_ENGINE_VERSION = 'adapt-v1';

export const DESIGN_TEMPLATE_SLOT_TYPES = /** @type {const} */ (['text', 'image', 'variant']);

export const DESIGN_TEMPLATE_TEXT_ROLES = /** @type {const} */ ([
  'headline',
  'body',
  'cta',
  'eyebrow',
  'custom_text',
]);

export const DESIGN_TEMPLATE_IMAGE_ROLES = /** @type {const} */ ([
  'background',
  'product',
  'character',
  'brand_logo',
  'brand_reference',
  'custom_image',
]);

/** @typedef {'draft' | 'active' | 'archived'} DesignComponentStatus */

export const DESIGN_COMPONENT_STATUSES = /** @type {const} */ ([
  'draft',
  'active',
  'archived',
]);

export const DESIGN_COMPONENT_CATEGORIES = /** @type {const} */ ([
  'cta',
  'card',
  'header',
  'badge',
  'product',
  'social',
  'branding',
  'content',
  'custom',
]);

export const DESIGN_COMPONENT_DOCUMENT_VERSION = 1;

export const DESIGN_COMPONENT_PROPERTY_TYPES = /** @type {const} */ ([
  'text',
  'asset',
  'colour',
  'visibility',
]);

/** @typedef {'draft' | 'active' | 'archived'} DesignSystemStatus */

export const DESIGN_SYSTEM_STATUSES = /** @type {const} */ ([
  'draft',
  'active',
  'archived',
]);

export const DESIGN_TOKEN_DOCUMENT_VERSION = 1;

export const DESIGN_TOKEN_PRIMITIVE_TYPES = /** @type {const} */ ([
  'colour',
  'number',
  'string',
  'boolean',
]);

/** Bindable layer/canvas properties that exist in current Composition schema/renderer. */
export const DESIGN_TOKEN_BINDABLE_PROPERTIES = /** @type {const} */ ([
  'color',
  'backgroundColor',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'padding',
  'borderRadius',
  'opacity',
  'canvasBackgroundColor',
]);

/** @typedef {'draft' | 'active' | 'archived'} DesignComponentSetStatus */

export const DESIGN_COMPONENT_SET_STATUSES = /** @type {const} */ ([
  'draft',
  'active',
  'archived',
]);

/** @typedef {'user' | 'assistant' | 'system'} CharacterMessageRole */

export const CHARACTER_MESSAGE_ROLES = /** @type {const} */ ([
  'user',
  'assistant',
  'system',
]);

export { normaliseProviderStatus } from './providers/common.js';

/**
 * Infer asset type from URL / mime.
 * @param {{ url?: string, mimeType?: string, hint?: string }} input
 * @returns {AssetType}
 */
export function inferAssetType(input = {}) {
  const mime = String(input.mimeType || '').toLowerCase();
  const url = String(input.url || '').toLowerCase();
  const hint = String(input.hint || '').toLowerCase();
  if (hint === 'image' || hint === 'video' || hint === 'audio' || hint === 'other') {
    return /** @type {AssetType} */ (hint);
  }
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)(\?|$)/.test(url)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/.test(url)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)(\?|$)/.test(url)) return 'audio';
  return 'other';
}
