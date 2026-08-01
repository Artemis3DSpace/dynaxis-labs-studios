import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCapabilityName,
  validateProviderModelMappingContract,
  validateResolverDecisionContract,
} from '../lib/dynaxis/capabilities/index.js';

test('capability names normalize consistently', () => {
  assert.equal(normalizeCapabilityName(' Text To Image '), 'text-to-image');
  assert.equal(normalizeCapabilityName('text_to_image'), 'text-to-image');
  assert.equal(normalizeCapabilityName('Text---To___Image'), 'text-to-image');
  assert.equal(normalizeCapabilityName('!bad!'), null);
});

test('model-domain contract rejects unknown provider mappings', () => {
  assert.throws(
    () =>
      validateProviderModelMappingContract({
        providerId: 'unknown-provider',
        modelId: 'model-x',
        modelDomain: 'image_generation',
      }),
    /Unknown provider mapping/
  );

  const parsed = validateProviderModelMappingContract({
    providerId: 'muapi',
    modelId: 'flux-pro',
    modelDomain: 'image_generation',
  });
  assert.equal(parsed.providerId, 'muapi');
});

test('resolver contract accepts placeholders only with valid contract fields', () => {
  const parsed = validateResolverDecisionContract({
    capability: 'text_to_image',
    state: 'selected',
    providerModel: {
      providerId: 'muapi',
      modelId: 'flux-pro',
      modelDomain: 'image_generation',
    },
    signals: {
      latencyMs: 1400,
      costPerUnit: 0.04,
      qualityScore: 0.9,
      availability: 'high',
    },
  });
  assert.equal(parsed.capability, 'text-to-image');
  assert.equal(parsed.state, 'selected');
});
