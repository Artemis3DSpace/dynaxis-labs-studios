import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  validateBuildVerificationGateContract,
  validateDeploymentBoundaryPlaceholder,
  validatePreviewEnvironmentPlaceholder,
  validateRepairLoopContract,
} from '../lib/dynaxis/build-runtime/index.js';

test('verification gate supports pass/fail/blocker', () => {
  const passResult = validateBuildVerificationGateContract({
    gateId: 'gate_lint',
    gateName: 'lint',
    status: 'pass',
    evidence: ['eslint passed'],
  });
  assert.equal(passResult.ok, true);

  const failResult = validateBuildVerificationGateContract({
    gateId: 'gate_test',
    gateName: 'test',
    status: 'fail',
    evidence: ['2 unit tests failed in build-runtime contract suite'],
  });
  assert.equal(failResult.ok, true);

  const blockerResult = validateBuildVerificationGateContract({
    gateId: 'gate_security',
    gateName: 'security-policy',
    status: 'blocker',
    evidence: ['forbidden path attempted in generated package'],
  });
  assert.equal(blockerResult.ok, true);
});

test('repair-loop contract requires failed gate evidence', () => {
  const invalid = validateRepairLoopContract({
    triggerGateId: 'gate_test',
    triggerGateStatus: 'fail',
    failedGateEvidence: [],
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /failedGateEvidence/);

  const valid = validateRepairLoopContract({
    triggerGateId: 'gate_test',
    triggerGateStatus: 'blocker',
    failedGateEvidence: ['smoke tests failed due to forbidden path proposal'],
  });
  assert.equal(valid.ok, true);
});

test('preview/deployment boundary is placeholder only', () => {
  const previewValid = validatePreviewEnvironmentPlaceholder({
    mode: 'placeholder_only',
    previewActions: ['reserve preview slot', 'publish preview metadata only'],
  });
  assert.equal(previewValid.ok, true);

  const deploymentValid = validateDeploymentBoundaryPlaceholder({
    mode: 'placeholder_only',
    productionDeploymentEnabled: false,
  });
  assert.equal(deploymentValid.ok, true);

  const previewInvalid = validatePreviewEnvironmentPlaceholder({ mode: 'live_preview' });
  assert.equal(previewInvalid.ok, false);

  const deploymentInvalid = validateDeploymentBoundaryPlaceholder({
    mode: 'placeholder_only',
    productionDeploymentEnabled: true,
  });
  assert.equal(deploymentInvalid.ok, false);
});

test('build-runtime scaffold has no provider-connections or secrets imports', async () => {
  const root = new URL('../lib/dynaxis/build-runtime/', import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const jsFiles = entries.filter((entry) => String(entry).endsWith('.js'));
  assert.ok(jsFiles.length > 0);

  for (const relativePath of jsFiles) {
    const source = await readFile(new URL(relativePath, root), 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*provider-connections/i);
    assert.doesNotMatch(source, /from\s+['"][^'"]*secrets/i);
    assert.doesNotMatch(source, /import\s*\([^)]*provider-connections/i);
    assert.doesNotMatch(source, /import\s*\([^)]*secrets/i);
  }
});
