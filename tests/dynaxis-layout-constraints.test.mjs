import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateConstraintRule,
  validateGridTracks,
  validateLayoutMetadata,
} from '../lib/dynaxis/layout/index.js';

function buildBaseLayoutMetadata() {
  return {
    breakpointSet: {
      name: 'default',
      breakpoints: [
        { name: 'mobile', minWidth: 0, maxWidth: 767 },
        { name: 'desktop', minWidth: 768, maxWidth: null },
      ],
    },
    spacingTokens: { xs: 4, sm: 8, md: 16 },
    containers: [{ id: 'container-main', mode: 'stack' }],
    grids: [{ columns: 12, rows: 6, tracks: [{ axis: 'columns', type: 'fr' }] }],
    visibilityRules: [{ componentId: 'cmp-card', visibleAt: ['mobile', 'desktop'] }],
    components: [{ componentId: 'cmp-card', mode: 'stack', constraints: [] }],
  };
}

test('grid with invalid columns is rejected', () => {
  const result = validateGridTracks({ columns: 0, rows: 6, tracks: [] });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'grid.columns'));
});

test('component constraints require target component id', () => {
  const result = validateConstraintRule({ type: 'align', mode: 'row' });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'constraintRule.targetComponentId'));
});

test('layout metadata cannot contain raw secret values', () => {
  const metadata = buildBaseLayoutMetadata();
  metadata.components[0].extra = { apiKey: 'raw-value-123' };

  const result = validateLayoutMetadata(metadata);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.message.includes('raw secret-like values')));
});

test('layout module does not import ProviderConnection or secrets modules', async () => {
  const layoutIndex = await readFile(new URL('../lib/dynaxis/layout/index.js', import.meta.url), 'utf8');
  const layoutValidation = await readFile(
    new URL('../lib/dynaxis/layout/layout-validation.js', import.meta.url),
    'utf8'
  );
  const combinedSource = `${layoutIndex}\n${layoutValidation}`;
  assert.equal(combinedSource.includes('provider-connections'), false);
  assert.equal(combinedSource.includes('/secrets/'), false);
  assert.equal(combinedSource.includes('lib/dynaxis/secrets'), false);
});
