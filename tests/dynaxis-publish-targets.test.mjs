import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePackageBoundaryRules,
  validateDeploymentBoundaryPlaceholder,
  validatePublishTargetPlaceholder,
} from '../lib/dynaxis/publish/index.js';

test('package boundary rejects forbidden paths', () => {
  const invalid = validatePackageBoundaryRules({
    packageName: 'dynaxis.publish',
    allowedPaths: [
      'lib/dynaxis/publish/**',
      'lib/dynaxis/provider-connections/**',
    ],
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /forbidden path pattern/i);
});

test('package boundary allows publish-only paths', () => {
  const valid = validatePackageBoundaryRules({
    packageName: 'dynaxis.publish',
    allowedPaths: [
      'lib/dynaxis/publish/**',
      'tests/dynaxis-publish-*.test.mjs',
    ],
  });
  assert.equal(valid.ok, true);
});

test('deployment boundary remains placeholder-only', () => {
  const valid = validateDeploymentBoundaryPlaceholder({
    mode: 'placeholder_only',
    deploymentExecutionEnabled: false,
    publishTargetIds: ['target_gh_release'],
  });
  assert.equal(valid.ok, true);

  const invalid = validateDeploymentBoundaryPlaceholder({
    mode: 'placeholder_only',
    deploymentExecutionEnabled: true,
  });
  assert.equal(invalid.ok, false);
});

test('publish target metadata rejects secret-like fields', () => {
  const invalid = validatePublishTargetPlaceholder({
    targetId: 'target_vercel',
    targetType: 'vercel_deploy',
    mode: 'placeholder_only',
    executionEnabled: false,
    metadata: {
      apiKey: 'sk-live-unsafe',
    },
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /secret-like/i);
});
