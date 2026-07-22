/**
 * Phase 6A — Product domain + Product Studio Mini App tests.
 * MuAPI mocked; no paid credits consumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import {
  createProduct,
  updateProduct,
  archiveProduct,
  addProductAsset,
  promoteAssetToProductReference,
  linkProductToProject,
  listProductRevisions,
  getProduct,
  listProducts,
} from '../lib/dynaxis/services/products.js';
import { ensureDefaultProject, createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import { parseMiniAppManifest, validateManifestConsistency } from '../lib/dynaxis/mini-apps/manifest.js';
import { createMiniAppRuntime, MiniAppPermissionError } from '../lib/dynaxis/mini-apps/runtime.js';
import { isApprovedLoaderKey } from '../lib/dynaxis/mini-apps/loader.js';
import { ASSET_SEMANTIC_ROLES } from '../lib/dynaxis/mini-apps/permissions.js';
import { filterCatalogueTemplates } from '../packages/studio/src/catalogue-dedupe.js';
import { productStudioMiniAppManifest } from '../packages/mini-apps/product-studio/manifest.js';
import {
  validateSceneRequest,
  buildProductSceneGenerationRequest,
  generateProductScene,
  invokeCapability,
} from '../packages/mini-apps/product-studio/capability.js';
import {
  PRODUCT_SCENE_PRESETS,
  MAX_PRODUCT_REFERENCE_IMAGES,
  buildScenePrompt,
} from '../packages/mini-apps/product-studio/presets.js';
import { PRODUCT_CONTINUITY_STRATEGY } from '../lib/dynaxis/types.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import {
  selectProductReferences,
  buildProductVisualContext,
  resolveProductContext,
  publishProductGenerationContext,
  clearProductGenerationContext,
  readProductGenerationContext,
} from '../lib/dynaxis/products/consumer.js';
import { buildProviderPayload } from '../lib/dynaxis/mini-apps/execute-generation.js';

const OWNER = ownerRefFromApiKey('test-product-key');
const OUT_A = 'https://cdn.muapi.ai/outputs/prod-a.jpg';
const OUT_B = 'https://cdn.muapi.ai/outputs/prod-b.jpg';
const REF_URL = 'https://cdn.muapi.ai/examples/product-ref.jpg';

function mockPlatformClient(overrides = {}) {
  const calls = { start: [], complete: [], fail: [] };
  return {
    calls,
    listProjects: async () => ({ projects: [] }),
    listAssets: async () => ({ assets: [] }),
    listGenerations: async () => ({ generations: [] }),
    getJob: async () => ({ job: null }),
    registerAsset: async (body) => ({
      asset: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...body },
    }),
    listProducts: async () => ({ products: [] }),
    getProduct: async () => ({ product: null }),
    createProduct: async () => ({}),
    updateProduct: async () => ({}),
    listProductAssets: async () => ({ assets: [] }),
    addProductAsset: async () => ({}),
    promoteProductAsset: async () => ({}),
    linkProductToProject: async () => ({}),
    listProductRevisions: async () => ({ revisions: [] }),
    lifecycleStart: async (body) => {
      calls.start.push(body);
      return {
        generation: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          productId: body.productId || null,
          productRevisionId: body.productRevisionId || null,
          status: 'running',
        },
        job: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'running' },
        project: { id: body.projectId },
      };
    },
    lifecycleComplete: async (body) => {
      calls.complete.push(body);
      const urls = body.urls || [];
      return {
        generation: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'completed',
          productId: calls.start[0]?.productId,
          productRevisionId: calls.start[0]?.productRevisionId,
        },
        job: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'completed' },
        assets: urls.map((url, i) => ({
          id: `dddddddd-dddd-4ddd-8ddd-ddddddddddd${i}`,
          url,
          type: 'image',
        })),
      };
    },
    lifecycleFail: async (body) => {
      calls.fail.push(body);
      return {};
    },
    ...overrides,
  };
}

test('product studio manifest is valid with product permissions', () => {
  const m = parseMiniAppManifest(productStudioMiniAppManifest);
  assert.equal(m.id, 'dynaxis.product-studio');
  assert.equal(m.status, 'integrated');
  assert.ok(m.permissions.includes('products:read'));
  assert.ok(m.permissions.includes('products:write'));
  assert.ok(!m.permissions.includes('external:network'));
  assert.ok(m.requiredCapabilities.includes('products'));
  assert.equal(m.name, 'Product Studio');
  assert.equal(validateManifestConsistency(m).length, 0);
  assert.equal(isApprovedLoaderKey('dynaxis.product-studio'), true);
  assert.ok(ASSET_SEMANTIC_ROLES.includes('product_reference'));
  assert.ok(ASSET_SEMANTIC_ROLES.includes('generated_product_scene'));
});

test('catalogue dedupe hides Amazon Product Studio interest card', () => {
  const templates = [
    { name: 'Amazon Product Studio' },
    { name: 'Pet Product Studio' },
    {
      name: 'Amazon Product Studio Template',
      repo: 'https://github.com/SamurAIGPT/amazon-product-studio',
    },
  ];
  const filtered = filterCatalogueTemplates(templates, [productStudioMiniAppManifest]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Pet Product Studio');
});

test('product continuity strategy is reference-based', () => {
  assert.equal(PRODUCT_CONTINUITY_STRATEGY, 'reference-based');
});

test('seven scene presets migrated from upstream', () => {
  assert.equal(PRODUCT_SCENE_PRESETS.length, 7);
  assert.ok(PRODUCT_SCENE_PRESETS.some((p) => p.name === 'Minimalist Marble'));
  assert.ok(PRODUCT_SCENE_PRESETS.some((p) => p.name === 'Modern Office'));
  assert.equal(MAX_PRODUCT_REFERENCE_IMAGES, 14);
});

test('product create, multi-ref assets, revisions, multi-project link', async () => {
  resetMemoryStore();
  const projectA = await ensureDefaultProject(OWNER);
  const projectB = await createProject(OWNER, { name: 'Commerce Project' });

  const created = await createProduct(OWNER, {
    name: 'Aurora Bottle',
    description: 'Insulated water bottle',
    visualDescription: 'Matte black bottle with teal lid',
    brandName: 'Dynaxis Demo',
    productType: 'physical',
    projectId: projectA.id,
  });
  assert.equal(created.product.name, 'Aurora Bottle');
  assert.ok(created.revision.id);
  assert.equal(created.product.currentRevisionId, created.revision.id);

  const rev1 = created.revision.id;

  const asset1 = await registerAsset(OWNER, {
    projectId: projectA.id,
    url: REF_URL,
    type: 'image',
    source: 'uploaded',
  });
  const asset2 = await registerAsset(OWNER, {
    projectId: projectA.id,
    url: 'https://cdn.muapi.ai/examples/product-ref-2.jpg',
    type: 'image',
    source: 'uploaded',
  });

  await addProductAsset(OWNER, created.product.id, {
    assetId: asset1.id,
    role: 'product_reference',
    isPrimary: true,
  });
  await addProductAsset(OWNER, created.product.id, {
    assetId: asset2.id,
    role: 'packaging_reference',
  });

  const linked = await getProduct(OWNER, created.product.id, { includeAssets: true });
  assert.equal(linked.assets.length, 2);
  assert.notEqual(linked.product.currentRevisionId, rev1);

  await linkProductToProject(OWNER, created.product.id, { projectId: projectB.id });
  const listed = await listProducts(OWNER);
  assert.equal(listed.products.length, 1);

  const revisions = await listProductRevisions(OWNER, created.product.id);
  assert.ok(revisions.revisions.length >= 2);
  assert.ok(revisions.revisions.some((r) => r.id === rev1));

  const updated = await updateProduct(OWNER, created.product.id, {
    description: 'Updated description',
  });
  assert.equal(updated.product.description, 'Updated description');
  assert.notEqual(updated.product.currentRevisionId, linked.product.currentRevisionId);

  const archived = await archiveProduct(OWNER, created.product.id);
  assert.equal(archived.product.status, 'archived');
});

test('product rejects unowned assets', async () => {
  resetMemoryStore();
  const project = await ensureDefaultProject(OWNER);
  const created = await createProduct(OWNER, {
    name: 'Solo',
    projectId: project.id,
  });
  await assert.rejects(
    () =>
      addProductAsset(OWNER, created.product.id, {
        assetId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        role: 'product_reference',
      }),
    (err) => err.code === 'ASSET_NOT_FOUND' || err.status === 404
  );
});

test('explicit promote does not auto-mutate on scene link', async () => {
  resetMemoryStore();
  const project = await ensureDefaultProject(OWNER);
  const created = await createProduct(OWNER, {
    name: 'Promote Me',
    projectId: project.id,
  });
  const sceneAsset = await registerAsset(OWNER, {
    projectId: project.id,
    url: OUT_A,
    type: 'image',
    source: 'generated',
  });
  const before = created.product.currentRevisionId;
  await addProductAsset(OWNER, created.product.id, {
    assetId: sceneAsset.id,
    role: 'generated_product_scene',
    createRevision: false,
  });
  const afterScene = await getProduct(OWNER, created.product.id);
  assert.equal(afterScene.product.currentRevisionId, before);

  await promoteAssetToProductReference(OWNER, created.product.id, {
    assetId: sceneAsset.id,
    role: 'product_reference',
    isPrimary: true,
  });
  const afterPromote = await getProduct(OWNER, created.product.id, {
    includeAssets: true,
  });
  assert.notEqual(afterPromote.product.currentRevisionId, before);
  assert.ok(
    afterPromote.assets.some(
      (a) => a.assetId === sceneAsset.id && a.role === 'product_reference'
    )
  );
});

test('scene request validation and preset prompt mapping', () => {
  const ok = validateSceneRequest({
    productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    aspectRatio: '16:9',
    scenePreset: 'Luxury Spotlight',
  });
  assert.equal(ok.aspectRatio, '16:9');
  assert.throws(
    () =>
      validateSceneRequest({
        productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        aspectRatio: '99:1',
      }),
    (e) => e.code === 'INVALID_ASPECT'
  );
  assert.throws(
    () =>
      validateSceneRequest({
        productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        referenceAssets: Array.from({ length: 15 }, (_, i) => ({
          url: `https://cdn.example.com/${i}.jpg`,
        })),
      }),
    (e) => e.code === 'TOO_MANY_REFERENCES'
  );

  const prompt = buildScenePrompt({
    productVisualDescription: 'Matte bottle',
    scenePresetName: 'Minimalist Marble',
  });
  assert.match(prompt, /Matte bottle/);
  assert.match(prompt, /marble/i);
});

test('provider payload strips product provenance keys', () => {
  const payload = buildProviderPayload({
    prompt: 'scene',
    parameters: {
      prompt: 'scene',
      images_list: [REF_URL],
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      scenePreset: 'Minimalist Marble',
      productPreset: 'minimalist-marble',
    },
  });
  assert.equal(payload.productId, undefined);
  assert.equal(payload.productRevisionId, undefined);
  assert.equal(payload.scenePreset, undefined);
  assert.equal(payload.productPreset, undefined);
  assert.deepEqual(payload.images_list, [REF_URL]);
});

test('product consumer selects references within model limit', () => {
  const assets = Array.from({ length: 20 }, (_, i) => ({
    assetId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, '0')}`,
    url: `https://cdn.muapi.ai/r/${i}.jpg`,
    role: 'product_reference',
    sortOrder: i,
    isPrimary: i === 0,
  }));
  const sel = selectProductReferences(assets, { maxImages: 14 });
  assert.equal(sel.references.length, 14);
  assert.equal(sel.truncated, true);
  assert.equal(sel.assetIds[0], assets[0].assetId);

  const visual = buildProductVisualContext({
    product: { id: assets[0].assetId, name: 'Bottle', visualDescription: 'Black matte' },
    assets,
    referenceSelection: sel,
  });
  assert.equal(visual.referenceAssetIds.length, 14);
  assert.match(visual.visualDescription, /Black matte/);
});

test('resolveProductContext and window provenance bridge', async () => {
  const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const revisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const client = {
    getProduct: async () => ({
      product: {
        id: productId,
        name: 'Bottle',
        visualDescription: 'Teal lid',
        currentRevisionId: revisionId,
        assets: [
          {
            assetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            url: REF_URL,
            role: 'product_reference',
            isPrimary: true,
          },
        ],
      },
    }),
    linkProductToProject: async () => ({}),
  };
  const resolved = await resolveProductContext(client, productId, {
    maxImages: 5,
    projectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    linkToProject: true,
    consumer: 'test',
  });
  assert.equal(resolved.provenance.productId, productId);
  assert.equal(resolved.provenance.productRevisionId, revisionId);
  assert.equal(resolved.visual.referenceUrls[0], REF_URL);

  const prevWindow = globalThis.window;
  const prevCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class {
    constructor(type, opts) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
  globalThis.window = { dispatchEvent() {} };
  try {
    publishProductGenerationContext({
      productId,
      productRevisionId: revisionId,
      referenceAssetIds: resolved.provenance.referenceAssetIds,
    });
    const read = readProductGenerationContext();
    assert.equal(read.productId, productId);
    assert.equal(read.productRevisionId, revisionId);
    clearProductGenerationContext();
    assert.equal(readProductGenerationContext().productId, null);
  } finally {
    globalThis.window = prevWindow;
    globalThis.CustomEvent = prevCustomEvent;
  }
});

test('runtime createGeneration records product provenance', async () => {
  const client = mockPlatformClient({
    getProduct: async () => ({
      product: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Bottle',
        currentRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        visualDescription: 'Matte',
      },
    }),
    listProductAssets: async () => ({
      assets: [
        {
          assetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          url: REF_URL,
          role: 'product_reference',
        },
      ],
    }),
    addProductAsset: async () => ({}),
    linkProductToProject: async () => ({}),
  });

  const runtime = createMiniAppRuntime({
    manifest: productStudioMiniAppManifest,
    apiKey: 'test-key',
    platformClient: client,
    getProjectContext: () => ({
      projectId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    }),
    executeGeneration: async () => ({
      outputs: [OUT_A, OUT_B],
      request_id: 'req-1',
    }),
  });

  const outcome = await generateProductScene(runtime, {
    productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    scenePreset: 'Minimalist Marble',
    aspectRatio: '1:1',
  });

  assert.equal(client.calls.start[0].productId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(
    client.calls.start[0].productRevisionId,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );
  assert.equal(outcome.assets.length, 2);
  assert.equal(outcome.executed, true);
});

test('products:write required for createProduct', async () => {
  const readOnly = parseMiniAppManifest({
    ...productStudioMiniAppManifest,
    id: 'dynaxis.product-studio-ro',
    entryKey: 'dynaxis.product-studio',
    permissions: productStudioMiniAppManifest.permissions.filter(
      (p) => p !== 'products:write'
    ),
  });
  const runtime = createMiniAppRuntime({
    manifest: readOnly,
    apiKey: 'test-key',
    platformClient: mockPlatformClient(),
    getProjectContext: () => ({ projectId: null }),
  });
  await assert.rejects(
    () => runtime.createProduct({ name: 'Nope' }),
    (e) => e instanceof MiniAppPermissionError || e.code === 'MINI_APP_PERMISSION_DENIED'
  );
});

test('invokeCapability lists presets and builds plan', async () => {
  const presets = await invokeCapability('listScenePresets', {}, null);
  assert.equal(presets.presets.length, 7);

  const plan = buildProductSceneGenerationRequest({
    product: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      currentRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    visualDescription: 'Bottle',
    scenePreset: 'Sunny Beach',
    aspectRatio: '4:3',
    resolution: '1k',
    referenceUrls: [REF_URL],
    referenceAssets: [{ url: REF_URL, role: 'product_reference' }],
  });
  assert.equal(plan.modelId, 'nano-banana-2-edit');
  assert.equal(plan.parameters.aspect_ratio, '4:3');
  assert.deepEqual(plan.parameters.images_list, [REF_URL]);
  assert.equal(plan.productId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});
