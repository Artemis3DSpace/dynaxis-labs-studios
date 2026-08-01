import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_USAGE_CONTEXTS,
  validateAssetUsageReference,
  usageMetadataSchema,
  provenanceMetadataSchema,
} from '../lib/dynaxis/assets/index.js';

test('asset reference requires asset id and usage context', () => {
  const valid = validateAssetUsageReference({
    assetId: 'asset.logo.primary',
    usageContext: 'composer.clip',
    consumerId: 'clip_hero_001',
    slot: 'main-visual',
  });
  assert.equal(valid.ok, true);

  const invalid = validateAssetUsageReference({
    assetId: '',
    consumerId: 'clip_hero_001',
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /assetId|usageContext/i);
});

test('usage contexts include composer, design system, template library, and app ir boundaries', () => {
  assert.ok(ASSET_USAGE_CONTEXTS.includes('composer.timeline'));
  assert.ok(ASSET_USAGE_CONTEXTS.includes('design-system.component'));
  assert.ok(ASSET_USAGE_CONTEXTS.includes('template-library.template'));
  assert.ok(ASSET_USAGE_CONTEXTS.includes('app-ir.asset-slot'));
});

test('usage and provenance schemas validate nominal values', () => {
  const usage = usageMetadataSchema.safeParse({
    scope: 'project',
    intents: ['render', 'preview'],
    allowedContexts: ['composer.timeline', 'template-library.package'],
  });
  assert.equal(usage.success, true);

  const provenance = provenanceMetadataSchema.safeParse({
    source: 'import',
    sourceId: 'batch-2026-08-01',
    capturedAt: '2026-08-01T19:40:00.000+01:00',
    capturedBy: 'dynaxis-ingestion',
  });
  assert.equal(provenance.success, true);
});
