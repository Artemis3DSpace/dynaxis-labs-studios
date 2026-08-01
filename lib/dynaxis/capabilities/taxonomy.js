/**
 * Phase 7G capability taxonomy scaffold.
 */

export const CAPABILITY_CATEGORIES = /** @type {const} */ ([
  'generation',
  'transformation',
  'analysis',
  'verification',
  'orchestration',
  'integration',
]);

const capabilityNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * @param {unknown} capability
 * @returns {string|null}
 */
export function normalizeCapabilityName(capability) {
  const normalized = String(capability || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
  if (!normalized || !capabilityNamePattern.test(normalized)) return null;
  return normalized;
}

/**
 * @param {unknown} category
 * @returns {string|null}
 */
export function normalizeCapabilityCategory(category) {
  const normalized = String(category || '')
    .trim()
    .toLowerCase();
  return CAPABILITY_CATEGORIES.includes(normalized) ? normalized : null;
}

/**
 * @param {unknown} category
 * @returns {boolean}
 */
export function isCapabilityCategory(category) {
  return normalizeCapabilityCategory(category) != null;
}
