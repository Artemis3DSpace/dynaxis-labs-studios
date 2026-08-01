import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  validateAccessibilityMetadataContract,
  validateAssetReferenceContract,
} from '../lib/dynaxis/design-system/index.js';

async function listJsFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await listJsFiles(absolutePath);
      files.push(...nestedFiles);
    } else if (entry.isFile() && absolutePath.endsWith('.js')) {
      files.push(absolutePath);
    }
  }
  return files;
}

test('accessibility contract requires meaningful label and role metadata', () => {
  const invalid = validateAccessibilityMetadataContract({ role: 'button', label: ' ' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((entry) => /meaningful label/i.test(entry.message)));

  const valid = validateAccessibilityMetadataContract({ role: 'button', ariaLabel: 'Open menu' });
  assert.equal(valid.ok, true);
});

test('asset contract rejects raw secret-like values', () => {
  const invalid = validateAssetReferenceContract({
    id: 'icon.lock',
    kind: 'icon',
    uri: 'https://assets.example/icon.svg?token=super-secret-token',
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((entry) => /secret-like/i.test(entry.message)));
});

test('module does not import ProviderConnection or secrets modules', async () => {
  const basePath = path.resolve(process.cwd(), 'lib/dynaxis/design-system');
  const files = await listJsFiles(basePath);
  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    assert.equal(/provider-connections/i.test(source), false);
    assert.equal(/from\s+['"][^'"]*secrets[^'"]*['"]/.test(source), false);
  }
});
