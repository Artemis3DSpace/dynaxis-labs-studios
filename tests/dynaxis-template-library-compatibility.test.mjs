import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appPackContractSchema,
  compatibilityMetadataSchema,
  validateBlueprintPackageMetadata,
} from '../lib/dynaxis/template-library/index.js';

function validCompatibility() {
  return {
    designSystem: {
      designSystemId: 'dynaxis-design-system',
      compatibilityLevel: 'strict',
      minimumDesignSystemVersion: '1.5.0',
      requiredTokens: ['color.primary.500', 'radius.md'],
    },
    layout: {
      layoutModel: 'responsive_constraints_v1',
      supportedBreakpoints: ['mobile', 'tablet', 'desktop'],
      notes: 'Supports all responsive constraints in v1.',
    },
  };
}

test('blueprint package requires compatibility metadata', () => {
  const invalid = validateBlueprintPackageMetadata({
    packageId: 'pkg.crm.core',
    title: 'CRM Core Blueprint',
    version: '1.0.0',
    summary: 'Core CRM foundation blueprint package.',
    license: {
      license: 'MIT',
      usage: 'commercial',
      attributionRequired: false,
      redistributionAllowed: true,
    },
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /compatibility/i);
});

test('blueprint package with compatibility metadata passes', () => {
  const valid = validateBlueprintPackageMetadata({
    packageId: 'pkg.crm.core',
    title: 'CRM Core Blueprint',
    version: '1.0.0',
    summary: 'Core CRM foundation blueprint package.',
    compatibility: validCompatibility(),
    license: {
      license: 'MIT',
      usage: 'commercial',
      attributionRequired: false,
      redistributionAllowed: true,
    },
    appPacks: [
      {
        packId: 'pack.crm.core',
        entryTemplateId: 'tpl.crm.core',
        includedTemplateIds: ['tpl.crm.core', 'tpl.crm.analytics'],
      },
    ],
  });
  assert.equal(valid.ok, true);
});

test('design-system and layout compatibility references validate', () => {
  const parsed = compatibilityMetadataSchema.safeParse(validCompatibility());
  assert.equal(parsed.success, true);

  const invalid = compatibilityMetadataSchema.safeParse({
    designSystem: {
      designSystemId: '',
      compatibilityLevel: 'strict',
      minimumDesignSystemVersion: 'latest',
      requiredTokens: [],
    },
    layout: {
      layoutModel: 'grid-v2',
      supportedBreakpoints: [],
    },
  });
  assert.equal(invalid.success, false);
});

test('app pack contract validates required shape', () => {
  const valid = appPackContractSchema.safeParse({
    packId: 'pack.crm.core',
    entryTemplateId: 'tpl.crm.core',
    includedTemplateIds: ['tpl.crm.core'],
    assets: ['asset.icon.crm'],
  });
  assert.equal(valid.success, true);

  const invalid = appPackContractSchema.safeParse({
    packId: '',
    entryTemplateId: '',
    includedTemplateIds: [],
  });
  assert.equal(invalid.success, false);
});
