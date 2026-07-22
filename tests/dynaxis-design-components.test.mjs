/**
 * Phase 6H — Design Components: document, properties, resolver, domain, integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import {
  createCompositionFromAsset,
  updateCompositionDraft,
  saveCompositionRevision,
  exportComposition,
  getComposition,
} from '../lib/dynaxis/services/compositions.js';
import {
  createDesignComponent,
  createComponentFromLayers,
  createComponentRevision,
  listDesignComponents,
  getDesignComponent,
  archiveDesignComponent,
  instantiateComponent,
  detachComponentInstance,
  updateComponentInstanceRevision,
  evaluateComponentInstanceUpdate,
  listComponentUsage,
} from '../lib/dynaxis/services/components.js';
import { parseComponentDocument } from '../lib/dynaxis/components/document.js';
import {
  validateComponentOverrides,
  evaluateComponentRevisionUpdate,
} from '../lib/dynaxis/components/properties.js';
import { resolveComponentInstance } from '../lib/dynaxis/components/resolver.js';
import {
  createComponentDocumentFromLayers,
  boundingBoxOfLayers,
} from '../lib/dynaxis/components/create-from-layers.js';
import { parseCompositionDocument } from '../lib/dynaxis/compositions/document.js';
import { bindTemplateSlots } from '../lib/dynaxis/templates/binding.js';
import { adaptCompositionDocument } from '../lib/dynaxis/templates/adapt.js';
import { applyDesignOperations } from '../lib/dynaxis/design-agent/operations.js';
import { COMPOSITION_DOCUMENT_VERSION, DESIGN_COMPONENT_DOCUMENT_VERSION } from '../lib/dynaxis/types.js';
import { resetAssetBlobStoreCache } from '../lib/dynaxis/storage/blob-store.js';

const OWNER = ownerRefFromApiKey('test-components-key-a');
const OTHER = ownerRefFromApiKey('test-components-key-b');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function textLayer(overrides = {}) {
  return {
    id: randomUUID(),
    type: 'text',
    role: 'headline',
    name: 'Headline',
    text: 'Launch',
    x: 20,
    y: 20,
    width: 200,
    height: 40,
    zIndex: 1,
    fontSize: 24,
    fontFamily: 'system-ui, sans-serif',
    color: '#ffffff',
    ...overrides,
  };
}

function componentDoc(layers, properties = []) {
  return parseComponentDocument({
    version: DESIGN_COMPONENT_DOCUMENT_VERSION,
    intrinsicWidth: 400,
    intrinsicHeight: 240,
    layers,
    properties,
    hints: { fitModeDefault: 'proportional' },
  });
}

async function seed(ownerRef = OWNER) {
  resetMemoryStore();
  resetAssetBlobStoreCache();
  const project = await createProject(ownerRef, { name: 'Comp Proj' });
  const asset = await registerAsset(ownerRef, {
    projectId: project.id,
    type: 'image',
    source: 'uploaded',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
  });
  return { project, asset };
}

test('component document rejects nested component_instance', () => {
  assert.throws(
    () =>
      parseComponentDocument({
        version: 1,
        intrinsicWidth: 200,
        intrinsicHeight: 100,
        layers: [
          {
            id: randomUUID(),
            type: 'component_instance',
            componentId: randomUUID(),
            componentRevisionId: randomUUID(),
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            zIndex: 0,
            overrides: [],
          },
        ],
        properties: [],
      }),
    /Invalid|discriminated|component/i
  );
});

test('component document rejects invalid property target layer', () => {
  const layer = textLayer();
  assert.throws(() =>
    parseComponentDocument({
      version: 1,
      intrinsicWidth: 200,
      intrinsicHeight: 100,
      layers: [layer],
      properties: [
        {
          id: randomUUID(),
          name: 'headline',
          type: 'text',
          targetLayerId: randomUUID(),
          targetProperty: 'text',
          required: false,
        },
      ],
    })
  );
});

test('overrides validate types and unknown properties', () => {
  const layer = textLayer();
  const propId = randomUUID();
  const defs = [
    {
      id: propId,
      name: 'headline',
      type: 'text',
      targetLayerId: layer.id,
      targetProperty: 'text',
      required: false,
    },
  ];
  const ok = validateComponentOverrides(defs, [{ propertyId: propId, type: 'text', value: 'Hi' }]);
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.overrides.length, 1);

  const bad = validateComponentOverrides(defs, [
    { propertyId: randomUUID(), type: 'text', value: 'x' },
  ]);
  assert.ok(bad.errors.some((e) => e.code === 'COMPONENT_OVERRIDE_UNKNOWN_PROPERTY'));

  const wrong = validateComponentOverrides(defs, [
    { propertyId: propId, type: 'asset', value: randomUUID() },
  ]);
  assert.ok(wrong.errors.some((e) => e.code === 'COMPONENT_OVERRIDE_WRONG_TYPE'));
});

test('resolver scales proportionally and applies text override', () => {
  const layer = textLayer({ x: 0, y: 0, width: 200, height: 40, text: 'Base' });
  const propId = randomUUID();
  const doc = componentDoc([layer], [
    {
      id: propId,
      name: 'headline',
      type: 'text',
      targetLayerId: layer.id,
      targetProperty: 'text',
      required: false,
    },
  ]);
  const resolved = resolveComponentInstance(
    doc,
    [{ propertyId: propId, type: 'text', value: 'Override' }],
    { x: 100, y: 50, width: 200, height: 120, fitMode: 'proportional' }
  );
  assert.equal(resolved.layers.length, 1);
  assert.equal(resolved.layers[0].text, 'Override');
  assert.ok(Math.abs(resolved.scaleX - 0.5) < 0.001);
  assert.equal(resolved.layers[0].width, 100);
  assert.equal(resolved.layers[0].x, 100);
});

test('create from layers normalizes local coordinates', () => {
  const a = textLayer({ x: 100, y: 50, width: 80, height: 20 });
  const b = textLayer({ x: 140, y: 90, width: 60, height: 20 });
  const box = boundingBoxOfLayers([a, b]);
  assert.equal(box.x, 100);
  assert.equal(box.y, 50);
  const doc = createComponentDocumentFromLayers([a, b]);
  assert.equal(doc.layers[0].x, 0);
  assert.equal(doc.layers[0].y, 0);
  assert.equal(doc.intrinsicWidth, box.width);
});

test('create/list/get/archive component + revision immutability + owner isolation', async () => {
  await seed();
  const layer = textLayer({ text: 'CTA' });
  const { component, revision } = await createDesignComponent(OWNER, {
    name: 'Launch CTA',
    category: 'cta',
    document: componentDoc([layer]),
  });
  assert.equal(component.name, 'Launch CTA');
  assert.equal(revision.revisionNumber, 1);
  assert.equal(component.currentRevisionId, revision.id);

  const listed = await listDesignComponents(OWNER, { category: 'cta' });
  assert.equal(listed.components.length, 1);

  const layer2 = textLayer({ text: 'CTA v2' });
  const { revision: rev2, component: updated } = await createComponentRevision(OWNER, component.id, {
    document: componentDoc([layer2]),
    reason: 'copy tweak',
  });
  assert.equal(rev2.revisionNumber, 2);
  assert.equal(updated.currentRevisionId, rev2.id);

  const still = await getDesignComponent(OWNER, component.id);
  const r1 = still.revisions.find((r) => r.id === revision.id);
  assert.equal(r1.document.layers[0].text, 'CTA');

  await assert.rejects(() => getDesignComponent(OTHER, component.id), /not found/i);

  const archived = await archiveDesignComponent(OWNER, component.id);
  assert.equal(archived.component.status, 'archived');
  const activeList = await listDesignComponents(OWNER, {});
  assert.equal(activeList.components.length, 0);
});

test('create from layers + replace + pin + explicit update + conflict', async () => {
  const { project, asset } = await seed();
  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
    name: 'Poster',
  });
  const headline = textLayer({ x: 40, y: 40, text: 'Hello' });
  const cta = textLayer({ x: 40, y: 100, text: 'Buy', role: 'cta' });
  let doc = parseCompositionDocument({
    ...composition.document,
    layers: [headline, cta],
  });
  let draft = await updateCompositionDraft(OWNER, composition.id, {
    document: doc,
    documentVersion: composition.documentVersion,
  });

  const propId = randomUUID();
  const created = await createComponentFromLayers(OWNER, {
    compositionId: composition.id,
    layerIds: [headline.id, cta.id],
    name: 'Launch CTA',
    category: 'cta',
    replaceSelectedLayers: true,
    documentVersion: draft.composition.documentVersion,
    properties: [
      {
        id: propId,
        name: 'headline',
        type: 'text',
        targetLayerId: headline.id,
        targetProperty: 'text',
        required: false,
      },
    ],
  });
  assert.ok(created.replaced);
  assert.equal(created.composition.document.layers.filter((l) => l.type === 'component_instance').length, 1);
  const instance = created.composition.document.layers.find((l) => l.type === 'component_instance');
  assert.equal(instance.componentRevisionId, created.revision.id);

  await saveCompositionRevision(OWNER, composition.id, { label: 'with-cta' });

  const masterDoc = parseComponentDocument(created.revision.document);
  const rev2Doc = {
    ...masterDoc,
    layers: masterDoc.layers.map((l) =>
      l.id === headline.id ? { ...l, text: 'NEW MASTER' } : l
    ),
  };
  const { revision: rev2 } = await createComponentRevision(OWNER, created.component.id, {
    document: rev2Doc,
    reason: 'master edit',
  });

  const current = await getComposition(OWNER, composition.id);
  const pinned = current.composition.document.layers.find((l) => l.type === 'component_instance');
  assert.equal(pinned.componentRevisionId, created.revision.id);
  assert.notEqual(pinned.componentRevisionId, rev2.id);

  pinned.overrides = [{ propertyId: propId, type: 'text', value: 'Override' }];
  draft = await updateCompositionDraft(OWNER, composition.id, {
    document: current.composition.document,
    documentVersion: current.composition.documentVersion,
  });

  const evaluation = await evaluateComponentInstanceUpdate(OWNER, {
    componentId: created.component.id,
    currentRevisionId: created.revision.id,
    targetRevisionId: rev2.id,
    overrides: pinned.overrides,
  });
  assert.equal(evaluation.compatible.length, 1);

  const rev3Doc = { ...rev2Doc, properties: [] };
  const { revision: rev3 } = await createComponentRevision(OWNER, created.component.id, {
    document: rev3Doc,
  });
  const conflictEval = await evaluateComponentRevisionUpdate(
    masterDoc.properties,
    rev3Doc.properties,
    pinned.overrides
  );
  assert.ok(conflictEval.incompatible.some((i) => i.code === 'COMPONENT_OVERRIDE_CONFLICT'));

  await assert.rejects(
    () =>
      updateComponentInstanceRevision(OWNER, composition.id, {
        instanceLayerId: pinned.id,
        currentRevisionId: created.revision.id,
        targetRevisionId: rev3.id,
        expectedDocumentVersion: draft.composition.documentVersion,
        dropIncompatibleOverrides: false,
      }),
    (err) => err.code === 'COMPONENT_OVERRIDE_CONFLICT'
  );

  const updated = await updateComponentInstanceRevision(OWNER, composition.id, {
    instanceLayerId: pinned.id,
    currentRevisionId: created.revision.id,
    targetRevisionId: rev2.id,
    expectedDocumentVersion: draft.composition.documentVersion,
  });
  assert.equal(
    updated.composition.document.layers.find((l) => l.id === pinned.id).componentRevisionId,
    rev2.id
  );
});

test('detach expands to ordinary layers and leaves source component', async () => {
  const { project, asset } = await seed();
  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
  });
  const layer = textLayer({ text: 'Keep me' });
  const { component, revision } = await createDesignComponent(OWNER, {
    name: 'Card',
    document: componentDoc([layer]),
  });
  const draft = await updateCompositionDraft(OWNER, composition.id, {
    document: { ...composition.document, layers: [] },
    documentVersion: composition.documentVersion,
  });
  const inserted = await instantiateComponent(OWNER, composition.id, {
    componentId: component.id,
    componentRevisionId: revision.id,
    expectedDocumentVersion: draft.composition.documentVersion,
    x: 10,
    y: 10,
  });
  const detached = await detachComponentInstance(OWNER, composition.id, {
    instanceLayerId: inserted.instance.id,
    expectedDocumentVersion: inserted.composition.documentVersion,
  });
  assert.ok(detached.composition.document.layers.every((l) => l.type !== 'component_instance'));
  assert.ok(detached.composition.document.layers.some((l) => l.type === 'text' && l.text === 'Keep me'));
  const still = await getDesignComponent(OWNER, component.id);
  assert.ok(still.component);
  const usage = await listComponentUsage(OWNER, component.id);
  assert.equal(usage.instanceCount, 0);
});

test('template slot binds into component property via explicit mapping', () => {
  const instanceId = randomUUID();
  const componentId = randomUUID();
  const revisionId = randomUUID();
  const propId = randomUUID();
  const projectId = randomUUID();
  const templateDoc = {
    version: 1,
    canvas: { width: 400, height: 400, transparent: false, backgroundColor: '#000000' },
    background: { kind: 'color', color: '#111111', fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: [
      {
        id: instanceId,
        type: 'component_instance',
        name: 'Card',
        componentId,
        componentRevisionId: revisionId,
        x: 20,
        y: 20,
        width: 200,
        height: 120,
        zIndex: 1,
        overrides: [],
        fitMode: 'proportional',
      },
    ],
    slots: [
      {
        id: randomUUID(),
        type: 'text',
        role: 'headline',
        required: true,
        targetComponentInstanceLayerId: instanceId,
        targetPropertyId: propId,
      },
    ],
  };
  const { document, errors } = bindTemplateSlots(templateDoc, {
    projectId,
    headline: 'Bound Headline',
  });
  assert.equal(errors.length, 0);
  const inst = document.layers.find((l) => l.id === instanceId);
  assert.ok(inst.overrides.some((o) => o.propertyId === propId && o.value === 'Bound Headline'));
});

test('adaptation treats component_instance as atomic unit', () => {
  const instance = {
    id: randomUUID(),
    type: 'component_instance',
    componentId: randomUUID(),
    componentRevisionId: randomUUID(),
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    zIndex: 1,
    overrides: [],
    fitMode: 'proportional',
    adaptation: { preserveAspectRatio: true, scaleBehaviour: 'proportional' },
  };
  const source = {
    version: COMPOSITION_DOCUMENT_VERSION,
    canvas: { width: 1080, height: 1080, transparent: false, backgroundColor: '#000' },
    background: { kind: 'color', color: '#000', fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: [instance],
  };
  const { document, warnings } = adaptCompositionDocument(
    source,
    { width: 1080, height: 1080 },
    { width: 1080, height: 1920 },
    { formatId: 'instagram_story' }
  );
  const adapted = document.layers[0];
  assert.equal(adapted.type, 'component_instance');
  assert.equal(adapted.componentRevisionId, instance.componentRevisionId);
  assert.ok(adapted.width > 0 && adapted.height > 0);
  assert.ok(Array.isArray(warnings));
});

test('design agent rejects hallucinated component id', () => {
  const doc = parseCompositionDocument({
    version: 1,
    canvas: { width: 800, height: 800, transparent: false, backgroundColor: '#000' },
    background: { kind: 'color', color: '#000', fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: [],
  });
  assert.throws(
    () =>
      applyDesignOperations(
        doc,
        [
          {
            type: 'insert_component_instance',
            componentId: randomUUID(),
            componentRevisionId: randomUUID(),
            x: 10,
            y: 10,
            width: 100,
            height: 50,
          },
        ],
        { allowedComponentIds: new Set(), allowedComponentRevisionIds: new Set() }
      ),
    (err) => err.code === 'DESIGN_COMPONENT_NOT_APPROVED'
  );
});

test('design agent move/resize works on component_instance', () => {
  const instanceId = randomUUID();
  const doc = parseCompositionDocument({
    version: 1,
    canvas: { width: 800, height: 800, transparent: false, backgroundColor: '#000' },
    background: { kind: 'color', color: '#000', fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: [
      {
        id: instanceId,
        type: 'component_instance',
        componentId: randomUUID(),
        componentRevisionId: randomUUID(),
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        zIndex: 1,
        overrides: [],
        fitMode: 'proportional',
      },
    ],
  });
  const { document } = applyDesignOperations(doc, [
    { type: 'move_layer', layerId: instanceId, x: 40, y: 60 },
    { type: 'resize_layer', layerId: instanceId, width: 180, height: 90 },
  ]);
  const layer = document.layers[0];
  assert.equal(layer.x, 40);
  assert.equal(layer.y, 60);
  assert.equal(layer.width, 180);
  assert.equal(layer.height, 90);
});

test('export composition with component instance resolves through export path', async () => {
  const { project, asset } = await seed();
  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
  });
  const layer = textLayer({ text: 'Export Me', color: '#ffffff' });
  const { component, revision } = await createDesignComponent(OWNER, {
    name: 'Export CTA',
    document: componentDoc([layer]),
  });
  const draft = await updateCompositionDraft(OWNER, composition.id, {
    document: {
      ...composition.document,
      background: { kind: 'color', color: '#112233', fit: 'cover', position: 'middle-center', opacity: 1 },
      layers: [],
    },
    documentVersion: composition.documentVersion,
  });
  await instantiateComponent(OWNER, composition.id, {
    componentId: component.id,
    componentRevisionId: revision.id,
    expectedDocumentVersion: draft.composition.documentVersion,
  });
  const result = await exportComposition(OWNER, composition.id, {
    rasterizeFn: async () =>
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      ),
  });
  assert.ok(result.export);
  assert.ok(result.asset);
});

test('cross-owner component instance rejected on composition save', async () => {
  await seed(OWNER);
  const layer = textLayer();
  const { component, revision } = await createDesignComponent(OWNER, {
    name: 'Private',
    document: componentDoc([layer]),
  });

  const otherProject = await createProject(OTHER, { name: 'Other' });
  const otherAsset = await registerAsset(OTHER, {
    projectId: otherProject.id,
    type: 'image',
    source: 'uploaded',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
  });
  const { composition: otherComp } = await createCompositionFromAsset(OTHER, {
    projectId: otherProject.id,
    assetId: otherAsset.id,
  });
  await assert.rejects(
    () =>
      updateCompositionDraft(OTHER, otherComp.id, {
        document: {
          ...otherComp.document,
          layers: [
            {
              id: randomUUID(),
              type: 'component_instance',
              componentId: component.id,
              componentRevisionId: revision.id,
              x: 0,
              y: 0,
              width: 100,
              height: 50,
              zIndex: 1,
              overrides: [],
              fitMode: 'proportional',
            },
          ],
        },
        documentVersion: otherComp.documentVersion,
      }),
    /not found|COMPONENT/i
  );
});
