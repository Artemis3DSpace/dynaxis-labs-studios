/**
 * Dynaxis Labs Studios — CLIENT-SAFE entrypoint.
 *
 * This is the canonical browser/client surface for the Dynaxis platform. It must
 * NEVER (transitively) import server-only modules: `node:crypto`, Drizzle/postgres,
 * the platform DB client, ownership hashing, or provider secrets.
 *
 * Server code (API routes / RSC / services) must import from
 * `@/lib/dynaxis/server` instead. A boundary test
 * (`tests/dynaxis-boundary.test.mjs`) enforces that this module's dependency
 * graph stays server-free.
 *
 * Symmetry:
 *   - client surface → `@/lib/dynaxis/client` (this file, also aliased by index.js)
 *   - server surface → `@/lib/dynaxis/server`
 */

export { DYNAXIS_PRODUCT, DYNAXIS_METADATA } from './product.js';
export {
  DYNAXIS_FEATURES,
  getFeatureById,
  getFeatureByViewId,
  getFeaturesByCategory,
  getShellFeatures,
} from './features.js';
export {
  DYNAXIS_NAV_SECTIONS,
  getShellNavigation,
  getShellViewIds,
} from './navigation.js';
export {
  getApiKey,
  setApiKey,
  clearApiKey,
  getApiKeyFromCookie,
  resolveClientApiKey,
  SESSION_STORAGE_KEYS,
} from './session.js';
export {
  PLATFORM_SERVICE_STATUS,
  PLATFORM_SERVICE_NOTES,
} from './platform-status.js';
export {
  PROJECT_STATUSES,
  ASSET_TYPES,
  ASSET_SOURCES,
  JOB_STATUSES,
  GENERATION_STATUSES,
  DEFAULT_PROJECT_NAME,
  PROVIDER_MUAPI,
  CHARACTER_STATUSES,
  CHARACTER_CATEGORIES,
  CHARACTER_CONTINUITY_STRATEGY,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PRODUCT_CONTINUITY_STRATEGY,
  PRODUCT_ASSET_ROLES,
  PRODUCT_VISUAL_MODELS,
  BRAND_STATUSES,
  BRAND_ASSET_ROLES,
  BRAND_CONTINUITY_STRATEGY,
  CAMPAIGN_STATUSES,
  CAMPAIGN_CONCEPT_STATUSES,
  CAMPAIGN_DELIVERABLE_STATUSES,
  CAMPAIGN_CHARACTER_ROLES,
  CAMPAIGN_ASSET_ROLES,
  COMPOSITION_STATUSES,
  COMPOSITION_LAYER_ROLES,
  COMPOSITION_EXPORT_FORMATS,
  COMPOSITION_RENDER_VERSION,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
  COMPOSITION_DOCUMENT_VERSION,
  DESIGN_TEMPLATE_STATUSES,
  DESIGN_TEMPLATE_CATEGORIES,
  DESIGN_TEMPLATE_DOCUMENT_VERSION,
  ADAPTATION_ENGINE_VERSION,
  DESIGN_TEMPLATE_SLOT_TYPES,
  DESIGN_TEMPLATE_TEXT_ROLES,
  DESIGN_TEMPLATE_IMAGE_ROLES,
  DESIGN_COMPONENT_STATUSES,
  DESIGN_COMPONENT_CATEGORIES,
  DESIGN_COMPONENT_DOCUMENT_VERSION,
  DESIGN_COMPONENT_PROPERTY_TYPES,
  DESIGN_SYSTEM_STATUSES,
  DESIGN_TOKEN_DOCUMENT_VERSION,
  DESIGN_TOKEN_PRIMITIVE_TYPES,
  DESIGN_TOKEN_BINDABLE_PROPERTIES,
  DESIGN_COMPONENT_SET_STATUSES,
  normaliseProviderStatus,
  inferAssetType,
} from './types.js';
export * from './characters/index.js';
export * from './products/index.js';
export * from './brands/index.js';
export * from './campaigns/index.js';
export * from './compositions/index.js';
export * from './templates/index.js';
export * from './components/index.js';
export * from './design-systems/index.js';
export * from './component-sets/index.js';
export * from './design-agent/index.js';
export * from './marketing/index.js';
export {
  getStoredActiveProjectId,
  setStoredActiveProjectId,
  publishProjectContext,
  readProjectContext,
} from './client/project-context.js';
export { createPlatformClient, platformFetch } from './client/platform-api.js';
export { collectLocalHistoryEntries, HG_STUDIO_FEATURE_MAP } from './client/local-history.js';
// Mini App SDK: import from '@/lib/dynaxis/mini-apps' (separate entry keeps client bundles lean)
