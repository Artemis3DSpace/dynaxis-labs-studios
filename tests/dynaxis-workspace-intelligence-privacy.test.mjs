import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  redactSecretLikeFields,
  assertPublicProjectionHasNoRawSecrets,
} from '../lib/dynaxis/workspace-intelligence/index.js';

test('privacy boundary redacts secret-like fields', () => {
  const payload = {
    actor: { id: 'user_123' },
    token: 'Bearer abc.def.ghi',
    nested: {
      apiKey: 'sk_live_1234567890',
    },
  };

  const { redactedPayload, redactedFields } = redactSecretLikeFields(payload);
  assert.equal(redactedPayload.token, '[REDACTED]');
  assert.equal(redactedPayload.nested.apiKey, '[REDACTED]');
  assert.deepEqual(redactedFields.sort(), ['nested.apiKey', 'token']);
});

test('raw secret-like values rejected where public projection is used', () => {
  assert.throws(
    () =>
      assertPublicProjectionHasNoRawSecrets({
        note: 'ok',
        credentials: 'ghp_abcdefghijklmnop',
      }),
    /secret-like fields/i
  );
});

test('module does not import ProviderConnection or secrets modules', async () => {
  const currentFile = fileURLToPath(import.meta.url);
  const testsDir = path.dirname(currentFile);
  const repoRoot = path.resolve(testsDir, '..');
  const moduleDir = path.join(repoRoot, 'lib', 'dynaxis', 'workspace-intelligence');
  const entries = await fs.readdir(moduleDir);

  for (const entry of entries) {
    if (!entry.endsWith('.js')) continue;
    const content = await fs.readFile(path.join(moduleDir, entry), 'utf8');
    const importLines = content
      .split('\n')
      .filter((line) => line.trim().startsWith('import') || line.trim().startsWith('export * from'));
    const joinedImports = importLines.join('\n').toLowerCase();
    assert.equal(joinedImports.includes('providerconnection'), false, `${entry} imports ProviderConnection`);
    assert.equal(joinedImports.includes('provider-connections'), false, `${entry} imports provider-connections`);
    assert.equal(joinedImports.includes('/secrets'), false, `${entry} imports secrets module`);
    assert.equal(joinedImports.includes('secrets/'), false, `${entry} imports secrets module`);
  }
});
