/**
 * Dynaxis Design Component Set service — variant axes + sparse mappings (server-only).
 */

import 'server-only';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getPlatformStore } from '../db/store.js';
import { DESIGN_COMPONENT_CATEGORIES, DESIGN_COMPONENT_SET_STATUSES } from '../types.js';
import {
  parseComponentSetAxes,
  combinationKey,
  validateVariantCombination,
  resolveComponentVariant,
  evaluateVariantSwitchOverrides,
} from '../component-sets/variants.js';
import { parseComponentDocument } from '../components/document.js';
import { validateComponentOverrides } from '../components/properties.js';
import { parseCompositionDocument } from '../compositions/document.js';
import { syncCompositionComponentIndex } from './components.js';

function notFound(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 404;
  return err;
}

function badRequest(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 400;
  return err;
}

export const createDesignComponentSetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_COMPONENT_CATEGORIES).default('custom'),
  status: z.enum(['draft', 'active']).default('draft'),
  variantAxes: z.unknown(),
  defaultCombination: z.record(z.string().uuid(), z.string().uuid()),
  tags: z.array(z.string().max(48)).max(24).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  thumbnailAssetId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const upsertVariantSchema = z.object({
  combination: z.record(z.string().uuid(), z.string().uuid()),
  componentId: z.string().uuid(),
  componentRevisionId: z.string().uuid(),
  label: z.string().trim().max(200).optional().nullable(),
});

async function requireComponentSet(store, ownerRef, id) {
  const row = await store.getDesignComponentSet(ownerRef, id);
  if (!row || row.archivedAt) throw notFound('COMPONENT_SET_NOT_FOUND', 'Component Set not found');
  return row;
}

async function requireComponentRevision(store, ownerRef, componentId, revisionId) {
  const component = await store.getDesignComponent(ownerRef, componentId);
  if (!component || component.archivedAt) {
    throw notFound('COMPONENT_NOT_FOUND', 'Design Component not found');
  }
  const revision = await store.getDesignComponentRevision(ownerRef, revisionId);
  if (!revision) throw notFound('COMPONENT_REVISION_NOT_FOUND', 'Component revision not found');
  if (revision.componentId !== component.id) {
    throw badRequest('COMPONENT_REVISION_MISMATCH', 'Revision does not belong to Component');
  }
  return { component, revision };
}

export async function listDesignComponentSets(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const componentSets = await store.listDesignComponentSets(ownerRef, opts);
  return { componentSets };
}

export async function getDesignComponentSet(ownerRef, id) {
  const store = await getPlatformStore();
  const componentSet = await requireComponentSet(store, ownerRef, id);
  const variants = await store.listDesignComponentSetVariants(ownerRef, id);
  return { componentSet, variants };
}

export async function createDesignComponentSet(ownerRef, input) {
  const data = createDesignComponentSetSchema.parse(input);
  const axes = parseComponentSetAxes(data.variantAxes);
  const { combination, errors } = validateVariantCombination(axes, data.defaultCombination);
  if (errors.length) {
    const err = badRequest(errors[0].code, errors[0].message);
    err.errors = errors;
    throw err;
  }

  if (data.brandId) {
    const store = await getPlatformStore();
    const brand = await store.getBrand(ownerRef, data.brandId);
    if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  }

  const store = await getPlatformStore();
  const componentSet = await store.createDesignComponentSet({
    ownerRef,
    name: data.name,
    description: data.description ?? null,
    category: data.category,
    status: data.status,
    variantAxes: axes,
    defaultCombination: combination,
    tags: data.tags || [],
    brandId: data.brandId ?? null,
    brandRevisionId: data.brandRevisionId ?? null,
    thumbnailAssetId: data.thumbnailAssetId ?? null,
    metadata: data.metadata || {},
  });

  return { componentSet };
}

export async function updateDesignComponentSet(ownerRef, id, input) {
  const schema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    category: z.enum(DESIGN_COMPONENT_CATEGORIES).optional(),
    status: z.enum(['draft', 'active']).optional(),
    tags: z.array(z.string().max(48)).max(24).optional().nullable(),
    thumbnailAssetId: z.string().uuid().optional().nullable(),
    defaultCombination: z.record(z.string().uuid(), z.string().uuid()).optional(),
    variantAxes: z.unknown().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  });
  const data = schema.parse(input);
  const store = await getPlatformStore();
  const existing = await requireComponentSet(store, ownerRef, id);

  const patch = { ...data };
  if (data.variantAxes != null) {
    patch.variantAxes = parseComponentSetAxes(data.variantAxes);
  }
  const axes = patch.variantAxes || existing.variantAxes;
  if (data.defaultCombination) {
    const { combination, errors } = validateVariantCombination(axes, data.defaultCombination);
    if (errors.length) {
      const err = badRequest(errors[0].code, errors[0].message);
      err.errors = errors;
      throw err;
    }
    patch.defaultCombination = combination;
  }

  const componentSet = await store.updateDesignComponentSet(ownerRef, id, patch);
  return { componentSet };
}

export async function archiveDesignComponentSet(ownerRef, id) {
  const store = await getPlatformStore();
  await requireComponentSet(store, ownerRef, id);
  const componentSet = await store.archiveDesignComponentSet(ownerRef, id);
  return { componentSet };
}

export async function upsertDesignComponentSetVariant(ownerRef, componentSetId, input) {
  const data = upsertVariantSchema.parse(input);
  const store = await getPlatformStore();
  const componentSet = await requireComponentSet(store, ownerRef, componentSetId);
  const axes = parseComponentSetAxes(componentSet.variantAxes);
  const { combination, errors } = validateVariantCombination(axes, data.combination);
  if (errors.length) {
    const err = badRequest(errors[0].code, errors[0].message);
    err.errors = errors;
    throw err;
  }
  await requireComponentRevision(store, ownerRef, data.componentId, data.componentRevisionId);
  const key = combinationKey(combination, axes);
  const variant = await store.upsertDesignComponentSetVariant({
    ownerRef,
    componentSetId: componentSet.id,
    combinationKey: key,
    combination,
    componentId: data.componentId,
    componentRevisionId: data.componentRevisionId,
    label: data.label ?? null,
  });
  return { variant };
}

export async function listDesignComponentSetVariants(ownerRef, componentSetId) {
  const store = await getPlatformStore();
  await requireComponentSet(store, ownerRef, componentSetId);
  const variants = await store.listDesignComponentSetVariants(ownerRef, componentSetId);
  return { variants };
}

export async function resolveDesignComponentSetVariant(ownerRef, componentSetId, combination) {
  const store = await getPlatformStore();
  const componentSet = await requireComponentSet(store, ownerRef, componentSetId);
  const variants = await store.listDesignComponentSetVariants(ownerRef, componentSetId);
  const axes = parseComponentSetAxes(componentSet.variantAxes);
  try {
    const resolved = resolveComponentVariant(variants, axes, combination);
    return { componentSet, resolved };
  } catch (err) {
    err.status = err.status || 400;
    throw err;
  }
}

/**
 * Insert Component Set default (or explicit) variant as a Composition instance.
 */
export async function instantiateComponentSet(
  ownerRef,
  compositionId,
  {
    componentSetId,
    combination = null,
    x = 40,
    y = 40,
    width = null,
    height = null,
    expectedDocumentVersion,
    overrides = [],
  }
) {
  const store = await getPlatformStore();
  const composition = await store.getComposition(ownerRef, compositionId);
  if (!composition || composition.archivedAt) {
    throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  }
  const componentSet = await requireComponentSet(store, ownerRef, componentSetId);
  const variants = await store.listDesignComponentSetVariants(ownerRef, componentSetId);
  const axes = parseComponentSetAxes(componentSet.variantAxes);
  const combo = combination || componentSet.defaultCombination;
  let resolved;
  try {
    resolved = resolveComponentVariant(variants, axes, combo);
  } catch (err) {
    err.status = 400;
    throw err;
  }

  const { component, revision } = await requireComponentRevision(
    store,
    ownerRef,
    resolved.componentId,
    resolved.componentRevisionId
  );
  const componentDoc = parseComponentDocument(revision.document);
  const { overrides: validOverrides, errors } = validateComponentOverrides(
    componentDoc.properties,
    overrides
  );
  if (errors.length) {
    const err = badRequest(errors[0].code, errors[0].message);
    err.errors = errors;
    throw err;
  }

  const doc = parseCompositionDocument(composition.document);
  const w = width ?? componentDoc.intrinsicWidth;
  const h = height ?? componentDoc.intrinsicHeight;
  const zIndex = Math.max(0, ...doc.layers.map((l) => l.zIndex ?? 0)) + 1;
  const instance = {
    id: randomUUID(),
    type: 'component_instance',
    name: componentSet.name,
    componentId: component.id,
    componentRevisionId: revision.id,
    componentSetId: componentSet.id,
    variantProperties: resolved.combination,
    x,
    y,
    width: w,
    height: h,
    zIndex,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    overrides: validOverrides,
    fitMode: 'proportional',
    adaptation: {
      preserveAspectRatio: true,
      scaleBehaviour: 'proportional',
      semanticPriority: 'primary',
    },
  };

  const nextDoc = parseCompositionDocument({
    ...doc,
    layers: [...doc.layers, instance],
  });

  const { row, stale } = await store.updateComposition(
    ownerRef,
    compositionId,
    {
      document: nextDoc,
      canvasWidth: nextDoc.canvas.width,
      canvasHeight: nextDoc.canvas.height,
    },
    { expectedVersion: expectedDocumentVersion ?? composition.documentVersion }
  );
  if (stale) {
    const err = badRequest('COMPOSITION_STALE_VERSION', 'Composition was modified elsewhere');
    err.status = 409;
    throw err;
  }
  await syncCompositionComponentIndex(store, ownerRef, compositionId, null, nextDoc);
  return { composition: row, instance, resolved };
}

/**
 * Switch Component Instance to another variant in the same Component Set.
 * Distinct from updateComponentInstanceRevision (same Component, newer revision).
 */
export async function switchComponentInstanceVariant(
  ownerRef,
  compositionId,
  {
    instanceLayerId,
    combination,
    expectedDocumentVersion,
    dropIncompatibleOverrides = false,
  }
) {
  const store = await getPlatformStore();
  const composition = await store.getComposition(ownerRef, compositionId);
  if (!composition || composition.archivedAt) {
    throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  }
  const doc = parseCompositionDocument(composition.document);
  const idx = doc.layers.findIndex((l) => l.id === instanceLayerId);
  if (idx < 0 || doc.layers[idx].type !== 'component_instance') {
    throw badRequest('COMPONENT_INSTANCE_NOT_FOUND', 'Component Instance layer not found');
  }
  const layer = doc.layers[idx];
  if (!layer.componentSetId) {
    throw badRequest(
      'COMPONENT_SET_REQUIRED',
      'Instance is not linked to a Component Set; use revision update instead'
    );
  }

  const componentSet = await requireComponentSet(store, ownerRef, layer.componentSetId);
  const variants = await store.listDesignComponentSetVariants(ownerRef, componentSet.id);
  const axes = parseComponentSetAxes(componentSet.variantAxes);
  let resolved;
  try {
    resolved = resolveComponentVariant(variants, axes, combination);
  } catch (err) {
    err.status = 400;
    throw err;
  }

  const fromRev = await store.getDesignComponentRevision(ownerRef, layer.componentRevisionId);
  const toRev = await store.getDesignComponentRevision(ownerRef, resolved.componentRevisionId);
  if (!toRev) throw notFound('COMPONENT_REVISION_NOT_FOUND', 'Target Component revision not found');

  const fromDoc = fromRev ? parseComponentDocument(fromRev.document) : { properties: [] };
  const toDoc = parseComponentDocument(toRev.document);
  const evaluation = evaluateVariantSwitchOverrides(
    fromDoc.properties,
    toDoc.properties,
    layer.overrides || []
  );

  if (evaluation.incompatible.length && !dropIncompatibleOverrides) {
    const err = badRequest(
      'COMPONENT_OVERRIDE_CONFLICT',
      'Incompatible overrides must be resolved before switching variant'
    );
    err.evaluation = evaluation;
    throw err;
  }

  const nextOverrides = evaluation.compatible;
  const layers = [...doc.layers];
  layers[idx] = {
    ...layer,
    componentId: resolved.componentId,
    componentRevisionId: resolved.componentRevisionId,
    variantProperties: resolved.combination,
    name: layer.name || componentSet.name,
    overrides: nextOverrides,
  };
  const nextDoc = parseCompositionDocument({ ...doc, layers });

  const { row, stale } = await store.updateComposition(
    ownerRef,
    compositionId,
    {
      document: nextDoc,
      canvasWidth: nextDoc.canvas.width,
      canvasHeight: nextDoc.canvas.height,
    },
    { expectedVersion: expectedDocumentVersion ?? composition.documentVersion }
  );
  if (stale) {
    const err = badRequest('COMPOSITION_STALE_VERSION', 'Composition was modified elsewhere');
    err.status = 409;
    throw err;
  }
  await syncCompositionComponentIndex(store, ownerRef, compositionId, null, nextDoc);
  return { composition: row, evaluation, resolved, overrides: nextOverrides };
}

export { DESIGN_COMPONENT_SET_STATUSES };
