import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_TEMPLATE_LICENSES,
  licenseMetadataSchema,
  requiredCapabilityReferenceSchema,
  templateMetadataSchema,
  validateTemplateMetadata,
} from '../lib/dynaxis/template-library/index.js';

function createValidTemplate() {
  return {
    id: 'tpl.crm.dashboard',
    title: 'CRM Dashboard Template',
    summary: 'Starter template for CRM dashboards with role-aware cards.',
    category: 'saas',
    version: '1.2.3',
    tags: ['dashboard', 'crm'],
    provenance: {
      source: 'curated',
      sourceId: 'catalog-v1',
      capturedAt: '2026-08-01T16:00:00.000+01:00',
      capturedBy: 'dynaxis-template-team',
    },
    requiredCapabilities: [
      {
        capabilityId: 'app.analytics.widgets',
        minimumLevel: 'required',
        rationale: 'Dashboard KPI modules need analytics widgets.',
      },
    ],
    designSystemCompatibility: {
      designSystemId: 'dynaxis-design-system',
      compatibilityLevel: 'token_compatible',
      minimumDesignSystemVersion: '1.0.0',
      requiredTokens: ['color.primary.500', 'space.4'],
    },
    layoutCompatibility: {
      layoutModel: 'auto_layout_v1',
      supportedBreakpoints: ['mobile', 'desktop'],
    },
    appPack: {
      packId: 'pack.crm.dashboard',
      entryTemplateId: 'tpl.crm.dashboard',
      includedTemplateIds: ['tpl.crm.dashboard'],
      assets: ['asset.theme.default'],
    },
  };
}

test('valid template metadata passes', () => {
  const result = validateTemplateMetadata(createValidTemplate());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('template requires id, title, category, version, and provenance', () => {
  const result = validateTemplateMetadata({
    ...createValidTemplate(),
    id: '',
    title: '',
    category: undefined,
    version: '',
    provenance: undefined,
  });
  assert.equal(result.ok, false);
  const details = JSON.stringify(result.issues);
  assert.match(details, /id/i);
  assert.match(details, /title/i);
  assert.match(details, /category/i);
  assert.match(details, /version/i);
  assert.match(details, /provenance/i);
});

test('invalid semantic version rejected', () => {
  const result = validateTemplateMetadata({
    ...createValidTemplate(),
    version: 'v1',
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /semantic version/i);
});

test('required capability references validate', () => {
  const good = requiredCapabilityReferenceSchema.safeParse({
    capabilityId: 'app.rendering.canvas',
    minimumLevel: 'critical',
    rationale: 'Canvas rendering is required for this template.',
  });
  assert.equal(good.success, true);

  const bad = requiredCapabilityReferenceSchema.safeParse({
    capabilityId: '',
    minimumLevel: 'required',
    rationale: '',
  });
  assert.equal(bad.success, false);
});

test('license metadata validates allowed values', () => {
  const valid = licenseMetadataSchema.safeParse({
    license: 'MIT',
    usage: 'commercial',
    attributionRequired: true,
    redistributionAllowed: true,
  });
  assert.equal(valid.success, true);
  assert.ok(ALLOWED_TEMPLATE_LICENSES.includes('MIT'));

  const invalid = licenseMetadataSchema.safeParse({
    license: 'GPL-3.0',
    usage: 'commercial',
  });
  assert.equal(invalid.success, false);
});

test('raw secret-like values rejected', () => {
  const result = validateTemplateMetadata({
    ...createValidTemplate(),
    customMetadata: {
      deploymentToken: 'sk-super-secret-token',
    },
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /secret-like/i);
});
