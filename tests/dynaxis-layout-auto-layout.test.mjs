import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAutoLayoutIntent } from '../lib/dynaxis/layout/index.js';

function buildSafeAutoLayoutIntent() {
  return {
    mode: 'stack',
    sizeBehavior: {
      width: 'fill',
      height: 'hug',
    },
    frame: {},
    size: {
      width: '100%',
      height: 'auto',
    },
  };
}

test('auto-layout contract accepts constrained-safe values', () => {
  const result = validateAutoLayoutIntent(buildSafeAutoLayoutIntent());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('auto-layout contract rejects unsafe absolute values where constrained layout is required', () => {
  const result = validateAutoLayoutIntent({
    mode: 'row',
    sizeBehavior: {
      width: 'fill',
      height: 'fixed',
    },
    frame: {
      x: 120,
      y: 40,
    },
    size: {
      width: '320px',
      height: '120px',
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'autoLayoutIntent.frame'));
  assert.ok(result.issues.some((issue) => issue.path === 'autoLayoutIntent.size'));
});
