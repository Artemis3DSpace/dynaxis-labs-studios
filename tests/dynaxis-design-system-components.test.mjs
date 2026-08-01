import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDesignSystemValidationResult,
  validateComponentDefinitionContract,
  validateComponentVariantContract,
} from '../lib/dynaxis/design-system/index.js';

test('component contract requires id, name, category, and slots', () => {
  const result = validateComponentDefinitionContract({});
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((entry) => /component id is required/i.test(entry.message)));
  assert.ok(result.issues.some((entry) => /component name is required/i.test(entry.message)));
  assert.ok(result.issues.some((entry) => /category must be one of/i.test(entry.message)));
  assert.ok(result.issues.some((entry) => /component slots are required/i.test(entry.message)));
});

test('variant contract requires valid component id', () => {
  const result = validateComponentVariantContract(
    {
      id: 'button.primary',
      componentId: 'missing.component',
      name: 'Primary',
    },
    ['button.base']
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((entry) => /unknown component id/i.test(entry.message)));
});

test('design-system validation result exposes pass/fail status', () => {
  const passResult = createDesignSystemValidationResult(true, []);
  assert.equal(passResult.status, 'pass');
  assert.equal(passResult.ok, true);

  const failResult = createDesignSystemValidationResult(false, [{ path: 'x', message: 'bad' }]);
  assert.equal(failResult.status, 'fail');
  assert.equal(failResult.ok, false);
  assert.equal(failResult.issues.length, 1);
});
