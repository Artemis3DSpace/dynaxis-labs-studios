/**
 * Phase 5A — AI Headshot Mini App tests.
 * MuAPI generation is mocked; no paid credits are consumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMiniAppManifest,
  validateManifestConsistency,
} from '../lib/dynaxis/mini-apps/manifest.js';
import {
  createMiniAppRegistry,
} from '../lib/dynaxis/mini-apps/registry.js';
import {
  createMiniAppRuntime,
  MiniAppPermissionError,
} from '../lib/dynaxis/mini-apps/runtime.js';
import {
  buildProviderPayload,
  collectOutputUrls,
} from '../lib/dynaxis/mini-apps/execute-generation.js';
import { isApprovedLoaderKey } from '../lib/dynaxis/mini-apps/loader.js';
import { ASSET_SEMANTIC_ROLES, hasPermission } from '../lib/dynaxis/mini-apps/permissions.js';
import { headshotMiniAppManifest } from '../packages/mini-apps/headshot/manifest.js';
import {
  validateHeadshotRequest,
  buildHeadshotGenerationRequest,
  generateHeadshot,
  invokeCapability,
} from '../packages/mini-apps/headshot/capability.js';
import { HEADSHOT_CATEGORIES, HEADSHOT_MUAPI_ENDPOINT } from '../packages/mini-apps/headshot/presets.js';
import { filterCatalogueTemplates } from '../packages/studio/src/catalogue-dedupe.js';
import { bootstrapMiniAppRegistry } from '../lib/dynaxis/mini-apps/bootstrap.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const GEN_ID = '33333333-3333-4333-8333-333333333333';
const JOB_ID = '44444444-4444-4444-8444-444444444444';
const PORTRAIT_URL = 'https://cdn.muapi.ai/examples/portrait-ref.jpg';
const OUT_A = 'https://cdn.muapi.ai/outputs/headshot-a.jpg';
const OUT_B = 'https://cdn.muapi.ai/outputs/headshot-b.jpg';

function mockPlatformClient(overrides = {}) {
  const calls = { start: [], complete: [], fail: [], register: [] };
  return {
    calls,
    listProjects: async () => ({
      projects: [{ id: PROJECT_ID, name: 'Default Project', isDefault: true }],
    }),
    listAssets: async () => ({
      assets: [
        {
          id: ASSET_ID,
          type: 'image',
          url: PORTRAIT_URL,
          projectId: PROJECT_ID,
        },
      ],
    }),
    listGenerations: async () => ({ generations: [] }),
    getJob: async () => ({ job: { id: JOB_ID, status: 'completed' } }),
    registerAsset: async (body) => {
      calls.register.push(body);
      return { asset: { id: ASSET_ID, ...body } };
    },
    lifecycleStart: async (body) => {
      calls.start.push(body);
      return {
        generation: { id: GEN_ID, status: 'running', ...body },
        job: { id: JOB_ID, status: 'running' },
        project: { id: PROJECT_ID },
      };
    },
    lifecycleComplete: async (body) => {
      calls.complete.push(body);
      const urls = body.urls || [];
      return {
        generation: { id: GEN_ID, status: 'completed' },
        job: { id: JOB_ID, status: 'completed' },
        assets: urls.map((url, i) => ({
          id: `55555555-5555-4555-8555-55555555555${i}`,
          url,
          type: 'image',
        })),
      };
    },
    lifecycleFail: async (body) => {
      calls.fail.push(body);
      return { generation: { id: GEN_ID, status: 'failed' }, job: { id: JOB_ID, status: 'failed' } };
    },
    ...overrides,
  };
}

test('headshot manifest is valid and least-privilege', () => {
  const m = parseMiniAppManifest(headshotMiniAppManifest);
  assert.equal(m.id, 'dynaxis.headshot');
  assert.equal(m.status, 'integrated');
  assert.equal(m.requiresProjectContext, true);
  assert.equal(m.requiresGenerationAccess, true);
  assert.equal(m.requiresExternalNetwork, false);
  assert.ok(!m.permissions.includes('external:network'));
  assert.ok(!m.permissions.includes('project:write'));
  for (const p of [
    'project:read',
    'assets:read',
    'assets:write',
    'generation:create',
    'generation:read',
    'jobs:create',
    'jobs:read',
    'models:use',
  ]) {
    assert.ok(m.permissions.includes(p), `missing ${p}`);
  }
  assert.equal(m.assetInputs[0].role, 'portrait_reference');
  assert.ok(m.assetOutputs.includes('image'));
  assert.equal(m.attribution?.license, 'MIT');
  assert.ok(m.attribution?.upstreamRepo.includes('ai-headshot-generator'));
  const warnings = validateManifestConsistency(m);
  assert.equal(warnings.length, 0);
});

test('portrait_reference is a supported semantic role', () => {
  assert.ok(ASSET_SEMANTIC_ROLES.includes('portrait_reference'));
});

test('headshot registers as user-visible integrated module and is allowlisted', () => {
  const registry = createMiniAppRegistry();
  registry.register(headshotMiniAppManifest);
  const visible = registry.listUserVisible();
  assert.ok(visible.some((m) => m.id === 'dynaxis.headshot'));
  assert.equal(isApprovedLoaderKey('dynaxis.headshot'), true);

  const bootstrapSrc = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/dynaxis/mini-apps/bootstrap.js'),
    'utf8'
  );
  assert.ok(bootstrapSrc.includes('headshotMiniAppManifest'));
  assert.ok(bootstrapSrc.includes('dynaxis.headshot') || bootstrapSrc.includes('headshotMiniAppManifest'));
  // Ensure bootstrap is callable / idempotent without asserting on shared singleton state
  bootstrapMiniAppRegistry();
});

test('catalogue dedupe hides external Headshot template when integrated', () => {
  const templates = [
    {
      name: 'AI Headshot Studio',
      repo: 'https://github.com/SamurAIGPT/ai-headshot-generator',
    },
    {
      name: 'Nano Banana Studio',
      repo: 'https://github.com/SamurAIGPT/nano-banana-generator',
    },
  ];
  const filtered = filterCatalogueTemplates(templates, [headshotMiniAppManifest]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Nano Banana Studio');
});

test('headshot request validation accepts valid category and rejects missing reference', () => {
  assert.throws(
    () => validateHeadshotRequest({ category: 'LinkedIn' }),
    (err) => err.code === 'HEADSHOT_MISSING_REFERENCE'
  );
  assert.throws(
    () =>
      validateHeadshotRequest({
        imageUrl: PORTRAIT_URL,
        category: 'NotARealStyle',
      }),
    (err) => err.code === 'HEADSHOT_INVALID_CATEGORY'
  );
  const ok = validateHeadshotRequest({
    imageUrl: PORTRAIT_URL,
    category: 'LinkedIn',
    aspectRatio: '1:1',
  });
  assert.equal(ok.category, 'LinkedIn');
  assert.ok(HEADSHOT_CATEGORIES.includes('CEO'));
});

test('buildHeadshotGenerationRequest maps to photo-pack with provenance fields', () => {
  const req = buildHeadshotGenerationRequest({
    imageUrl: PORTRAIT_URL,
    assetId: ASSET_ID,
    category: 'CEO',
    aspectRatio: '3:4',
  });
  assert.equal(req.endpoint, HEADSHOT_MUAPI_ENDPOINT);
  assert.equal(req.modelId, HEADSHOT_MUAPI_ENDPOINT);
  assert.equal(req.parameters.image_url, PORTRAIT_URL);
  assert.equal(req.parameters.category, 'CEO');
  assert.equal(req.parameters.aspect_ratio, '3:4');
  assert.equal(req.parameters.headshotPreset, 'CEO');
  assert.equal(req.referenceAssets[0].role, 'portrait_reference');
  assert.equal(req.referenceAssets[0].assetId, ASSET_ID);

  const providerPayload = buildProviderPayload(req);
  assert.equal(providerPayload.category, 'CEO');
  assert.equal(providerPayload.headshotPreset, undefined);
});

test('collectOutputUrls supports multi-output packs', () => {
  assert.deepEqual(collectOutputUrls({ outputs: [OUT_A, OUT_B] }), [OUT_A, OUT_B]);
  assert.deepEqual(collectOutputUrls({ outputs: [{ url: OUT_A }, { url: OUT_B }] }), [
    OUT_A,
    OUT_B,
  ]);
});

test('generateHeadshot creates generation + job with provenance and multi assets', async () => {
  const client = mockPlatformClient();
  let executedRequest = null;
  const runtime = createMiniAppRuntime({
    manifest: parseMiniAppManifest(headshotMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: client,
    executeGeneration: async (request) => {
      executedRequest = request;
      return { outputs: [OUT_A, OUT_B], request_id: 'muapi-req-1' };
    },
  });

  const outcome = await generateHeadshot(runtime, {
    imageUrl: PORTRAIT_URL,
    assetId: ASSET_ID,
    category: 'LinkedIn',
    aspectRatio: '1:1',
  });

  assert.equal(outcome.executed, true);
  assert.equal(outcome.generation.id, GEN_ID);
  assert.equal(outcome.job.id, JOB_ID);
  assert.equal(outcome.assets.length, 2);
  assert.equal(client.calls.start[0].metadata.miniAppId, 'dynaxis.headshot');
  assert.equal(client.calls.start[0].parameters.miniAppId, 'dynaxis.headshot');
  assert.equal(executedRequest.endpoint, 'photo-pack');
  assert.equal(executedRequest.parameters.category, 'LinkedIn');
  assert.equal(client.calls.complete[0].urls.length, 2);
});

test('generateHeadshot resolves assetId from project assets', async () => {
  const client = mockPlatformClient();
  const runtime = createMiniAppRuntime({
    manifest: parseMiniAppManifest(headshotMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: client,
    executeGeneration: async (request) => ({
      outputs: [OUT_A],
      request_id: 'x',
    }),
  });
  const outcome = await generateHeadshot(runtime, {
    assetId: ASSET_ID,
    category: 'Doctor',
  });
  assert.equal(outcome.executed, true);
});

test('generateHeadshot fails cleanly on missing asset and provider error', async () => {
  const client = mockPlatformClient({
    listAssets: async () => ({ assets: [] }),
  });
  const runtime = createMiniAppRuntime({
    manifest: parseMiniAppManifest(headshotMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: client,
    executeGeneration: async () => ({ outputs: [OUT_A] }),
  });
  await assert.rejects(
    () => generateHeadshot(runtime, { assetId: ASSET_ID, category: 'LinkedIn' }),
    (err) => err.code === 'HEADSHOT_ASSET_NOT_FOUND'
  );

  const client2 = mockPlatformClient();
  const runtime2 = createMiniAppRuntime({
    manifest: parseMiniAppManifest(headshotMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: client2,
    executeGeneration: async () => {
      throw new Error('MuAPI provider unavailable');
    },
  });
  await assert.rejects(
    () =>
      generateHeadshot(runtime2, {
        imageUrl: PORTRAIT_URL,
        category: 'LinkedIn',
      }),
    /MuAPI provider unavailable/
  );
  assert.equal(client2.calls.fail.length, 1);
});

test('headshot cannot escalate to denied runtime APIs', async () => {
  const limited = parseMiniAppManifest({
    ...headshotMiniAppManifest,
    id: 'dynaxis.headshot.limited',
    entryKey: 'dynaxis.headshot.limited',
    permissions: ['project:read'],
    requiresGenerationAccess: false,
    requiresAssetWrite: false,
  });
  const runtime = createMiniAppRuntime({
    manifest: limited,
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: mockPlatformClient(),
    executeGeneration: async () => ({ outputs: [OUT_A] }),
  });
  await assert.rejects(() => runtime.listAssets(), MiniAppPermissionError);
  await assert.rejects(
    () => generateHeadshot(runtime, { imageUrl: PORTRAIT_URL, category: 'LinkedIn' }),
    MiniAppPermissionError
  );
  assert.equal(hasPermission(limited.permissions, 'generation:create'), false);
});

test('invokeCapability dispatches generateHeadshot and listCategories', async () => {
  const client = mockPlatformClient();
  const runtime = createMiniAppRuntime({
    manifest: parseMiniAppManifest(headshotMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: PROJECT_ID }),
    platformClient: client,
    executeGeneration: async () => ({ outputs: [OUT_A] }),
    invokeCapability,
  });
  const cats = await runtime.invokeCapability('listCategories');
  assert.ok(cats.categories.includes('LinkedIn'));
  const outcome = await runtime.invokeCapability('generateHeadshot', {
    imageUrl: PORTRAIT_URL,
    category: 'CEO',
  });
  assert.equal(outcome.executed, true);
});

test('registry duplicate detection still works with headshot present', () => {
  const alt = createMiniAppRegistry();
  alt.register(headshotMiniAppManifest);
  assert.throws(() => alt.register(headshotMiniAppManifest), /already registered/);
  assert.equal(alt.listUserVisible().length, 1);
});
