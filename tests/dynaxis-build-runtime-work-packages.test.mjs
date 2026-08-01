import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGeneratedWorkPackageContract,
  validateGitHubBranchManagementPlaceholder,
  validateRepositoryBootstrapRequestPlaceholder,
} from '../lib/dynaxis/build-runtime/index.js';

function createValidWorkPackage() {
  return {
    phase: '8B',
    title: 'Scaffold build runtime contracts',
    scope: {
      summary: 'Define side-effect free build runtime contracts and boundaries.',
      deliverables: ['contract files', 'validation tests'],
    },
    allowedPaths: ['lib/dynaxis/build-runtime/**', 'tests/dynaxis-build-runtime-*.test.mjs'],
    forbiddenPaths: ['lib/dynaxis/provider-connections/**', 'lib/dynaxis/secrets/**'],
  };
}

test('generated work package requires phase/title/scope/allowed paths', () => {
  const invalid = validateGeneratedWorkPackageContract({
    title: '',
    scope: {},
    allowedPaths: [],
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /phase/);
  assert.match(JSON.stringify(invalid.issues), /title/);
  assert.match(JSON.stringify(invalid.issues), /scope/);
  assert.match(JSON.stringify(invalid.issues), /allowedPaths/);

  const valid = validateGeneratedWorkPackageContract(createValidWorkPackage());
  assert.equal(valid.ok, true);
});

test('generated work package rejects forbidden paths', () => {
  const invalid = validateGeneratedWorkPackageContract({
    ...createValidWorkPackage(),
    allowedPaths: [
      'lib/dynaxis/build-runtime/**',
      'lib/dynaxis/provider-connections/**',
    ],
  });

  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /forbidden path/);
});

test('repository bootstrap contract rejects missing target repository', () => {
  const invalid = validateRepositoryBootstrapRequestPlaceholder({
    mode: 'placeholder_only',
    baseMainSha: '39ba97531c1eb7a33835bcd30a0d75a2ee68f30a',
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /targetRepository/);

  const valid = validateRepositoryBootstrapRequestPlaceholder({
    mode: 'placeholder_only',
    targetRepository: { owner: 'dynaxis-labs', name: 'build-runtime-scaffold' },
    baseMainSha: '39ba97531c1eb7a33835bcd30a0d75a2ee68f30a',
  });
  assert.equal(valid.ok, true);
});

test('github branch-management contract is placeholder only', () => {
  const valid = validateGitHubBranchManagementPlaceholder({
    mode: 'placeholder_only',
    requestedBranchName: 'scaffold/phase-8b-build-runtime',
    baseRef: 'origin/main',
  });
  assert.equal(valid.ok, true);

  const invalid = validateGitHubBranchManagementPlaceholder({
    mode: 'live_api',
    requestedBranchName: 'feature/live',
    baseRef: 'origin/main',
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /placeholder only/);
});
