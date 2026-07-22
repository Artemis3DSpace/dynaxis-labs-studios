import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMiniAppManifest,
  safeParseMiniAppManifest,
  validateManifestConsistency,
} from '../lib/dynaxis/mini-apps/manifest.js';
import {
  MiniAppRegistry,
  createMiniAppRegistry,
} from '../lib/dynaxis/mini-apps/registry.js';
import {
  hasPermission,
  MINI_APP_PERMISSIONS,
} from '../lib/dynaxis/mini-apps/permissions.js';
import {
  createMiniAppRuntime,
  MiniAppPermissionError,
} from '../lib/dynaxis/mini-apps/runtime.js';
import { checkMiniAppAvailability } from '../lib/dynaxis/mini-apps/availability.js';
import {
  loadMiniApp,
  isApprovedLoaderKey,
  __testRegisterLoader,
  __testClearExtraLoaders,
} from '../lib/dynaxis/mini-apps/loader.js';
import { miniAppRegistry } from '../lib/dynaxis/mini-apps/registry.js';
import { exampleMiniAppManifest } from '../packages/mini-apps/example/manifest.js';
import { buildExampleGenerationPlan } from '../packages/mini-apps/example/capability.js';
import { parseGenerationRequest } from '../lib/dynaxis/mini-apps/generation-request.js';

const baseManifest = {
  ...exampleMiniAppManifest,
  id: 'dynaxis.test.module',
  entryKey: 'dynaxis.test.module',
  status: 'integrated',
};

test('manifest validation accepts a valid manifest', () => {
  const m = parseMiniAppManifest(exampleMiniAppManifest);
  assert.equal(m.id, 'dynaxis.example');
  assert.ok(m.permissions.includes('project:read'));
});

test('manifest validation rejects invalid id', () => {
  const result = safeParseMiniAppManifest({
    ...exampleMiniAppManifest,
    id: 'Bad Id',
  });
  assert.equal(result.success, false);
});

test('manifest validation rejects invalid permissions', () => {
  const result = safeParseMiniAppManifest({
    ...exampleMiniAppManifest,
    permissions: ['not:a:real:permission'],
  });
  assert.equal(result.success, false);
});

test('manifest validation requires name/description', () => {
  const result = safeParseMiniAppManifest({
    ...exampleMiniAppManifest,
    name: '',
  });
  assert.equal(result.success, false);
});

test('validateManifestConsistency warns on missing generation permissions', () => {
  const warnings = validateManifestConsistency({
    ...exampleMiniAppManifest,
    requiresGenerationAccess: true,
    permissions: ['project:read'],
  });
  assert.ok(warnings.some((w) => w.includes('generation:create')));
});

test('registry register, retrieve, list, duplicate detection', () => {
  const registry = createMiniAppRegistry();
  registry.register(baseManifest);
  assert.equal(registry.get(baseManifest.id)?.name, baseManifest.name);
  assert.equal(registry.listUserVisible().length, 1);
  assert.throws(() => registry.register(baseManifest), /already registered/);
});

test('registry hides experimental and disabled by default', () => {
  const registry = createMiniAppRegistry();
  registry.register({ ...baseManifest, id: 'dynaxis.a', entryKey: 'dynaxis.a', status: 'experimental' });
  registry.register({
    ...baseManifest,
    id: 'dynaxis.b',
    entryKey: 'dynaxis.b',
    status: 'disabled',
  });
  registry.register({
    ...baseManifest,
    id: 'dynaxis.c',
    entryKey: 'dynaxis.c',
    status: 'integrated',
  });
  assert.equal(registry.list().length, 1);
  assert.equal(registry.list({ includeExperimental: true }).length, 2);
  assert.equal(registry.list({ includeDisabled: true, includeExperimental: true }).length, 3);
});

test('permissions: allow and deny platform access via runtime', async () => {
  const manifest = parseMiniAppManifest({
    ...baseManifest,
    id: 'dynaxis.perm',
    entryKey: 'dynaxis.perm',
    permissions: ['project:read'],
    requiresGenerationAccess: false,
    requiresAssetWrite: false,
  });
  const runtime = createMiniAppRuntime({
    manifest,
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: '11111111-1111-1111-1111-111111111111' }),
    platformClient: {
      listProjects: async () => ({ projects: [] }),
      listAssets: async () => ({ assets: [] }),
      listGenerations: async () => ({ generations: [] }),
      getJob: async () => ({ job: null }),
      registerAsset: async () => ({}),
      lifecycleStart: async () => ({}),
      lifecycleComplete: async () => ({}),
      lifecycleFail: async () => ({}),
    },
  });
  const ctx = runtime.getProjectContext();
  assert.equal(ctx.miniAppId, 'dynaxis.perm');
  await assert.rejects(() => runtime.listAssets(), MiniAppPermissionError);
  await assert.rejects(() => runtime.createGeneration({ modelId: 'x', prompt: 'y' }), MiniAppPermissionError);
  assert.equal(hasPermission(MINI_APP_PERMISSIONS, 'project:read'), true);
});

test('runtime generation wires lifecycle with provenance', async () => {
  const calls = [];
  const manifest = parseMiniAppManifest({
    ...baseManifest,
    id: 'dynaxis.gen',
    entryKey: 'dynaxis.gen',
  });
  const runtime = createMiniAppRuntime({
    manifest,
    apiKey: 'k',
    getProjectContext: () => ({ projectId: '22222222-2222-2222-2222-222222222222' }),
    platformClient: {
      lifecycleStart: async (body) => {
        calls.push(['start', body]);
        return {
          project: { id: body.projectId },
          generation: { id: '33333333-3333-3333-3333-333333333333' },
          job: { id: '44444444-4444-4444-4444-444444444444' },
        };
      },
      lifecycleComplete: async (body) => {
        calls.push(['complete', body]);
        return {
          generation: { id: body.generationId, status: 'succeeded' },
          job: { id: body.jobId, status: 'succeeded' },
          assets: [{ id: '55555555-5555-5555-5555-555555555555' }],
        };
      },
      lifecycleFail: async (body) => {
        calls.push(['fail', body]);
        return body;
      },
      listProjects: async () => ({}),
      listAssets: async () => ({}),
      listGenerations: async () => ({}),
      getJob: async () => ({}),
      registerAsset: async () => ({}),
    },
    executeGeneration: async () => ({
      url: 'https://cdn.example/out.png',
      outputs: ['https://cdn.example/out.png'],
    }),
  });
  const result = await runtime.createGeneration({
    modelId: 'flux',
    prompt: 'hello',
    outputType: 'image',
  });
  assert.equal(result.executed, true);
  assert.equal(calls[0][0], 'start');
  assert.equal(calls[0][1].featureId, 'dynaxis.gen');
  assert.equal(calls[0][1].metadata.miniAppId, 'dynaxis.gen');
  assert.equal(calls[1][0], 'complete');
  assert.equal(result.assets.length, 1);
});

test('availability distinguishes catalogue vs usable vs unavailable', () => {
  const catalogue = checkMiniAppAvailability({
    ...baseManifest,
    status: 'catalogue',
  });
  assert.equal(catalogue.presentation, 'catalogue');
  assert.equal(catalogue.usable, false);

  const unavailable = checkMiniAppAvailability(
    { ...baseManifest, status: 'integrated', requiredCapabilities: ['database'] },
    { databaseOk: false, muapiKeyPresent: true, projectContextPresent: true }
  );
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.presentation, 'unavailable');

  const usable = checkMiniAppAvailability(
    { ...baseManifest, status: 'integrated', requiredCapabilities: ['database'] },
    { databaseOk: true, muapiKeyPresent: true, projectContextPresent: true }
  );
  assert.equal(usable.usable, true);
});

test('lazy loading: approved module resolves; unknown fails safely', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DYNAXIS_ALLOW_TEST_LOADERS = '1';
  miniAppRegistry.clear();
  __testClearExtraLoaders();
  __testRegisterLoader('dynaxis.test.module', async () => ({
    Component: () => null,
    default: { Component: () => null },
  }));
  miniAppRegistry.register(baseManifest);
  assert.equal(isApprovedLoaderKey('dynaxis.test.module'), true);
  const loaded = await loadMiniApp('dynaxis.test.module');
  assert.ok(loaded.module);
  await assert.rejects(() => loadMiniApp('dynaxis.does.not.exist'), /Unknown Mini App/);
  await assert.rejects(async () => {
    miniAppRegistry.register({
      ...baseManifest,
      id: 'dynaxis.no.loader',
      entryKey: 'dynaxis.no.loader',
    });
    await loadMiniApp('dynaxis.no.loader');
  }, /allowlist/);
  __testClearExtraLoaders();
  miniAppRegistry.clear();
});

test('generation request requires structured fields', () => {
  const req = parseGenerationRequest({
    modelId: 'flux',
    prompt: 'x',
    referenceAssets: [{ url: 'https://cdn.example/a.png', role: 'style_reference' }],
  });
  assert.equal(req.outputType, 'image');
  assert.throws(() =>
    parseGenerationRequest({
      modelId: 'flux',
      referenceAssets: [{ role: 'input' }],
    })
  );
});

test('example capability builds plan without React', () => {
  const plan = buildExampleGenerationPlan({ prompt: 'mark' });
  assert.equal(plan.outputType, 'image');
  assert.throws(() => buildExampleGenerationPlan({ prompt: '' }));
});

test('error isolation: MiniAppErrorBoundary getDerivedStateFromError isolates failures', async () => {
  const { MiniAppErrorBoundary } = await import('../components/MiniAppErrorBoundary.js');
  const state = MiniAppErrorBoundary.getDerivedStateFromError(new Error('module exploded'));
  assert.equal(state.error.message, 'module exploded');
  assert.ok(typeof MiniAppErrorBoundary.prototype.componentDidCatch === 'function');
  assert.ok(typeof MiniAppErrorBoundary.prototype.render === 'function');
});
