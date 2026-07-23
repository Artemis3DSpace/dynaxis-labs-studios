/**
 * Phase 7B capability contract only.
 * Governed model/capability registry remains Phase 7G.
 */

export const GENERATION_CAPABILITIES = /** @type {const} */ ([
  'text-to-image',
  'image-to-image',
  'text-to-video',
  'image-to-video',
  'video-to-video',
  'lip-sync',
  'audio-generation',
  'background-removal',
  'concept-generation',
  'copy-generation',
]);

const capabilityPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * @param {unknown} capability
 * @returns {string|null}
 */
export function normalizeGenerationCapability(capability) {
  const value = String(capability || '').trim().toLowerCase();
  if (!value) return null;
  if (!capabilityPattern.test(value)) return null;
  return value;
}

/**
 * @param {unknown} capability
 * @returns {boolean}
 */
export function isGenerationCapability(capability) {
  return normalizeGenerationCapability(capability) != null;
}

/**
 * @param {unknown} capabilities
 * @returns {string[]}
 */
export function normalizeCapabilityList(capabilities) {
  if (!Array.isArray(capabilities)) return [];
  return [...new Set(capabilities.map(normalizeGenerationCapability).filter(Boolean))].sort();
}
