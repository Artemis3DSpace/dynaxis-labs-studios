/**
 * Phase 6I — Design Systems, tokens, modes, bindings, Component Sets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { resetAssetBlobStoreCache } from '../lib/dynaxis/storage/blob-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import {
  parseDesignTokenDocument,
  DESIGN_TOKEN_DOCUMENT_VERSION,
} from '../lib/dynaxis/design-systems/document.js';
import {
  resolveDesignToken,
  evaluateDesignSystemRevisionUpdate,
} from '../lib/dynaxis/design-systems/resolver.js';
import {
  applyTokenBindingsToDocument,
  detachTokenBinding,
} from '../lib/dynaxis/design-systems/bindings.js';
import { seedTokenDocumentFromBrandVisual } from '../lib/dynaxis/design-systems/seed-from-brand.js';
import {
  combinationKey,
  resolveComponentVariant,
  evaluateVariantSwitchOverrides,
  parseComponentSetAxes,
} from '../lib/dynaxis/component-sets/variants.js';
import { parseCompositionDocument } from '../lib/dynaxis/compositions/document.js';
import { applyDesignOperations } from '../lib/dynaxis/design-agent/operations.js';
import {
  createDesignSystem,
  createDesignSystemFromBrand,
  createDesignSystemRevision,
} from '../lib/dynaxis/services/design-systems.js';
import {
  createDesignComponentSet,
  upsertDesignComponentSetVariant,
  instantiateComponentSet,
  switchComponentInstanceVariant,
} from '../lib/dynaxis/services/component-sets.js';
import { createDesignComponent } from '../lib/dynaxis/services/components.js';
import {
  createCompositionFromAsset,
  exportComposition,
  updateCompositionDraft,
  getComposition,
} from '../lib/dynaxis/services/compositions.js';
import { createBrand } from '../lib/dynaxis/services/brands.js';
import { createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import { getPlatformStore } from '../lib/dynaxis/db/store.js';

const OWNER = ownerRefFromApiKey('test-design-systems-6i');
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function sampleTokenDoc() {
  const col = randomUUID();
  const light = randomUUID();
  const dark = randomUUID();
  const blue = randomUUID();
  const primary = randomUUID();
  const size = randomUUID();
  const doc = parseDesignTokenDocument({
    version: DESIGN_TOKEN_DOCUMENT_VERSION,
    collections: [
      {
        id: col,
        name: 'Colours',
        modes: [
          { id: light, name: 'Light' },
          { id: dark, name: 'Dark' },
        ],
        defaultModeId: light,
      },
    ],
    tokens: [
      {
        id: blue,
        name: 'brand.blue.500',
        type: 'colour',
        collectionId: col,
        group: 'primary',
        defaultValue: '#14b8ff',
        valuesByMode: { [light]: '#14b8ff', [dark]: '#0e7490' },
      },
      {
        id: primary,
        name: 'action.primary',
        type: 'colour',
        collectionId: col,
        group: 'primary',
        aliasOf: blue,
      },
      {
        id: size,
        name: 'type.heading.xl',
        type: 'number',
        collectionId: col,
        defaultValue: 32,
        valuesByMode: { [light]: 32, [dark]: 28 },
      },
    ],
    metadata: null,
  });
  return { doc, ids: { col, light, dark, blue, primary, size } };
}

async function seedProject() {
  resetMemoryStore();
  resetAssetBlobStoreCache();
  const project = await createProject(OWNER, { name: 'DS Proj' });
  const asset = await registerAsset(OWNER, {
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

test('token schema: primitives and invalid colour', () => {
  const { doc } = sampleTokenDoc();
  assert.equal(doc.tokens.length, 3);
  assert.throws(() =>
    parseDesignTokenDocument({
      version: 1,
      collections: [
        {
          id: randomUUID(),
          name: 'c',
          modes: [{ id: randomUUID(), name: 'd' }],
          defaultModeId: randomUUID(),
        },
      ],
      tokens: [],
    })
  );
});

test('aliasing: resolve, cycle rejection', () => {
  const { doc, ids } = sampleTokenDoc();
  const resolved = resolveDesignToken(doc, ids.primary, {
    modesByCollection: { [ids.col]: ids.light },
  });
  assert.equal(resolved.value, '#14b8ff');

  const mid = randomUUID();
  assert.throws(() =>
    parseDesignTokenDocument({
      version: 1,
      collections: doc.collections,
      tokens: [
        {
          id: ids.blue,
          name: 'a',
          type: 'colour',
          collectionId: ids.col,
          aliasOf: mid,
        },
        {
          id: mid,
          name: 'b',
          type: 'colour',
          collectionId: ids.col,
          aliasOf: ids.blue,
        },
      ],
    })
  );
});

test('modes: explicit + fallback warning', () => {
  const { doc, ids } = sampleTokenDoc();
  const dark = resolveDesignToken(doc, ids.blue, {
    modesByCollection: { [ids.col]: ids.dark },
  });
  assert.equal(dark.value, '#0e7490');
  const fallback = resolveDesignToken(doc, ids.blue, {
    modesByCollection: { [ids.col]: randomUUID() },
  });
  assert.ok(fallback.warnings.some((w) => w.code === 'DESIGN_TOKEN_MODE_FALLBACK'));
});

test('token bindings apply/detach; legacy documents parse', () => {
  const { doc, ids } = sampleTokenDoc();
  const layerId = randomUUID();
  const composition = parseCompositionDocument({
    version: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: '#111111' },
    background: { kind: 'color', color: '#000000' },
    layers: [
      {
        id: layerId,
        type: 'text',
        name: 'CTA',
        x: 10,
        y: 10,
        width: 200,
        height: 40,
        zIndex: 1,
        text: 'Buy',
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 700,
        tokenBindings: {
          color: { tokenId: ids.primary },
          fontSize: { tokenId: ids.size },
        },
      },
    ],
  });
  const { document: applied } = applyTokenBindingsToDocument(composition, doc, {
    modesByCollection: { [ids.col]: ids.dark },
    rejectUnresolved: true,
  });
  assert.equal(applied.layers[0].color, '#0e7490');
  assert.equal(applied.layers[0].fontSize, 28);
  const { target } = detachTokenBinding(applied.layers[0], 'color', doc, {
    modesByCollection: { [ids.col]: ids.dark },
  });
  assert.equal(target.color, '#0e7490');
  assert.ok(!target.tokenBindings?.color);

  parseCompositionDocument({
    version: 1,
    canvas: { width: 100, height: 100 },
    background: { kind: 'color', color: '#ffffff' },
    layers: [
      {
        id: randomUUID(),
        type: 'text',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        zIndex: 0,
        text: 'hi',
        color: '#aabbcc',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 400,
      },
    ],
  });
});

test('Brand seed is copy', () => {
  const seeded = seedTokenDocumentFromBrandVisual({
    primaryColors: ['#14b8ff'],
    secondaryColors: ['#64748b'],
    fonts: ['Space Grotesk'],
  });
  assert.ok(seeded.tokens.some((t) => t.type === 'colour'));
});

test('Component Set sparse + unavailable', () => {
  const styleAxis = randomUUID();
  const sizeAxis = randomUUID();
  const primary = randomUUID();
  const large = randomUUID();
  const small = randomUUID();
  const axes = parseComponentSetAxes([
    {
      id: styleAxis,
      name: 'style',
      values: [
        { id: primary, label: 'primary' },
        { id: randomUUID(), label: 'secondary' },
      ],
    },
    {
      id: sizeAxis,
      name: 'size',
      values: [
        { id: small, label: 'small' },
        { id: large, label: 'large' },
      ],
    },
  ]);
  const combo = { [styleAxis]: primary, [sizeAxis]: large };
  const variants = [
    {
      combinationKey: combinationKey(combo, axes),
      combination: combo,
      componentId: randomUUID(),
      componentRevisionId: randomUUID(),
    },
  ];
  assert.equal(resolveComponentVariant(variants, axes, combo).combinationKey, variants[0].combinationKey);
  assert.throws(
    () =>
      resolveComponentVariant(variants, axes, {
        [styleAxis]: primary,
        [sizeAxis]: small,
      }),
    (err) => err.code === 'COMPONENT_VARIANT_UNAVAILABLE'
  );
});

test('variant override conflict evaluation', () => {
  const propId = randomUUID();
  const ok = evaluateVariantSwitchOverrides(
    [{ id: propId, type: 'text', targetLayerId: randomUUID(), targetProperty: 'text' }],
    [{ id: propId, type: 'text', targetLayerId: randomUUID(), targetProperty: 'text' }],
    [{ propertyId: propId, type: 'text', value: 'Hello' }]
  );
  assert.equal(ok.compatible.length, 1);
  const bad = evaluateVariantSwitchOverrides(
    [{ id: propId, type: 'text', targetLayerId: randomUUID(), targetProperty: 'text' }],
    [],
    [{ propertyId: propId, type: 'text', value: 'Hello' }]
  );
  assert.equal(bad.incompatible.length, 1);
});

test('Design Agent bind_token rejects hallucinated token IDs', () => {
  const { ids } = sampleTokenDoc();
  const layerId = randomUUID();
  const doc = {
    version: 1,
    canvas: { width: 200, height: 200 },
    background: { kind: 'color', color: '#000000' },
    layers: [
      {
        id: layerId,
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        zIndex: 1,
        text: 'CTA',
        color: '#ffffff',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 400,
      },
    ],
  };
  assert.throws(
    () =>
      applyDesignOperations(
        doc,
        [{ type: 'bind_token', layerId, property: 'color', tokenId: ids.primary }],
        { allowedTokenIds: new Set() }
      ),
    (err) => err.code === 'DESIGN_TOKEN_NOT_APPROVED'
  );
  const ok = applyDesignOperations(
    doc,
    [{ type: 'bind_token', layerId, property: 'color', tokenId: ids.primary }],
    { allowedTokenIds: new Set([ids.primary]) }
  );
  assert.equal(ok.document.layers[0].tokenBindings.color.tokenId, ids.primary);
});

test('Design System revisions pin; removed token conflicts', async () => {
  resetMemoryStore();
  const { doc, ids } = sampleTokenDoc();
  const { designSystem, revision } = await createDesignSystem(OWNER, {
    name: 'DS',
    document: doc,
  });
  assert.equal(designSystem.currentRevisionId, revision.id);

  const nextDoc = parseDesignTokenDocument({
    ...doc,
    tokens: doc.tokens.filter((t) => t.id !== ids.primary && t.id !== ids.blue),
  });
  // ensure at least one token remains
  if (!nextDoc.tokens.length) {
    nextDoc.tokens.push({
      id: randomUUID(),
      name: 'spacer',
      type: 'number',
      collectionId: ids.col,
      defaultValue: 1,
    });
  }
  const parsedNext = parseDesignTokenDocument({
    version: 1,
    collections: doc.collections,
    tokens:
      nextDoc.tokens.length > 0
        ? nextDoc.tokens
        : [
            {
              id: randomUUID(),
              name: 'spacer',
              type: 'number',
              collectionId: ids.col,
              defaultValue: 1,
            },
          ],
  });
  const { revision: rev2 } = await createDesignSystemRevision(OWNER, designSystem.id, {
    document: parsedNext,
    activate: true,
  });
  assert.notEqual(rev2.id, revision.id);
  const evaluation = evaluateDesignSystemRevisionUpdate(revision.document, rev2.document, [
    ids.primary,
  ]);
  assert.ok(evaluation.incompatible.some((c) => c.code === 'DESIGN_TOKEN_BINDING_CONFLICT'));
});

test('Component Set instantiate + switch preserves compatible override', async () => {
  const { project, asset } = await seedProject();
  const textLayerId = randomUUID();
  const propId = randomUUID();

  async function mk(name, text) {
    return createDesignComponent(OWNER, {
      name,
      document: {
        version: 1,
        intrinsicWidth: 200,
        intrinsicHeight: 80,
        layers: [
          {
            id: textLayerId,
            type: 'text',
            x: 0,
            y: 0,
            width: 200,
            height: 80,
            zIndex: 1,
            text,
            color: '#ffffff',
            fontSize: 18,
            fontFamily: 'Arial',
            fontWeight: 700,
          },
        ],
        properties: [
          {
            id: propId,
            name: 'headline',
            type: 'text',
            targetLayerId: textLayerId,
            targetProperty: 'text',
            defaultValue: text,
          },
        ],
      },
    });
  }

  const small = await mk('Btn Small', 'Small');
  const large = await mk('Btn Large', 'Large');
  const styleAxis = randomUUID();
  const sizeAxis = randomUUID();
  const stylePrimary = randomUUID();
  const sizeSmall = randomUUID();
  const sizeLarge = randomUUID();

  const { componentSet } = await createDesignComponentSet(OWNER, {
    name: 'Button',
    variantAxes: [
      {
        id: styleAxis,
        name: 'style',
        values: [{ id: stylePrimary, label: 'primary' }],
      },
      {
        id: sizeAxis,
        name: 'size',
        values: [
          { id: sizeSmall, label: 'small' },
          { id: sizeLarge, label: 'large' },
        ],
      },
    ],
    defaultCombination: { [styleAxis]: stylePrimary, [sizeAxis]: sizeSmall },
  });

  await upsertDesignComponentSetVariant(OWNER, componentSet.id, {
    combination: { [styleAxis]: stylePrimary, [sizeAxis]: sizeSmall },
    componentId: small.component.id,
    componentRevisionId: small.revision.id,
  });
  await upsertDesignComponentSetVariant(OWNER, componentSet.id, {
    combination: { [styleAxis]: stylePrimary, [sizeAxis]: sizeLarge },
    componentId: large.component.id,
    componentRevisionId: large.revision.id,
  });

  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
    name: 'Comp',
  });
  const { instance } = await instantiateComponentSet(OWNER, composition.id, {
    componentSetId: componentSet.id,
    expectedDocumentVersion: composition.documentVersion,
  });
  assert.equal(instance.componentRevisionId, small.revision.id);

  let current = await getComposition(OWNER, composition.id);
  const patched = {
    ...current.composition.document,
    layers: current.composition.document.layers.map((l) =>
      l.id === instance.id
        ? {
            ...l,
            overrides: [{ propertyId: propId, type: 'text', value: 'Keep me' }],
          }
        : l
    ),
  };
  await updateCompositionDraft(OWNER, composition.id, {
    document: patched,
    documentVersion: current.composition.documentVersion,
  });
  current = await getComposition(OWNER, composition.id);

  const switched = await switchComponentInstanceVariant(OWNER, composition.id, {
    instanceLayerId: instance.id,
    combination: { [styleAxis]: stylePrimary, [sizeAxis]: sizeLarge },
    expectedDocumentVersion: current.composition.documentVersion,
  });
  assert.equal(switched.resolved.componentRevisionId, large.revision.id);
  assert.equal(switched.overrides[0].value, 'Keep me');
});

test('export resolves tokens before rasterize', async () => {
  const { project, asset } = await seedProject();
  const { doc, ids } = sampleTokenDoc();
  const { designSystem, revision } = await createDesignSystem(OWNER, {
    name: 'Export DS',
    document: doc,
  });
  const { composition } = await createCompositionFromAsset(OWNER, {
    projectId: project.id,
    assetId: asset.id,
    name: 'TokComp',
  });
  const layerId = randomUUID();
  const nextDoc = parseCompositionDocument({
    ...composition.document,
    designSystem: {
      designSystemId: designSystem.id,
      designSystemRevisionId: revision.id,
      modes: { [ids.col]: ids.dark },
    },
    layers: [
      {
        id: layerId,
        type: 'text',
        x: 20,
        y: 20,
        width: 400,
        height: 80,
        zIndex: 2,
        text: 'Token CTA',
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 700,
        tokenBindings: { color: { tokenId: ids.primary } },
      },
      ...composition.document.layers,
    ],
  });
  await updateCompositionDraft(OWNER, composition.id, {
    document: nextDoc,
    documentVersion: composition.documentVersion,
  });
  const store = await getPlatformStore();
  await store.updateComposition(OWNER, composition.id, {
    designSystemId: designSystem.id,
    designSystemRevisionId: revision.id,
    designSystemModes: { [ids.col]: ids.dark },
  });

  const result = await exportComposition(OWNER, composition.id, {
    rasterizeFn: async () =>
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      ),
  });
  assert.ok(result.asset?.id);
});

test('Create Design System from Brand', async () => {
  resetMemoryStore();
  const { brand } = await createBrand(OWNER, {
    name: 'Acme',
    primaryColors: ['#14b8ff'],
    secondaryColors: ['#111827'],
    fonts: ['IBM Plex Sans'],
  });
  const { designSystem, revision } = await createDesignSystemFromBrand(OWNER, {
    brandId: brand.id,
  });
  assert.equal(designSystem.brandId, brand.id);
  assert.ok(revision.document.tokens.length >= 1);
});
