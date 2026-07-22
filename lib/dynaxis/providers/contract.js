/**
 * Canonical server-side GenerationProvider contract.
 */

import { z } from 'zod';
import { normalizeProviderId } from '../types.js';
import { normalizeCapabilityList } from './capabilities.js';
import { safeProviderPayload } from './common.js';

export const providerFeaturesSchema = z
  .object({
    submit: z.boolean().default(true),
    retrieve: z.boolean().default(true),
    cancel: z.boolean().default(false),
    webhooks: z.boolean().default(false),
    uploads: z.boolean().default(false),
    modelDiscovery: z.boolean().default(false),
    costEstimation: z.boolean().default(false),
  })
  .default({});

export const providerMetadataSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    capabilities: z.array(z.string()).default([]),
    features: providerFeaturesSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .default({});

/**
 * @typedef {Object} GenerationProvider
 * @property {string} providerId
 * @property {(input: unknown) => Promise<unknown>} submit
 * @property {(input: unknown) => Promise<unknown>} retrieve
 * @property {(input: unknown) => Promise<unknown>} cancel
 * @property {Record<string, unknown>} [metadata]
 * @property {Record<string, boolean>} [features]
 * @property {string[]} [capabilities]
 */

/**
 * @param {unknown} provider
 * @returns {GenerationProvider}
 */
export function validateGenerationProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw Object.assign(new Error('Generation provider registration must be an object'), {
      code: 'PROVIDER_REGISTRATION_INVALID',
      status: 500,
    });
  }
  const providerId = normalizeProviderId(provider.providerId);
  if (!providerId) {
    throw Object.assign(new Error('Generation provider requires a canonical providerId'), {
      code: 'PROVIDER_REGISTRATION_INVALID',
      status: 500,
    });
  }
  for (const method of ['submit', 'retrieve', 'cancel']) {
    if (typeof provider[method] !== 'function') {
      throw Object.assign(new Error(`Generation provider ${providerId} missing ${method}()`), {
        code: 'PROVIDER_REGISTRATION_INVALID',
        providerId,
        status: 500,
      });
    }
  }
  return /** @type {GenerationProvider} */ (provider);
}

/**
 * @param {GenerationProvider} provider
 */
export function describeGenerationProvider(provider) {
  const parsed = providerMetadataSchema.parse({
    displayName: provider.metadata?.displayName,
    description: provider.metadata?.description,
    capabilities: provider.capabilities || provider.metadata?.capabilities || [],
    features: provider.features || provider.metadata?.features || {},
    metadata: provider.metadata?.metadata || {},
  });
  return Object.freeze({
    providerId: provider.providerId,
    displayName: parsed.displayName || provider.providerId,
    description: parsed.description || null,
    capabilities: normalizeCapabilityList(parsed.capabilities),
    features: Object.freeze({ ...providerFeaturesSchema.parse(parsed.features) }),
    metadata: Object.freeze(safeProviderPayload(parsed.metadata)),
  });
}
