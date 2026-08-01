import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateColorTokenReference,
  validateDesignTokenSet,
  validateThemeContract,
} from '../lib/dynaxis/design-system/index.js';

test('valid token set passes', () => {
  const result = validateDesignTokenSet({
    color: [
      { name: 'primary.500', value: '#3366ff' },
      { name: 'text.default', value: '#111827' },
    ],
    spacing: [{ name: 'scale.4', value: '16px' }],
    typography: [{ name: 'body.md', value: '16px/24px Inter' }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('duplicate token names rejected', () => {
  const result = validateDesignTokenSet({
    color: [
      { name: 'primary.500', value: '#3366ff' },
      { name: 'primary.500', value: '#274bdb' },
    ],
    spacing: [{ name: 'scale.4', value: '16px' }],
    typography: [{ name: 'body.md', value: '16px/24px Inter' }],
  });
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /duplicate token name/i);
});

test('invalid token reference rejected', () => {
  const tokenResult = validateDesignTokenSet({
    color: [{ name: 'primary.500', value: '#3366ff' }],
    spacing: [{ name: 'scale.4', value: '16px' }],
    typography: [{ name: 'body.md', value: '16px/24px Inter' }],
  });

  const refResult = validateColorTokenReference('color.missing.500', tokenResult.tokenIndex);
  assert.equal(refResult.ok, false);
  assert.match(refResult.issues[0].message, /unknown token reference/i);
});

test('theme requires token references', () => {
  const result = validateThemeContract({
    id: 'theme.light',
    name: 'Light',
  });
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /requires token references/i);
});
