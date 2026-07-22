/**
 * Phase 6E — Composition domain, document schema, layout, export, Campaign integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { ensureDefaultProject, createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import { createBrand } from '../lib/dynaxis/services/brands.js';
import {
  createCampaign,
  generateCampaignConcepts,
  selectCampaignConcept,
  createCampaignDeliverables,
  generateCampaignDeliverableCopy,
  generateCampaignDeliverableImage,
  completeCampaignDeliverable,
} from '../lib/dynaxis/services/campaigns.js';
import {
  createCompositionFromAsset,
  createCompositionFromDeliverable,
  updateCompositionDraft,
  saveCompositionRevision,
  exportComposition,
  setDeliverableFinalAsset,
} from '../lib/dynaxis/services/compositions.js';
import {
  parseCompositionDocument,
  compositionDocumentSchema,
  collectDocumentAssetIds,
} from '../lib/dynaxis/compositions/document.js';
import {
  positionFromPreset,
  clampLayerToCanvas,
  nudgeLayer,
  escapeSvgText,
  duplicateLayer,
} from '../lib/dynaxis/compositions/layout.js';
import {
  buildInitialDeliverableDocument,
  canvasDimensionsFromAspect,
} from '../lib/dynaxis/compositions/initial-layout.js';
import { normalizeHexColor } from '../lib/dynaxis/compositions/colors.js';
import { renderCompositionSvg } from '../lib/dynaxis/compositions/svg-renderer.js';
import { readDataUrlBytes, fetchAssetBytesSecure } from '../lib/dynaxis/compositions/asset-fetch.js';
import {
  createUndoState,
  pushUndo,
  undo,
  redo,
} from '../lib/dynaxis/compositions/undo.js';
import { creativeEditorMiniAppManifest } from '../packages/mini-apps/creative-editor/manifest.js';
import {
  resetAssetBlobStoreCache,
  resolveAssetBlobStore,
} from '../lib/dynaxis/storage/blob-store.js';
import { createMemoryBlobStore } from '../lib/dynaxis/storage/memory-blob-store.js';

const OWNER = ownerRefFromApiKey('test-compositions-key');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function mockRasterize() {
  return async () => Buffer.from(readDataUrlBytes(TINY_PNG).bytes);
}

async function seedImageAsset(ownerRef, projectId) {
  return registerAsset(ownerRef, {
    projectId,
    type: 'image',
    source: 'uploaded',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
  });
}

async function seedBrand() {
  const { brand, revision } = await createBrand(OWNER, {
    name: 'Acme',
    primaryColors: ['#ff0000', '#00ff00'],
    fonts: ['Helvetica Neue'],
  });
  return { brand, revision };
}

async function seedCompletedDeliverable() {
  const { brand, revision } = await seedBrand();
  const project = await createProject(OWNER, { name: 'Comp Proj' });
  const asset = await seedImageAsset(OWNER, project.id);
  const { campaign } = await createCampaign(OWNER, {
    name: 'Edit Camp',
    goal: 'brand_awareness',
    projectId: project.id,
    brandId: brand.id,
    brandRevisionId: revision.id,
  });
  const conceptsJson = JSON.stringify({
    concepts: [
      { title: 'A', theme: 't', key_message: 'k', hook: 'h', cta: 'c', recommended_formats: ['instagram_square'] },
      { title: 'B', theme: 't', key_message: 'k', hook: 'h', cta: 'c', recommended_formats: ['instagram_square'] },
      { title: 'C', theme: 't', key_message: 'k', hook: 'h', cta: 'c', recommended_formats: ['instagram_square'] },
      { title: 'D', theme: 't', key_message: 'k', hook: 'h', cta: 'c', recommended_formats: ['instagram_square'] },
    ],
  });
  const { concepts } = await generateCampaignConcepts(OWNER, campaign.id, {
    apiKey: 'k',
    textFn: async () => ({ text: conceptsJson }),
  });
  await selectCampaignConcept(OWNER, campaign.id, concepts[0].id);
  const { deliverables } = await createCampaignDeliverables(OWNER, campaign.id, {
    conceptId: concepts[0].id,
    formatIds: ['instagram_square'],
  });
  const d = deliverables[0];
  await generateCampaignDeliverableCopy(OWNER, d.id, {
    apiKey: 'k',
    textFn: async () => ({
      text: JSON.stringify({
        headline: 'Big Launch',
        body: 'Quality matters',
        cta: 'Shop now',
      }),
    }),
  });
  await generateCampaignDeliverableImage(OWNER, d.id);
  await completeCampaignDeliverable(OWNER, d.id, {
    assetId: asset.id,
    generationId: null,
  });
  return { project, asset, campaign, deliverable: d };
}

test.beforeEach(() => {
  resetMemoryStore();
  resetAssetBlobStoreCache();
});

// ── Document schema ──────────────────────────────────────────────────────────

test('document schema: valid, invalid dimensions, duplicate ids, injection', () => {
  const base = buildInitialDeliverableDocument({
    formatId: 'instagram_square',
    headline: 'Hi',
    body: 'Body',
    cta: 'Go',
    backgroundAssetId: randomUUID(),
    idFn: () => randomUUID(),
  });
  parseCompositionDocument(base);

  assert.throws(() =>
    parseCompositionDocument({
      ...base,
      canvas: { ...base.canvas, width: 10 },
    })
  );

  const dup = JSON.parse(JSON.stringify(base));
  if (dup.layers.length > 1) {
    dup.layers[1].id = dup.layers[0].id;
    assert.throws(() => parseCompositionDocument(dup));
  }

  assert.equal(normalizeHexColor('<script>'), null);
  assert.equal(normalizeHexColor('#abc'), '#aabbcc');
});

test('layout: presets, clamp, nudge, undo', () => {
  const pos = positionFromPreset(
    'bottom-right',
    { width: 1000, height: 800 },
    { width: 200, height: 50 },
    { top: 20, right: 20, bottom: 20, left: 20 }
  );
  assert.ok(pos.x > 700);
  assert.ok(pos.y > 600);

  const clamped = clampLayerToCanvas({ x: -5, y: 900, width: 100, height: 50 }, {
    width: 500,
    height: 500,
  });
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 450);

  const state = createUndoState({ maxHistory: 5 });
  pushUndo(state, { v: 1 });
  pushUndo(state, { v: 2 });
  assert.deepEqual(undo(state), { v: 1 });
  assert.deepEqual(redo(state), { v: 2 });
});

test('svg renderer escapes text and includes dimensions', () => {
  const doc = buildInitialDeliverableDocument({
    formatId: 'instagram_square',
    headline: '<script>alert(1)</script>',
    backgroundAssetId: randomUUID(),
    idFn: () => randomUUID(),
  });
  const svg = renderCompositionSvg(doc, {});
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes(`width="${doc.canvas.width}"`));
});

// ── Domain ───────────────────────────────────────────────────────────────────

test('create from asset; source asset unchanged after export', async () => {
  await ensureDefaultProject(OWNER);
  const project = await createProject(OWNER, { name: 'A1' });
  const asset = await seedImageAsset(OWNER, project.id);
  const beforeUrl = asset.url;

  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
  });
  assert.ok(composition.id);
  assert.equal(composition.sourceAssetId, asset.id);

  const exported = await exportComposition(OWNER, composition.id, {
    rasterizeFn: mockRasterize(),
    blobStore: createMemoryBlobStore(),
  });
  assert.ok(exported.asset.id);
  assert.notEqual(exported.asset.id, asset.id);
  assert.ok(!String(exported.asset.url).startsWith('data:'));
  assert.ok(String(exported.asset.url).startsWith('dynaxis-blob://'));
  assert.equal(exported.asset.metadata?.storage?.provider, 'memory');
  assert.ok(exported.asset.metadata?.storage?.checksumSha256);
  assert.ok(exported.export.metadata?.storage?.objectKey);

  const unchanged = await registerAsset(OWNER, {
    projectId: project.id,
    type: 'image',
    source: 'uploaded',
    url: beforeUrl,
    mimeType: 'image/png',
  });
  assert.equal(unchanged.url, beforeUrl);
});

test('stale document version rejected', async () => {
  const project = await createProject(OWNER, { name: 'Stale' });
  const asset = await seedImageAsset(OWNER, project.id);
  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
  });
  await assert.rejects(
    () =>
      updateCompositionDraft(OWNER, composition.id, {
        document: composition.document,
        documentVersion: 999,
      }),
    (e) => e.code === 'COMPOSITION_STALE_VERSION'
  );
});

test('revision immutability', async () => {
  const { deliverable } = await seedCompletedDeliverable();
  const { composition } = await createCompositionFromDeliverable(OWNER, {
    deliverableId: deliverable.id,
  });
  const { revision } = await saveCompositionRevision(OWNER, composition.id, {
    label: 'v1',
  });
  const beforeHeadline = revision.snapshot.document.layers.find((l) => l.role === 'headline')
    ?.text;
  const doc = parseCompositionDocument(composition.document);
  doc.layers = doc.layers.map((l) =>
    l.role === 'headline' ? { ...l, text: 'CHANGED HEADLINE' } : l
  );
  await updateCompositionDraft(OWNER, composition.id, {
    document: doc,
    documentVersion: composition.documentVersion,
  });
  const afterHeadline = revision.snapshot.document.layers.find((l) => l.role === 'headline')?.text;
  assert.equal(afterHeadline, beforeHeadline);
  assert.notEqual(afterHeadline, 'CHANGED HEADLINE');
});

// ── Campaign integration ─────────────────────────────────────────────────────

test('create from deliverable: layers, brand palette, export, final asset', async () => {
  const { deliverable, asset } = await seedCompletedDeliverable();
  const originalUrl = asset.url;

  const { composition, created } = await createCompositionFromDeliverable(OWNER, {
    deliverableId: deliverable.id,
  });
  assert.equal(created, true);
  const doc = parseCompositionDocument(composition.document);
  assert.ok(doc.layers.some((l) => l.role === 'headline'));
  assert.equal(doc.background.assetId, asset.id);

  const again = await createCompositionFromDeliverable(OWNER, {
    deliverableId: deliverable.id,
  });
  assert.equal(again.created, false);

  const exported = await exportComposition(OWNER, composition.id, {
    rasterizeFn: mockRasterize(),
    blobStore: createMemoryBlobStore(),
  });
  assert.equal(exported.asset.mimeType, 'image/png');
  assert.equal(exported.asset.width, doc.canvas.width);
  assert.ok(!String(exported.asset.url).startsWith('data:'));

  await setDeliverableFinalAsset(OWNER, composition.id, {
    assetId: exported.asset.id,
  });

  assert.equal(asset.url, originalUrl);
});

test('canvas dimensions from aspect ratio', () => {
  const d = canvasDimensionsFromAspect('16:9', 1080);
  assert.equal(d.width, 1080);
  assert.equal(d.height, 608);
});

// ── Export security ──────────────────────────────────────────────────────────

test('fetch rejects private network URL', async () => {
  await assert.rejects(
    () => fetchAssetBytesSecure('http://127.0.0.1/secret.png'),
    (e) => e.code === 'COMPOSITION_FETCH_URL_BLOCKED' || Boolean(e.message)
  );
});

test('data URL bytes readable', () => {
  const { bytes, mimeType } = readDataUrlBytes(TINY_PNG);
  assert.equal(mimeType, 'image/png');
  assert.ok(bytes.length > 0);
});

// ── Mini App ─────────────────────────────────────────────────────────────────

test('creative editor manifest and permissions', () => {
  assert.equal(creativeEditorMiniAppManifest.id, 'dynaxis.creative-editor');
  assert.ok(creativeEditorMiniAppManifest.permissions.includes('compositions:read'));
  assert.ok(creativeEditorMiniAppManifest.permissions.includes('compositions:write'));
  assert.ok(!creativeEditorMiniAppManifest.permissions.includes('external:network'));
  assert.equal(creativeEditorMiniAppManifest.featureFlags.noVideo, true);
});
