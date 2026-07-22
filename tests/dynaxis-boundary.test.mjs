/**
 * Phase 5D — server/client module boundary + dev-runtime configuration tests.
 *
 * Verifies (reliably, via real dependency-graph traversal + runtime checks) that:
 *   - the client entrypoint graph never reaches server-only code
 *     (node:crypto, drizzle/postgres, db client, ownership, `server-only`);
 *   - server-only modules are actually guarded and throw when imported outside
 *     the server layer;
 *   - the normal `dev` script does not force Watchpack/Chokidar polling or a
 *     large heap, while explicit fallbacks do.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const LIB = resolve(ROOT, 'lib/dynaxis');

// ── minimal ESM dependency-graph walker ──────────────────────────────────────

const SPEC_RE =
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelative(fromFile, spec) {
  let p = resolve(dirname(fromFile), spec);
  if (existsSync(p) && statSync(p).isDirectory()) p = resolve(p, 'index.js');
  else if (!existsSync(p) && existsSync(`${p}.js`)) p = `${p}.js`;
  return p;
}

function walkGraph(entryFile) {
  const files = new Set();
  const bare = new Set();
  const visited = new Set();
  const stack = [entryFile];
  while (stack.length) {
    const file = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!existsSync(file) || statSync(file).isDirectory()) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    SPEC_RE.lastIndex = 0;
    let m;
    while ((m = SPEC_RE.exec(src))) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      if (spec.startsWith('.')) stack.push(resolveRelative(file, spec));
      else bare.add(spec);
    }
  }
  return { files, bare };
}

// ── client boundary ──────────────────────────────────────────────────────────

test('client entrypoint graph never reaches server-only packages', () => {
  const { bare } = walkGraph(resolve(LIB, 'client.js'));
  for (const forbidden of ['server-only', 'node:crypto', 'crypto', 'drizzle-orm', 'postgres']) {
    assert.ok(
      !bare.has(forbidden),
      `client graph must not import "${forbidden}"`,
    );
  }
});

test('client entrypoint graph never includes server-only files', () => {
  const { files } = walkGraph(resolve(LIB, 'client.js'));
  const forbiddenFiles = [
    'ownership.js',
    'platform.js',
    'api.js',
    'server.js',
    'db/client.js',
    'db/store.js',
    'db/memory-store.js',
  ];
  for (const rel of forbiddenFiles) {
    const abs = resolve(LIB, rel);
    assert.ok(!files.has(abs), `client graph must not include ${rel}`);
  }
  // sanity: it should include known client-safe modules
  assert.ok(files.has(resolve(LIB, 'characters/consumer.js')));
  assert.ok(files.has(resolve(LIB, 'products/consumer.js')));
  assert.ok(files.has(resolve(LIB, 'brands/consumer.js')));
  assert.ok(files.has(resolve(LIB, 'campaigns/consumer.js')));
  assert.ok(files.has(resolve(LIB, 'compositions/consumer.js')));
  assert.ok(files.has(resolve(LIB, 'templates/index.js')));
  assert.ok(files.has(resolve(LIB, 'templates/document.js')));
  assert.ok(files.has(resolve(LIB, 'templates/binding.js')));
  assert.ok(files.has(resolve(LIB, 'templates/adapt.js')));
  assert.ok(files.has(resolve(LIB, 'components/document.js')));
  assert.ok(files.has(resolve(LIB, 'components/properties.js')));
  assert.ok(files.has(resolve(LIB, 'components/resolver.js')));
  assert.ok(files.has(resolve(LIB, 'components/preview.js')));
  assert.ok(files.has(resolve(LIB, 'design-systems/document.js')));
  assert.ok(files.has(resolve(LIB, 'design-systems/resolver.js')));
  assert.ok(files.has(resolve(LIB, 'design-systems/bindings.js')));
  assert.ok(files.has(resolve(LIB, 'component-sets/variants.js')));
  assert.ok(files.has(resolve(LIB, 'design-agent/operations.js')));
  assert.ok(files.has(resolve(LIB, 'design-agent/context.js')));
  assert.ok(files.has(resolve(LIB, 'marketing/source-context.js')));
  assert.ok(files.has(resolve(LIB, 'client/platform-api.js')));
  assert.ok(!files.has(resolve(LIB, 'brands/scraper.js')));
  assert.ok(!files.has(resolve(LIB, 'brands/analyzer.js')));
  assert.ok(!files.has(resolve(LIB, 'brands/url-security.js')));
  assert.ok(!files.has(resolve(LIB, 'services/campaigns.js')));
  assert.ok(!files.has(resolve(LIB, 'services/compositions.js')));
  assert.ok(!files.has(resolve(LIB, 'services/templates.js')));
  assert.ok(!files.has(resolve(LIB, 'services/components.js')));
  assert.ok(!files.has(resolve(LIB, 'services/design-systems.js')));
  assert.ok(!files.has(resolve(LIB, 'services/component-sets.js')));
  assert.ok(!files.has(resolve(LIB, 'services/design-agent.js')));
  assert.ok(!files.has(resolve(LIB, 'compositions/asset-fetch.js')));
  assert.ok(!files.has(resolve(LIB, 'compositions/render-export.js')));
  assert.ok(!files.has(resolve(LIB, 'compositions/svg-renderer.js')));
  assert.ok(!files.has(resolve(LIB, 'storage/blob-store.js')));
  assert.ok(!files.has(resolve(LIB, 'storage/s3-blob-store.js')));
  assert.ok(!files.has(resolve(LIB, 'storage/png-validate.js')));
  assert.ok(!files.has(resolve(LIB, 'storage/register-rendered.js')));
});

test('index.js barrel is a client-safe alias of client.js', () => {
  const { bare } = walkGraph(resolve(LIB, 'index.js'));
  for (const forbidden of ['server-only', 'node:crypto', 'drizzle-orm', 'postgres']) {
    assert.ok(!bare.has(forbidden), `index barrel must not import "${forbidden}"`);
  }
});

test('mini-apps SDK entry graph is client-safe', () => {
  const { bare, files } = walkGraph(resolve(LIB, 'mini-apps/index.js'));
  for (const forbidden of ['server-only', 'node:crypto', 'drizzle-orm', 'postgres']) {
    assert.ok(!bare.has(forbidden), `mini-apps graph must not import "${forbidden}"`);
  }
  assert.ok(!files.has(resolve(LIB, 'ownership.js')));
});

// ── studio client → lib/dynaxis imports must resolve ─────────────────────────

test('studio Character/Influencer/Video/LipSync imports of lib/dynaxis resolve to real files', () => {
  const clientFiles = [
    'packages/studio/src/components/character/CharacterPicker.jsx',
    'packages/studio/src/components/character/CharacterReferencePicker.jsx',
    'packages/studio/src/components/assets/AssetInputPicker.jsx',
    'packages/studio/src/components/VideoStudio.jsx',
    'packages/studio/src/components/AiInfluencerStudio.jsx',
    'packages/studio/src/components/LipSyncStudio.jsx',
  ];
  for (const rel of clientFiles) {
    const file = resolve(ROOT, rel);
    const src = readFileSync(file, 'utf8');
    SPEC_RE.lastIndex = 0;
    let m;
    while ((m = SPEC_RE.exec(src))) {
      const spec = m[1] || m[2];
      if (!spec || !spec.startsWith('.') || !spec.includes('lib/dynaxis')) continue;
      const resolved = resolveRelative(file, spec);
      assert.ok(
        existsSync(resolved),
        `${rel} imports "${spec}" which does not resolve (got ${resolved})`,
      );
    }
  }
});

test('lipsync-source.js is reachable from client entry and stays server-free', () => {
  const { bare, files } = walkGraph(resolve(LIB, 'characters/lipsync-source.js'));
  for (const forbidden of ['server-only', 'node:crypto', 'drizzle-orm', 'postgres']) {
    assert.ok(!bare.has(forbidden), `lipsync-source must not import "${forbidden}"`);
  }
  assert.ok(files.has(resolve(LIB, 'characters/consumer.js')));
  // Also reachable from the client barrel
  const client = walkGraph(resolve(LIB, 'client.js'));
  assert.ok(client.files.has(resolve(LIB, 'characters/lipsync-source.js')));
});

// ── server boundary (guards present) ─────────────────────────────────────────

test('server-only guards are present on server modules', () => {
  const guarded = ['ownership.js', 'db/client.js', 'db/store.js', 'platform.js', 'api.js', 'server.js'];
  for (const rel of guarded) {
    const src = readFileSync(resolve(LIB, rel), 'utf8');
    assert.match(src, /import ['"]server-only['"]/, `${rel} must import 'server-only'`);
  }
});

// ── server boundary (guards actually throw off-server) ───────────────────────

function importThrows(absPath) {
  // Run a fresh Node process WITHOUT the server-only shim. Dynamic import must
  // reject because `server-only` resolves to its throwing `default` export.
  const code =
    `import(${JSON.stringify(absPath)})` +
    `.then(() => process.exit(2))` +
    `.catch(() => process.exit(0));`;
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      stdio: 'ignore',
    });
    return true; // exit 0 → threw as expected
  } catch {
    return false; // exit 2 → resolved unexpectedly
  }
}

test('importing server-only marker throws by default (client layer analog)', () => {
  assert.ok(importThrows('server-only'));
});

test('ownership.js cannot be imported outside the server layer', () => {
  assert.ok(importThrows(resolve(LIB, 'ownership.js')));
});

// ── dev-runtime configuration ────────────────────────────────────────────────

function scripts() {
  return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).scripts;
}

test('normal dev script does not force polling or a large heap', () => {
  const dev = scripts().dev;
  assert.doesNotMatch(dev, /WATCHPACK_POLLING/);
  assert.doesNotMatch(dev, /CHOKIDAR_USEPOLLING/);
  assert.doesNotMatch(dev, /max-old-space-size/);
});

test('explicit polling fallback enables polling', () => {
  const s = scripts();
  assert.ok(s['dev:polling'], 'dev:polling script should exist');
  assert.match(s['dev:polling'], /WATCHPACK_POLLING=true/);
  assert.match(s['dev:polling'], /CHOKIDAR_USEPOLLING=true/);
});

test('optional large-heap fallback is explicit and separate', () => {
  const s = scripts();
  if (s['dev:large-heap']) {
    assert.match(s['dev:large-heap'], /max-old-space-size/);
  }
});
