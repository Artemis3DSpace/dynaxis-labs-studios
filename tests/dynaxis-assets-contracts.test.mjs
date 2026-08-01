import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateAssetContract,
  validateLicenseMetadata,
  validateAssetCollectionMetadata,
  toPublicAssetProjection,
} from '../lib/dynaxis/assets/index.js';

function createValidAsset() {
  return {
    id: 'asset.logo.primary',
    kind: 'image',
    title: 'Primary Product Logo',
    description: 'Default logo asset for product surfaces.',
    tags: ['branding', 'logo'],
    media: {
      file: {
        sourceType: 'placeholder',
        mimeType: 'image/png',
        extension: 'png',
        byteSize: 2048,
      },
      details: {
        mediaType: 'image',
        width: 1200,
        height: 630,
        colorSpace: 'srgb',
      },
    },
    provenance: {
      source: 'curated',
      sourceId: 'asset-catalog-v1',
      capturedAt: '2026-08-01T19:40:00.000+01:00',
      capturedBy: 'dynaxis-assets-team',
    },
    usage: {
      scope: 'workspace',
      intents: ['render'],
      allowedContexts: ['composer.timeline', 'design-system.component'],
    },
    license: {
      license: 'CC-BY-4.0',
      usageRights: 'commercial',
      derivativeRights: 'allowed',
      attributionRequired: true,
      redistributionAllowed: true,
    },
    metadata: {
      theme: 'default',
      slot: 'branding.logo.primary',
    },
  };
}

test('valid asset metadata passes', () => {
  const result = validateAssetContract(createValidAsset());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('asset requires id, kind, title, provenance, and media metadata', () => {
  const result = validateAssetContract({
    ...createValidAsset(),
    id: '',
    kind: undefined,
    title: '',
    provenance: undefined,
    media: undefined,
  });
  assert.equal(result.ok, false);
  const details = JSON.stringify(result.issues);
  assert.match(details, /id/i);
  assert.match(details, /kind/i);
  assert.match(details, /title/i);
  assert.match(details, /provenance/i);
  assert.match(details, /media/i);
});

test('licence metadata validates allowed values', () => {
  const valid = validateLicenseMetadata({
    license: 'CC0-1.0',
    usageRights: 'commercial',
    derivativeRights: 'allowed',
    attributionRequired: false,
    redistributionAllowed: true,
  });
  assert.equal(valid.ok, true);

  const invalid = validateLicenseMetadata({
    license: 'GPL-3.0',
    usageRights: 'commercial',
  });
  assert.equal(invalid.ok, false);
});

test('collection contract requires stable id and item references', () => {
  const valid = validateAssetCollectionMetadata({
    id: 'collection_branding.hero_assets',
    kind: 'moodboard',
    title: 'Brand Hero Assets',
    provenance: {
      source: 'curated',
      sourceId: 'board-v2',
      capturedAt: '2026-08-01T19:40:00.000+01:00',
      capturedBy: 'design-ops',
    },
    itemReferences: [{ assetId: 'asset.logo.primary', rank: 0 }],
  });
  assert.equal(valid.ok, true);

  const invalid = validateAssetCollectionMetadata({
    id: 'unstable',
    kind: 'moodboard',
    title: 'Broken',
    provenance: {
      source: 'curated',
      sourceId: 'board-v2',
      capturedAt: '2026-08-01T19:40:00.000+01:00',
      capturedBy: 'design-ops',
    },
    itemReferences: [],
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /stable|prefixed|itemReferences/i);
});

test('public projection redacts secret-like fields', () => {
  const projected = toPublicAssetProjection({
    id: 'asset.a',
    metadata: {
      token: 'sk-live-secret-token',
      safe: 'visible',
    },
    apiKeyHint: 'abc',
  });

  assert.equal(projected.metadata.token, '[REDACTED]');
  assert.equal(projected.metadata.safe, 'visible');
  assert.equal(projected.apiKeyHint, '[REDACTED]');
});

test('raw secret-like values rejected', () => {
  const result = validateAssetContract({
    ...createValidAsset(),
    metadata: {
      providerConnectionId: 'pc_123',
      accessToken: 'xoxb-super-secret',
    },
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /secret-like/i);
});

test('module does not import ProviderConnection or secrets modules', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const assetsDir = join(currentDir, '../lib/dynaxis/assets');
  const files = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  const forbidden = /(provider-?connection|ProviderConnection|\/secrets(?:\/|\.))/i;

  for (const file of files) {
    const content = readFileSync(join(assetsDir, file), 'utf8');
    assert.equal(forbidden.test(content), false, `${file} imported forbidden module references`);
  }
});
