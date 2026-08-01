import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  createPublicProjection,
  validateValidationGateContract,
  validatePublishExportValidationResult,
  assertNoRawSecretLikeValues,
} from '../lib/dynaxis/publish/index.js';

test('validation gate supports pass/fail/blocker', () => {
  const pass = validateValidationGateContract({
    gateId: 'gate_contract_schema',
    gateName: 'contract-schema',
    status: 'pass',
    evidence: ['publish schema parsed successfully'],
  });
  assert.equal(pass.ok, true);

  const fail = validateValidationGateContract({
    gateId: 'gate_boundary',
    gateName: 'boundary-check',
    status: 'fail',
    evidence: ['forbidden path listed in allowed paths'],
  });
  assert.equal(fail.ok, true);

  const blocker = validateValidationGateContract({
    gateId: 'gate_security',
    gateName: 'secret-scan',
    status: 'blocker',
    evidence: ['secret-like token detected in payload'],
  });
  assert.equal(blocker.ok, true);
});

test('public projection redacts secret-like fields', () => {
  const projected = createPublicProjection({
    packageId: 'pkg.crm.dashboard',
    metadata: {
      apiKey: 'sk-top-secret',
      nested: {
        authorization: 'Bearer super-sensitive',
      },
      safeValue: 'visible',
    },
  });

  assert.equal(projected.metadata.apiKey, '[REDACTED]');
  assert.equal(projected.metadata.nested.authorization, '[REDACTED]');
  assert.equal(projected.metadata.safeValue, 'visible');
});

test('raw secret-like values rejected', () => {
  assert.throws(
    () =>
      assertNoRawSecretLikeValues({
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
    /secret-like/i
  );
});

test('publish/export validation result contract validates projection and gates', () => {
  const valid = validatePublishExportValidationResult({
    requestId: 'exp_req_01',
    status: 'pass',
    gates: [
      {
        gateId: 'gate_contract_schema',
        gateName: 'contract-schema',
        status: 'pass',
        evidence: ['validated'],
      },
    ],
    issues: [],
    publicProjection: {
      packageId: 'pkg.crm.dashboard',
      publishTarget: 'target_gh_release',
    },
  });
  assert.equal(valid.ok, true);

  const invalid = validatePublishExportValidationResult({
    requestId: 'exp_req_01',
    status: 'fail',
    gates: [
      {
        gateId: 'gate_contract_schema',
        gateName: 'contract-schema',
        status: 'fail',
        evidence: ['failed check'],
      },
    ],
    issues: [],
    publicProjection: {
      secretToken: 'sk-unsafe',
    },
  });
  assert.equal(invalid.ok, false);
  assert.match(JSON.stringify(invalid.issues), /secret-like/i);
});

test('publish scaffold has no provider-connections or secrets imports', async () => {
  const root = new URL('../lib/dynaxis/publish/', import.meta.url);
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
