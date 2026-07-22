/**
 * Phase 6F preflight — Creative Editor host executor wiring.
 * Proves MiniAppHost default executor is injected into runtime.createGeneration
 * and that the mocked provider path completes an Asset.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMiniAppRuntime } from '../lib/dynaxis/mini-apps/runtime.js';
import { executeMiniAppMuapiGeneration } from '../lib/dynaxis/mini-apps/execute-generation.js';
import { creativeEditorMiniAppManifest } from '../packages/mini-apps/creative-editor/manifest.js';
import { isApprovedLoaderKey } from '../lib/dynaxis/mini-apps/loader.js';
import {
  bootstrapMiniAppRegistry,
  resetMiniAppBootstrap,
} from '../lib/dynaxis/mini-apps/bootstrap.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

test('MiniAppHost source wires default executeMiniAppMuapiGeneration', () => {
  const src = readFileSync(resolve(ROOT, 'components/MiniAppHost.js'), 'utf8');
  assert.ok(src.includes('executeMiniAppMuapiGeneration'));
  assert.ok(src.includes('executeGeneration: executor'));
  assert.ok(src.includes("typeof executeGeneration === 'function'"));
});

test('creative-editor is registered and allowlisted', () => {
  resetMiniAppBootstrap();
  const registry = bootstrapMiniAppRegistry();
  assert.ok(registry.has(creativeEditorMiniAppManifest.id));
  assert.equal(isApprovedLoaderKey('dynaxis.creative-editor'), true);
  assert.equal(isApprovedLoaderKey('dynaxis.design-library'), true);
});

test('Creative Editor → runtime.createGeneration → host executor → Asset', async () => {
  const fakeAsset = {
    id: '00000000-0000-4000-8000-000000000099',
    url: 'https://cdn.example.com/clean.png',
    type: 'image',
  };
  const fakeGeneration = { id: '00000000-0000-4000-8000-000000000001', status: 'queued' };
  const fakeJob = { id: '00000000-0000-4000-8000-000000000002', status: 'queued' };

  let executorCalls = 0;
  const mockExecutor = async (request, apiKey) => {
    executorCalls += 1;
    assert.equal(apiKey, 'test-api-key');
    assert.ok(request.modelId || request.prompt);
    return {
      id: 'provider-job-1',
      urls: [fakeAsset.url],
      outputs: [{ url: fakeAsset.url }],
    };
  };

  const platformClient = {
    lifecycleStart: async () => ({
      generation: fakeGeneration,
      job: fakeJob,
      project: { id: '00000000-0000-4000-8000-000000000010' },
    }),
    lifecycleComplete: async () => ({
      generation: { ...fakeGeneration, status: 'completed' },
      job: { ...fakeJob, status: 'completed' },
      assets: [fakeAsset],
    }),
    lifecycleFail: async () => ({}),
  };

  const runtime = createMiniAppRuntime({
    manifest: creativeEditorMiniAppManifest,
    apiKey: 'test-api-key',
    platformClient,
    getProjectContext: () => ({ projectId: '00000000-0000-4000-8000-000000000010' }),
    executeGeneration: mockExecutor,
  });

  assert.equal(typeof runtime.createGeneration, 'function');
  assert.equal(typeof executeMiniAppMuapiGeneration, 'function');
  assert.ok(creativeEditorMiniAppManifest.permissions.includes('generation:create'));

  const result = await runtime.createGeneration({
    modelId: 'nano-banana-pro-edit',
    prompt: 'clean background',
    parameters: { cleanBackground: true },
    outputType: 'image',
  });

  assert.equal(executorCalls, 1);
  assert.equal(result.executed, true);
  assert.equal(result.assets?.[0]?.id, fakeAsset.id);
  assert.equal(result.generation.status, 'completed');
});
