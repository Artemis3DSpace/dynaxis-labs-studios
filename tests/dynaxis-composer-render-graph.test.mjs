import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRenderGraph } from '../lib/dynaxis/composer/render-graph.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const SPEC_RE =
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelative(fromFile, spec) {
  let path = resolve(dirname(fromFile), spec);
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.js');
  else if (!existsSync(path) && existsSync(`${path}.js`)) path = `${path}.js`;
  return path;
}

function walkGraph(entryFile) {
  const files = new Set();
  const bare = new Set();
  const visited = new Set();
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!existsSync(file) || statSync(file).isDirectory()) continue;

    files.add(file);
    const src = readFileSync(file, 'utf8');
    SPEC_RE.lastIndex = 0;
    let match;
    while ((match = SPEC_RE.exec(src))) {
      const spec = match[1] || match[2];
      if (!spec) continue;
      if (spec.startsWith('.')) stack.push(resolveRelative(file, spec));
      else bare.add(spec);
    }
  }

  return { files, bare };
}

test('render graph cycles rejected', () => {
  assert.throws(
    () =>
      parseRenderGraph({
        nodes: [
          { id: '8cd56fd4-4035-4549-9cc3-a46f41f472a5', kind: 'source' },
          { id: '71ea10a0-bfa0-4f24-a930-399834497bc2', kind: 'mix' },
        ],
        edges: [
          {
            id: 'f0f18109-b5d4-4067-bf0f-5a58f45ccfd8',
            from: '8cd56fd4-4035-4549-9cc3-a46f41f472a5',
            to: '71ea10a0-bfa0-4f24-a930-399834497bc2',
          },
          {
            id: '13b4684c-55c3-45f4-80b0-ebfd8f880f47',
            from: '71ea10a0-bfa0-4f24-a930-399834497bc2',
            to: '8cd56fd4-4035-4549-9cc3-a46f41f472a5',
          },
        ],
      }),
    /render graph must be acyclic/
  );
});

test('render graph module stays isolated from job engine and provider connections', () => {
  const entry = resolve(ROOT, 'lib/dynaxis/composer/render-graph.js');
  const { files, bare } = walkGraph(entry);

  for (const forbiddenBare of ['drizzle-orm', 'postgres']) {
    assert.equal(bare.has(forbiddenBare), false, `must not import ${forbiddenBare}`);
  }

  const forbiddenFileFragments = [
    '/lib/dynaxis/provider-connections/',
    '/lib/dynaxis/services/jobs.js',
    '/lib/dynaxis/services/lifecycle.js',
    '/lib/dynaxis/services/generation-gateway.js',
  ];
  for (const filePath of files) {
    for (const fragment of forbiddenFileFragments) {
      assert.equal(
        filePath.includes(fragment),
        false,
        `render graph dependency graph must not include ${fragment}`
      );
    }
  }
});
