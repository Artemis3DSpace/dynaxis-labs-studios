/**
 * Phase 7G resolver contract placeholders.
 * No routing implementation is provided in this scaffold.
 */

import { normalizeCapabilityName } from './taxonomy.js';
import { validateProviderModelMappingContract } from './model-domain.js';

export const RESOLVER_DECISION_STATES = /** @type {const} */ ([
  'selected',
  'fallback_selected',
  'denied',
  'unresolved',
]);

/**
 * Placeholder contract for cost/latency/quality metadata.
 *
 * @param {unknown} metadata
 */
export function validateModelSignalContract(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Model signal metadata must be an object');
  }

  const hasLatency = metadata.latencyMs == null || Number.isFinite(Number(metadata.latencyMs));
  const hasCost = metadata.costPerUnit == null || Number.isFinite(Number(metadata.costPerUnit));
  const hasQuality = metadata.qualityScore == null || Number.isFinite(Number(metadata.qualityScore));

  if (!hasLatency || !hasCost || !hasQuality) {
    throw new Error('Model signal metadata must provide numeric cost/latency/quality fields');
  }

  return {
    latencyMs: metadata.latencyMs == null ? null : Number(metadata.latencyMs),
    costPerUnit: metadata.costPerUnit == null ? null : Number(metadata.costPerUnit),
    qualityScore: metadata.qualityScore == null ? null : Number(metadata.qualityScore),
    availability: metadata.availability == null ? null : String(metadata.availability).trim().toLowerCase(),
  };
}

/**
 * Placeholder contract for capability resolver decisions.
 *
 * @param {unknown} decision
 */
export function validateResolverDecisionContract(decision) {
  if (!decision || typeof decision !== 'object') {
    throw new Error('Resolver decision must be an object');
  }
  const capability = normalizeCapabilityName(decision.capability);
  if (!capability) throw new Error('Resolver decision requires capability');

  const state = String(decision.state || '')
    .trim()
    .toLowerCase();
  if (!RESOLVER_DECISION_STATES.includes(state)) {
    throw new Error(`Unknown resolver decision state: ${decision.state ?? ''}`);
  }

  return {
    capability,
    state,
    providerModel: decision.providerModel
      ? validateProviderModelMappingContract(decision.providerModel)
      : null,
    signals: decision.signals ? validateModelSignalContract(decision.signals) : null,
    reason: String(decision.reason || '').trim() || null,
  };
}
