/**
 * Phase 7G model domain scaffold.
 */

import { normalizeProviderId } from '../types.js';

export const MODEL_DOMAIN_CATEGORIES = /** @type {const} */ ([
  'image_generation',
  'video_generation',
  'audio_generation',
  'language_generation',
  'embedding',
  'moderation',
  'multimodal',
]);

/**
 * Known-provider list is intentionally explicit in the scaffold.
 * Future implementation packages may extend this contract via reviewed updates.
 */
export const MODEL_DOMAIN_PROVIDER_IDS = /** @type {const} */ ([
  'muapi',
  'higgsfield',
  'fal',
  'replicate',
  'local',
]);

/**
 * @param {unknown} category
 * @returns {string|null}
 */
export function normalizeModelDomainCategory(category) {
  const normalized = String(category || '')
    .trim()
    .toLowerCase();
  return MODEL_DOMAIN_CATEGORIES.includes(normalized) ? normalized : null;
}

/**
 * @param {unknown} mapping
 */
export function validateProviderModelMappingContract(mapping) {
  if (!mapping || typeof mapping !== 'object') {
    throw new Error('Provider/model mapping must be an object');
  }

  const providerId = normalizeProviderId(mapping.providerId);
  if (!providerId || !MODEL_DOMAIN_PROVIDER_IDS.includes(providerId)) {
    throw new Error(`Unknown provider mapping: ${mapping.providerId ?? ''}`);
  }

  const modelId = String(mapping.modelId || '').trim();
  if (!modelId) throw new Error('Provider/model mapping requires modelId');

  const modelDomain = normalizeModelDomainCategory(mapping.modelDomain);
  if (!modelDomain) throw new Error(`Unknown model domain: ${mapping.modelDomain ?? ''}`);

  return {
    providerId,
    modelId,
    modelDomain,
    version: String(mapping.version || '').trim() || null,
    metadata: mapping.metadata && typeof mapping.metadata === 'object' ? { ...mapping.metadata } : {},
  };
}
