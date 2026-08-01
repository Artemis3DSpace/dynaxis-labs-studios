import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  searchableLibraryIndexSchema,
  validateSearchFilters,
} from '../lib/dynaxis/template-library/index.js';

test('search contract accepts query/category/tags filters', () => {
  const result = validateSearchFilters({
    query: 'crm dashboard',
    category: 'saas',
    tags: ['dashboard', 'analytics'],
    capabilityIds: ['app.analytics.widgets'],
  });
  assert.equal(result.ok, true);
});

test('search contract rejects secret-like query input', () => {
  const result = validateSearchFilters({
    query: 'use bearer sk-secret-token',
  });
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.issues), /secret-like/i);
});

test('searchable library index contract validates entries', () => {
  const parsed = searchableLibraryIndexSchema.safeParse({
    indexVersion: '1.0.0',
    entries: [
      {
        id: 'tpl.crm.dashboard',
        kind: 'template',
        title: 'CRM Dashboard Template',
        category: 'saas',
        tags: ['dashboard'],
        capabilityIds: ['app.analytics.widgets'],
        version: '1.2.3',
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test('module does not import ProviderConnection or secrets modules', async () => {
  const root = new URL('../lib/dynaxis/template-library/', import.meta.url);
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
