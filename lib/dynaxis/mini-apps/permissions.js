/**
 * Dynaxis Mini App — permissions & capability constants.
 * Module permissions ≠ enterprise RBAC.
 */

export const MINI_APP_PERMISSIONS = /** @type {const} */ ([
  'project:read',
  'project:write',
  'assets:read',
  'assets:write',
  'generation:create',
  'generation:read',
  'jobs:create',
  'jobs:read',
  'models:use',
  'characters:read',
  'characters:write',
  'products:read',
  'products:write',
  'brands:read',
  'brands:write',
  'campaigns:read',
  'campaigns:write',
  'compositions:read',
  'compositions:write',
  'templates:read',
  'templates:write',
  'components:read',
  'components:write',
  'designSystems:read',
  'designSystems:write',
  'componentSets:read',
  'componentSets:write',
  'external:network',
]);

/** @typedef {(typeof MINI_APP_PERMISSIONS)[number]} MiniAppPermission */

export const MINI_APP_STATUSES = /** @type {const} */ ([
  'integrated',
  'available',
  'catalogue',
  'external',
  'disabled',
  'experimental',
]);

/** @typedef {(typeof MINI_APP_STATUSES)[number]} MiniAppStatus */

export const MINI_APP_MODULE_TYPES = /** @type {const} */ ([
  'capability',
  'workflow',
  'tool',
  'integration',
]);

/** @typedef {(typeof MINI_APP_MODULE_TYPES)[number]} MiniAppModuleType */

export const MINI_APP_CATEGORIES = /** @type {const} */ ([
  'creative',
  'business',
  'lifestyle',
  'productivity',
  'marketing',
  'developer',
  'framework',
  'other',
]);

/** @typedef {(typeof MINI_APP_CATEGORIES)[number]} MiniAppCategory */

export const ASSET_SEMANTIC_ROLES = /** @type {const} */ ([
  'input',
  'character_reference',
  'identity_reference',
  'portrait_reference',
  'product_reference',
  'packaging_reference',
  'label_reference',
  'logo_reference',
  'detail_reference',
  'transparent_product_reference',
  'generated_product_scene',
  'primary_logo',
  'alternate_logo',
  'brand_mark',
  'wordmark',
  'brand_reference',
  'brand_screenshot',
  'imagery_reference',
  'campaign_reference',
  'creative_reference',
  'source_material',
  'generated_campaign_creative',
  'style_reference',
  'generated_portrait',
  'garment',
  'person',
  'output',
  'variant',
]);

/** @typedef {(typeof ASSET_SEMANTIC_ROLES)[number]} AssetSemanticRole */

/**
 * @param {string} permission
 * @returns {permission is MiniAppPermission}
 */
export function isMiniAppPermission(permission) {
  return MINI_APP_PERMISSIONS.includes(/** @type {MiniAppPermission} */ (permission));
}

/**
 * @param {readonly MiniAppPermission[]} granted
 * @param {MiniAppPermission} required
 */
export function hasPermission(granted, required) {
  return Array.isArray(granted) && granted.includes(required);
}
