import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBreakpointSet,
  validateResponsiveVisibilityRules,
  validateViewportRange,
} from '../lib/dynaxis/layout/index.js';

function buildValidBreakpointSet() {
  return {
    name: 'default',
    breakpoints: [
      { name: 'mobile', minWidth: 0, maxWidth: 767 },
      { name: 'tablet', minWidth: 768, maxWidth: 1023 },
      { name: 'desktop', minWidth: 1024, maxWidth: null },
    ],
  };
}

test('valid breakpoint set passes', () => {
  const result = validateBreakpointSet(buildValidBreakpointSet());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('overlapping breakpoints are rejected', () => {
  const result = validateBreakpointSet({
    name: 'overlap',
    breakpoints: [
      { name: 'mobile', minWidth: 0, maxWidth: 900 },
      { name: 'tablet', minWidth: 768, maxWidth: 1023 },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.message.includes('overlap')));
});

test('invalid viewport range is rejected', () => {
  const result = validateViewportRange({ minWidth: 1024, maxWidth: 768 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'range'));
});

test('responsive visibility rules validate breakpoint names', () => {
  const rules = [
    { componentId: 'cmp-hero', visibleAt: ['mobile', 'tablet'] },
    { componentId: 'cmp-footer', visibleAt: ['desktop', 'tv'] },
  ];
  const result = validateResponsiveVisibilityRules(rules, ['mobile', 'tablet', 'desktop']);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'visibilityRules[1].visibleAt[1]'));
});
