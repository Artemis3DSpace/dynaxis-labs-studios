/**
 * Phase 6F — Design Templates, slots, binding, adaptation, Campaign integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resetMemoryStore, getMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import { createBrand, addBrandAsset } from '../lib/dynaxis/services/brands.js';
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
} from '../lib/dynaxis/services/compositions.js';
import {
  createDesignTemplate,
  createTemplateFromComposition,
  createTemplateRevision,
  instantiateDesignTemplate,
  archiveDesignTemplate,
  adaptComposition,
  batchAdaptComposition,
  createCompositionFromDeliverableWithTemplate,
  getDesignTemplate,
} from '../lib/dynaxis/services/templates.js';
import { parseTemplateDocument } from '../lib/dynaxis/templates/document.js';
import {
  bindTemplateSlots,
  resolveTextSlotValue,
  resolveImageSlotValue,
} from '../lib/dynaxis/templates/binding.js';
import { adaptCompositionDocument } from '../lib/dynaxis/templates/adapt.js';
import { COMPOSITION_DOCUMENT_VERSION } from '../lib/dynaxis/types.js';
import { resetAssetBlobStoreCache } from '../lib/dynaxis/storage/blob-store.js';

const OWNER = ownerRefFromApiKey('test-templates-key-a');
const OTHER = ownerRefFromApiKey('test-templates-key-b');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function textLayer(overrides = {}) {
  return {
    id: randomUUID(),
    type: 'text',
    role: 'headline',
    name: 'Headline',
    text: 'Hello',
    x: 40,
    y: 40,
    width: 400,
    height: 80,
    zIndex: 1,
    fontSize: 48,
    fontFamily: 'system-ui, sans-serif',
    color: '#ffffff',
    ...overrides,
  };
}

function imageLayer(assetId, overrides = {}) {
  return {
    id: randomUUID(),
    type: 'image',
    role: 'product',
    name: 'Product',
    assetId,
    x: 100,
    y: 200,
    width: 300,
    height: 300,
    zIndex: 2,
    fit: 'cover',
    ...overrides,
  };
}

function baseCompositionDoc(assetId, layers) {
  return {
    version: COMPOSITION_DOCUMENT_VERSION,
    canvas: { width: 1080, height: 1080, transparent: false, backgroundColor: '#000000' },
    background: { kind: 'asset', assetId, fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: layers || [],
  };
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

async function seedCompletedDeliverable(ownerRef = OWNER) {
  const { brand, revision } = await createBrand(ownerRef, {
    name: 'Acme Tmpl',
    primaryColors: ['#ff0000'],
    fonts: ['Helvetica Neue'],
  });
  const project = await createProject(ownerRef, { name: 'Tmpl Proj' });
  const asset = await seedImageAsset(ownerRef, project.id);
  const logo = await seedImageAsset(ownerRef, project.id);
  await addBrandAsset(ownerRef, brand.id, {
    assetId: logo.id,
    role: 'primary_logo',
    isPrimary: true,
  });
  const { campaign } = await createCampaign(ownerRef, {
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
  const { concepts } = await generateCampaignConcepts(ownerRef, campaign.id, {
    apiKey: 'k',
    textFn: async () => ({ text: conceptsJson }),
  });
  await selectCampaignConcept(ownerRef, campaign.id, concepts[0].id);
  const { deliverables } = await createCampaignDeliverables(ownerRef, campaign.id, {
    conceptId: concepts[0].id,
    formatIds: ['instagram_square'],
  });
  const d = deliverables[0];
  await generateCampaignDeliverableCopy(ownerRef, d.id, {
    apiKey: 'k',
    textFn: async () => ({
      text: JSON.stringify({
        headline: 'Big Launch',
        body: 'Quality matters',
        cta: 'Shop now',
      }),
    }),
  });
  await generateCampaignDeliverableImage(ownerRef, d.id);
  await completeCampaignDeliverable(ownerRef, d.id, {
    assetId: asset.id,
    generationId: null,
  });
  return { project, asset, logo, brand, revision, campaign, deliverable: d };
}

test.beforeEach(() => {
  resetMemoryStore();
  resetAssetBlobStoreCache();
});

test('create Design Template + revision + archive + owner boundary', async () => {
  const project = await createProject(OWNER, { name: 'P' });
  const asset = await seedImageAsset(OWNER, project.id);
  const headline = textLayer();
  const doc = parseTemplateDocument({
    version: 1,
    canvas: { width: 1080, height: 1080, transparent: false },
    background: {
      kind: 'asset',
      assetId: asset.id,
      fit: 'cover',
      position: 'middle-center',
      opacity: 1,
    },
    layers: [headline],
    slots: [
      {
        id: randomUUID(),
        type: 'text',
        role: 'headline',
        required: true,
        targetLayerId: headline.id,
        defaultText: 'Default HL',
      },
    ],
  });

  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'Social square',
    category: 'social',
    document: doc,
  });
  assert.ok(template.id);
  assert.equal(revision.revisionNumber, 1);
  assert.equal(template.currentRevisionId, revision.id);

  const got = await getDesignTemplate(OWNER, template.id);
  assert.equal(got.revisions.length, 1);

  await assert.rejects(() => getDesignTemplate(OTHER, template.id), /not found/i);

  const archived = await archiveDesignTemplate(OWNER, template.id);
  assert.equal(archived.template.status, 'archived');
});

test('create Template from Composition remains independent', async () => {
  const project = await createProject(OWNER, { name: 'P2' });
  const asset = await seedImageAsset(OWNER, project.id);
  const headline = textLayer({ text: 'Original' });
  const { composition } = await createCompositionFromAsset(OWNER, {
    assetId: asset.id,
    projectId: project.id,
    name: 'Comp A',
  });
  const updated = await updateCompositionDraft(OWNER, composition.id, {
    document: baseCompositionDoc(asset.id, [headline]),
    documentVersion: composition.documentVersion,
  });

  const { template, revision } = await createTemplateFromComposition(OWNER, {
    compositionId: composition.id,
    name: 'From Comp',
    category: 'campaign',
    slots: [
      {
        id: randomUUID(),
        type: 'text',
        role: 'headline',
        required: false,
        targetLayerId: headline.id,
        defaultText: 'Original',
      },
    ],
  });
  assert.equal(template.sourceCompositionId, composition.id);
  assert.ok(revision.document.slots.length === 1);

  await updateCompositionDraft(OWNER, composition.id, {
    document: baseCompositionDoc(asset.id, [
      textLayer({ id: headline.id, text: 'Mutated' }),
    ]),
    documentVersion: updated.composition.documentVersion,
  });
  const tmplAgain = await getDesignTemplate(OWNER, template.id);
  const pinned = tmplAgain.revisions.find((r) => r.id === revision.id);
  const hl = pinned.document.layers.find((l) => l.id === headline.id);
  assert.equal(hl.text, 'Original');
});

test('Template revision immutability — prior revision unchanged', async () => {
  const layer = textLayer({ text: 'V1' });
  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'Rev test',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'color',
        color: '#111111',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [layer],
      slots: [],
    },
  });
  const v1Id = revision.id;
  await createTemplateRevision(OWNER, template.id, {
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'color',
        color: '#111111',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [{ ...layer, text: 'V2' }],
      slots: [],
    },
    activate: true,
  });
  const { revisions } = await getDesignTemplate(OWNER, template.id);
  assert.equal(revisions.length, 2);
  const v1 = revisions.find((r) => r.id === v1Id);
  assert.equal(v1.document.layers[0].text, 'V1');
});

test('slot binding precedence + required validation', () => {
  const layerId = randomUUID();
  const slotId = randomUUID();
  const bgAsset = randomUUID();
  const logoAsset = randomUUID();
  const templateDoc = {
    version: 1,
    canvas: { width: 1080, height: 1080, transparent: false },
    background: {
      kind: 'asset',
      assetId: bgAsset,
      fit: 'cover',
      position: 'middle-center',
      opacity: 1,
    },
    layers: [textLayer({ id: layerId, text: 'Default' })],
    slots: [
      {
        id: slotId,
        type: 'text',
        role: 'headline',
        required: true,
        targetLayerId: layerId,
        defaultText: 'Template default',
      },
      {
        id: randomUUID(),
        type: 'image',
        role: 'brand_logo',
        required: true,
        targetLayerId: null,
        targetBackground: true,
        defaultAssetId: null,
      },
    ],
  };

  assert.equal(
    resolveTextSlotValue(templateDoc.slots[0], {
      projectId: randomUUID(),
      textValues: { [slotId]: 'User HL' },
      headline: 'Deliverable HL',
    }).source,
    'explicit'
  );
  assert.equal(
    resolveTextSlotValue(templateDoc.slots[0], {
      projectId: randomUUID(),
      headline: 'Deliverable HL',
    }).source,
    'deliverable'
  );
  assert.equal(
    resolveTextSlotValue(templateDoc.slots[0], { projectId: randomUUID() }).source,
    'template_default'
  );
  assert.equal(
    resolveImageSlotValue(templateDoc.slots[1], {
      projectId: randomUUID(),
      resolved: { brandLogoAssetId: logoAsset },
    }).source,
    'brand_logo'
  );

  const missing = bindTemplateSlots(templateDoc, { projectId: randomUUID() });
  assert.ok(missing.errors.some((e) => e.code === 'TEMPLATE_REQUIRED_SLOT_MISSING'));
});

test('duplicate slot IDs and invalid target layer rejected', () => {
  const layerId = randomUUID();
  const dup = randomUUID();
  assert.throws(() =>
    parseTemplateDocument({
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'color',
        color: '#000000',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [textLayer({ id: layerId })],
      slots: [
        { id: dup, type: 'text', role: 'headline', required: false, targetLayerId: layerId },
        { id: dup, type: 'text', role: 'body', required: false, targetLayerId: layerId },
      ],
    })
  );
  assert.throws(() =>
    parseTemplateDocument({
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'color',
        color: '#000000',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [textLayer({ id: layerId })],
      slots: [
        {
          id: randomUUID(),
          type: 'text',
          role: 'headline',
          required: false,
          targetLayerId: randomUUID(),
        },
      ],
    })
  );
});

test('instantiate Template → independent Composition with provenance', async () => {
  const project = await createProject(OWNER, { name: 'Inst' });
  const asset = await seedImageAsset(OWNER, project.id);
  const logo = await seedImageAsset(OWNER, project.id);
  const headline = textLayer();
  const productLayer = imageLayer(asset.id);
  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'Bind test',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'asset',
        assetId: asset.id,
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [headline, productLayer],
      slots: [
        {
          id: randomUUID(),
          type: 'text',
          role: 'headline',
          required: true,
          targetLayerId: headline.id,
          defaultText: 'Fallback',
        },
        {
          id: randomUUID(),
          type: 'image',
          role: 'brand_logo',
          required: false,
          targetLayerId: productLayer.id,
          targetBackground: false,
          defaultAssetId: logo.id,
        },
      ],
    },
  });

  const { composition } = await instantiateDesignTemplate(OWNER, {
    templateId: template.id,
    templateRevisionId: revision.id,
    projectId: project.id,
    binding: {
      projectId: project.id,
      headline: 'Campaign Headline',
    },
  });
  assert.equal(composition.templateId, template.id);
  assert.equal(composition.templateRevisionId, revision.id);
  assert.equal(
    composition.document.layers.find((l) => l.id === headline.id).text,
    'Campaign Headline'
  );

  await createTemplateRevision(OWNER, template.id, {
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'asset',
        assetId: asset.id,
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [{ ...headline, text: 'Template changed' }, productLayer],
      slots: [],
    },
  });
  const still = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(
    still.document.layers.find((l) => l.id === headline.id).text,
    'Campaign Headline'
  );
});

test('unowned Asset binding fails', async () => {
  const project = await createProject(OWNER, { name: 'SecA' });
  const asset = await seedImageAsset(OWNER, project.id);
  const otherProject = await createProject(OTHER, { name: 'SecB' });
  const foreign = await seedImageAsset(OTHER, otherProject.id);

  const headline = textLayer();
  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'Sec',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'color',
        color: '#000000',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [headline],
      slots: [
        {
          id: randomUUID(),
          type: 'text',
          role: 'headline',
          required: false,
          targetLayerId: headline.id,
          defaultText: 'x',
        },
        {
          id: randomUUID(),
          type: 'image',
          role: 'background',
          required: true,
          targetBackground: true,
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      instantiateDesignTemplate(OWNER, {
        templateId: template.id,
        templateRevisionId: revision.id,
        projectId: project.id,
        binding: {
          projectId: project.id,
          backgroundAssetId: foreign.id,
        },
      }),
    /unavailable|not found/i
  );
  void asset;
});

test('adaptation geometry is deterministic across aspects', () => {
  const layer = textLayer({
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    adaptation: {
      horizontalAnchor: 'left',
      verticalAnchor: 'top',
      scaleBehaviour: 'proportional',
      semanticPriority: 'critical',
    },
  });
  const doc = {
    version: 1,
    canvas: { width: 1080, height: 1080, transparent: false },
    background: {
      kind: 'color',
      color: '#000000',
      fit: 'cover',
      position: 'middle-center',
      opacity: 1,
    },
    layers: [layer],
  };
  const a = adaptCompositionDocument(
    doc,
    { width: 1080, height: 1080 },
    { width: 1080, height: 1920 },
    { formatId: 'instagram_story' }
  );
  const b = adaptCompositionDocument(
    doc,
    { width: 1080, height: 1080 },
    { width: 1080, height: 1920 },
    { formatId: 'instagram_story' }
  );
  assert.deepEqual(a.document.layers[0].x, b.document.layers[0].x);
  assert.equal(a.document.canvas.height, 1920);

  const wide = adaptCompositionDocument(
    a.document,
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
    { formatId: 'web_banner' }
  );
  assert.equal(wide.document.canvas.width, 1920);
  assert.ok(Array.isArray(wide.warnings));

  const back = adaptCompositionDocument(
    wide.document,
    { width: 1920, height: 1080 },
    { width: 1080, height: 1080 },
    {}
  );
  assert.equal(back.document.canvas.width, 1080);
});

test('adaptComposition service creates new Composition with lineage', async () => {
  const project = await createProject(OWNER, { name: 'Adapt' });
  const asset = await seedImageAsset(OWNER, project.id);
  const { composition } = await createCompositionFromAsset(OWNER, {
    assetId: asset.id,
    projectId: project.id,
    name: 'Source',
  });
  const { composition: adapted, warnings, engineVersion } = await adaptComposition(OWNER, {
    compositionId: composition.id,
    targetAspectRatio: '9:16',
  });
  assert.notEqual(adapted.id, composition.id);
  assert.equal(adapted.sourceCompositionId, composition.id);
  assert.ok(engineVersion);
  assert.ok(Array.isArray(warnings));
  const src = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(src.canvasWidth, composition.canvasWidth);
});

test('batch adaptation partial success', async () => {
  const project = await createProject(OWNER, { name: 'Batch' });
  const asset = await seedImageAsset(OWNER, project.id);
  const { composition } = await createCompositionFromAsset(OWNER, {
    assetId: asset.id,
    projectId: project.id,
  });
  const { results } = await batchAdaptComposition(OWNER, {
    compositionId: composition.id,
    targets: [
      { aspectRatio: '9:16', name: 'Story' },
      { aspectRatio: '16:9', name: 'Wide' },
      { aspectRatio: '1:1', name: 'Square' },
    ],
  });
  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.ok));
});

test('Campaign Deliverable without Template unchanged; with Template binds', async () => {
  const { project, asset, deliverable, campaign } = await seedCompletedDeliverable();

  const plain = await createCompositionFromDeliverable(OWNER, {
    deliverableId: deliverable.id,
  });
  assert.equal(plain.created, true);
  assert.ok(!plain.composition.templateId);

  // Second deliverable via store for template path
  const store = getMemoryStore();
  const deliverable2 = await store.createCampaignDeliverable({
    ownerRef: OWNER,
    campaignId: campaign.id,
    campaignRevisionId: campaign.currentRevisionId,
    conceptId: deliverable.conceptId,
    formatId: 'instagram_square',
    status: 'completed',
    assetId: asset.id,
    headline: 'Templated HL',
    body: 'Body',
    cta: 'Go',
  });

  const headline = textLayer();
  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'Camp tmpl',
    category: 'campaign',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'asset',
        assetId: asset.id,
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [headline],
      slots: [
        {
          id: randomUUID(),
          type: 'text',
          role: 'headline',
          required: true,
          targetLayerId: headline.id,
          defaultText: 'x',
        },
        {
          id: randomUUID(),
          type: 'image',
          role: 'background',
          required: true,
          targetBackground: true,
        },
      ],
    },
  });

  const withT = await createCompositionFromDeliverableWithTemplate(OWNER, {
    deliverableId: deliverable2.id,
    templateId: template.id,
    templateRevisionId: revision.id,
  });
  assert.equal(withT.composition.templateId, template.id);
  assert.equal(
    withT.composition.document.layers.find((l) => l.id === headline.id).text,
    'Templated HL'
  );
  assert.equal(withT.composition.document.background.assetId, asset.id);
  assert.equal(withT.composition.projectId, project.id);
});
