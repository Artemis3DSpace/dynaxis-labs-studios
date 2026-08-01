import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateExportRequest,
  validatePublishTargetPlaceholder,
  validateArtifactManifestPlaceholder,
} from '../lib/dynaxis/publish/index.js';

function createValidExportRequest() {
  return {
    mode: 'contract_only',
    requestId: 'exp_req_01',
    packageId: 'pkg.crm.dashboard',
    packageVersion: '1.2.3',
    formatCategory: 'app_ir_bundle',
    requestedByWorkspaceId: 'workspace_01',
    initiatedAt: '2026-08-01T18:30:00.000+01:00',
    provenance: {
      source: 'manual',
      sourceId: 'publish-console',
      capturedAt: '2026-08-01T18:30:00.000+01:00',
      capturedBy: 'dynaxis-operator',
    },
    options: {
      includePreviewAssets: false,
    },
  };
}

test('valid export request passes', () => {
  const result = validateExportRequest(createValidExportRequest());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('invalid export format rejected', () => {
  const result = validateExportRequest({
    ...createValidExportRequest(),
    formatCategory: 'binary_dump',
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /formatCategory/);
});

test('publish target contract supports placeholder targets only', () => {
  const valid = validatePublishTargetPlaceholder({
    targetId: 'target_gh_release',
    targetType: 'github_release',
    mode: 'placeholder_only',
    executionEnabled: false,
  });
  assert.equal(valid.ok, true);

  const invalid = validatePublishTargetPlaceholder({
    targetId: 'target_live',
    targetType: 'github_release',
    mode: 'live_execution',
    executionEnabled: true,
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /mode|executionEnabled/);
});

test('artifact manifest requires stable id, type, and provenance', () => {
  const invalid = validateArtifactManifestPlaceholder({
    manifestId: 'manifest_01',
    mode: 'placeholder_only',
    generatedAt: '2026-08-01T18:30:00.000+01:00',
    entries: [
      {
        artifactId: 'artifact_01',
      },
    ],
  });
  assert.equal(invalid.ok, false);
  const details = JSON.stringify(invalid.issues);
  assert.match(details, /stableId/);
  assert.match(details, /type/);
  assert.match(details, /provenance/);
});
