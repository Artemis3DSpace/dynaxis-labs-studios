/**
 * Dynaxis Design Component service — reusable visual fragments (not React/code components).
 */

import 'server-only';
import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { resolveWorkspaceOrganizationForLegacyWrite } from '../identity/workspace-ownership.js';
import {
  DESIGN_COMPONENT_STATUSES,
  DESIGN_COMPONENT_CATEGORIES,
} from '../types.js';
import { resolveProjectId } from './projects.js';
import { parseComponentDocument, collectComponentDocumentAssetIds, componentDocumentToCompositionDocument } from '../components/document.js';
import {
  validateComponentOverrides,
  evaluateComponentRevisionUpdate,
} from '../components/properties.js';
import {
  createComponentDocumentFromLayers,
  boundingBoxOfLayers,
  buildReplacementInstanceLayer,
} from '../components/create-from-layers.js';
import {
  resolveComponentInstance,
  expandCompositionDocument,
} from '../components/resolver.js';
import { normalizeDesignComponentCategory } from '../components/categories.js';
import {
  parseCompositionDocument,
  collectDocumentAssetIds,
  collectDocumentComponentRevisionIds,
} from '../compositions/document.js';
import { renderCompositionPng } from '../compositions/render-export.js';
import { storeAndRegisterRenderedPng } from '../storage/register-rendered.js';
import { resolveAssetBlobStore } from '../storage/blob-store.js';
import { getDb, isMemoryDriverAllowed } from '../db/client.js';
import {
  dynaxisDesignComponents,
  dynaxisDesignComponentSets,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { applyTokenBindingsToDocument } from '../design-systems/bindings.js';
import { loadDesignSystemRevisionDocument } from './design-systems.js';

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

export const createDesignComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_COMPONENT_CATEGORIES).default('custom'),
  status: z.enum(['draft', 'active']).default('draft'),
  document: z.unknown(),
  tags: z.array(z.string().max(48)).max(24).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).default('neutral'),
  thumbnailAssetId: z.string().uuid().optional().nullable(),
  sourceCompositionId: z.string().uuid().optional().nullable(),
  sourceCompositionRevisionId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createComponentFromLayersSchema = z.object({
  compositionId: z.string().uuid(),
  layerIds: z.array(z.string().uuid()).min(1).max(48),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_COMPONENT_CATEGORIES).default('custom'),
  tags: z.array(z.string().max(48)).max(24).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).default('neutral'),
  /** Explicit opt-in — never replace silently. */
  replaceSelectedLayers: z.boolean().default(false),
  properties: z.array(z.unknown()).max(48).optional().nullable(),
  documentVersion: z.number().int().positive().optional(),
});

export const updateDesignComponentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_COMPONENT_CATEGORIES).optional(),
  status: z.enum(['draft', 'active']).optional(),
  tags: z.array(z.string().max(48)).max(24).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).optional(),
  thumbnailAssetId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createComponentRevisionSchema = z.object({
  document: z.unknown(),
  reason: z.string().trim().max(500).optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  activate: z.boolean().default(true),
  brandRevisionId: z.string().uuid().optional().nullable(),
});

async function requireComponent(store, ownerRef, id) {
  const row = await store.getDesignComponent(ownerRef, id);
  if (!row || row.archivedAt) throw notFound('COMPONENT_NOT_FOUND', 'Design Component not found');
  return row;
}

async function requireComponentRevision(store, ownerRef, id) {
  const row = await store.getDesignComponentRevision(ownerRef, id);
  if (!row) throw notFound('COMPONENT_REVISION_NOT_FOUND', 'Component revision not found');
  return row;
}

async function validateComponentDocAssets(store, ownerRef, document) {
  const doc = parseComponentDocument(document);
  for (const id of collectComponentDocumentAssetIds(doc)) {
    const asset = await store.getAsset(ownerRef, id);
    if (!asset) throw notFound('ASSET_NOT_FOUND', `Asset not found: ${id}`);
    if (asset.type !== 'image') throw badRequest('ASSET_NOT_IMAGE', 'Component image layers require image assets');
  }
  return doc;
}

function normalizeTags(tags) {
  if (!tags) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 24);
}

/**
 * Sync dependency index from Composition Document layers.
 */
export async function syncCompositionComponentIndex(store, ownerRef, compositionId, compositionRevisionId, document) {
  const doc = parseCompositionDocument(document);
  const instances = (doc.layers || [])
    .filter((l) => l.type === 'component_instance')
    .map((l) => ({
      layerId: l.id,
      componentId: l.componentId,
      componentRevisionId: l.componentRevisionId,
    }));
  if (typeof store.syncCompositionComponentInstances === 'function') {
    await store.syncCompositionComponentInstances(
      ownerRef,
      compositionId,
      compositionRevisionId,
      instances
    );
  }
  return instances;
}

/**
 * Validate Component Instance layers in a Composition Document (ownership + overrides).
 */
export async function validateCompositionComponentInstances(store, ownerRef, document) {
  const doc = parseCompositionDocument(document);
  for (const layer of doc.layers) {
    if (layer.type !== 'component_instance') continue;
    const component = await store.getDesignComponent(ownerRef, layer.componentId);
    if (!component) {
      throw notFound('COMPONENT_NOT_FOUND', `Component not found: ${layer.componentId}`);
    }
    const revision = await store.getDesignComponentRevision(ownerRef, layer.componentRevisionId);
    if (!revision || revision.componentId !== layer.componentId) {
      throw notFound(
        'COMPONENT_REVISION_UNAVAILABLE',
        `Component revision unavailable: ${layer.componentRevisionId}`
      );
    }
    const componentDoc = parseComponentDocument(revision.document);
    const { errors } = validateComponentOverrides(componentDoc.properties, layer.overrides || []);
    if (errors.length) {
      const err = badRequest(errors[0].code || 'COMPONENT_OVERRIDE_INVALID', errors[0].message);
      err.errors = errors;
      throw err;
    }
    for (const ov of layer.overrides || []) {
      if (ov.type === 'asset') {
        const asset = await store.getAsset(ownerRef, ov.value);
        if (!asset) throw notFound('ASSET_NOT_FOUND', `Override asset not found: ${ov.value}`);
        if (asset.type !== 'image') throw badRequest('ASSET_NOT_IMAGE', 'Asset override must be an image');
      }
    }
  }
  return doc;
}

export async function listDesignComponents(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const components = await store.listDesignComponents(ownerRef, opts);
  return { components };
}

export async function getDesignComponent(ownerRef, id) {
  const store = await getPlatformStore();
  const component = await requireComponent(store, ownerRef, id);
  const revisions = await store.listDesignComponentRevisions(ownerRef, id);
  return { component, revisions };
}

export async function createDesignComponent(ownerRef, input) {
  const data = createDesignComponentSchema.parse(input);
  const store = await getPlatformStore();
  const organizationId = await resolveWorkspaceOrganizationForLegacyWrite(ownerRef);
  const document = await validateComponentDocAssets(store, ownerRef, data.document);

  if (data.thumbnailAssetId) {
    const thumb = await store.getAsset(ownerRef, data.thumbnailAssetId);
    if (!thumb) throw notFound('ASSET_NOT_FOUND', 'Thumbnail asset not found');
  }

  const component = await store.createDesignComponent({
    ownerRef,
    organizationId,
    name: data.name,
    description: data.description ?? null,
    category: normalizeDesignComponentCategory(data.category),
    status: data.status,
    brandId: data.brandId ?? null,
    brandRevisionId: data.brandRevisionId ?? null,
    brandBinding: data.brandBinding,
    thumbnailAssetId: data.thumbnailAssetId ?? null,
    tags: normalizeTags(data.tags),
    metadata: data.metadata || {},
  });

  const revision = await store.createDesignComponentRevision({
    componentId: component.id,
    ownerRef,
    document,
    intrinsicWidth: document.intrinsicWidth,
    intrinsicHeight: document.intrinsicHeight,
    propertyDefinitions: document.properties,
    sourceCompositionId: data.sourceCompositionId ?? null,
    sourceCompositionRevisionId: data.sourceCompositionRevisionId ?? null,
    brandRevisionId: data.brandRevisionId ?? null,
    label: 'v1',
    reason: 'initial',
  });

  const updated = await store.updateDesignComponent(ownerRef, component.id, {
    currentRevisionId: revision.id,
  });

  return { component: updated, revision };
}

/**
 * Create Component from selected Composition layers.
 */
export async function createComponentFromLayers(ownerRef, input) {
  const data = createComponentFromLayersSchema.parse(input);
  const store = await getPlatformStore();
  const composition = await store.getComposition(ownerRef, data.compositionId);
  if (!composition || composition.archivedAt) {
    throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  }

  const doc = parseCompositionDocument(composition.document);
  const selected = doc.layers.filter((l) => data.layerIds.includes(l.id));
  if (selected.length !== data.layerIds.length) {
    throw badRequest('COMPONENT_LAYER_NOT_FOUND', 'One or more selected layers were not found');
  }

  const componentDoc = createComponentDocumentFromLayers(selected, {
    properties: data.properties || [],
  });
  const validated = await validateComponentDocAssets(store, ownerRef, componentDoc);
  const box = boundingBoxOfLayers(selected);

  const created = await createDesignComponent(ownerRef, {
    name: data.name,
    description: data.description,
    category: data.category,
    document: validated,
    tags: data.tags,
    brandId: data.brandId,
    brandRevisionId: data.brandRevisionId,
    brandBinding: data.brandBinding,
    sourceCompositionId: composition.id,
    sourceCompositionRevisionId: composition.currentRevisionId,
  });

  let compositionResult = null;
  if (data.replaceSelectedLayers) {
    const removeIds = new Set(data.layerIds);
    const remaining = doc.layers.filter((l) => !removeIds.has(l.id));
    const zIndex = Math.max(0, ...selected.map((l) => l.zIndex ?? 0));
    const instance = buildReplacementInstanceLayer(
      created.component,
      created.revision,
      validated,
      box,
      zIndex
    );
    const nextDoc = parseCompositionDocument({
      ...doc,
      layers: [...remaining, instance],
    });
    const { row, stale } = await store.updateComposition(
      ownerRef,
      composition.id,
      {
        document: nextDoc,
        canvasWidth: nextDoc.canvas.width,
        canvasHeight: nextDoc.canvas.height,
      },
      { expectedVersion: data.documentVersion ?? composition.documentVersion }
    );
    if (stale) {
      const err = badRequest('COMPOSITION_STALE_VERSION', 'Composition was modified elsewhere');
      err.status = 409;
      throw err;
    }
    await syncCompositionComponentIndex(store, ownerRef, composition.id, null, nextDoc);
    compositionResult = row;
  }

  return {
    component: created.component,
    revision: created.revision,
    composition: compositionResult,
    replaced: Boolean(data.replaceSelectedLayers),
    boundingBox: box,
  };
}

export async function createComponentRevision(ownerRef, componentId, input) {
  const data = createComponentRevisionSchema.parse(input);
  const store = await getPlatformStore();
  const component = await requireComponent(store, ownerRef, componentId);
  const document = await validateComponentDocAssets(store, ownerRef, data.document);

  const revision = await store.createDesignComponentRevision({
    componentId: component.id,
    ownerRef,
    document,
    intrinsicWidth: document.intrinsicWidth,
    intrinsicHeight: document.intrinsicHeight,
    propertyDefinitions: document.properties,
    brandRevisionId: data.brandRevisionId ?? component.brandRevisionId ?? null,
    reason: data.reason ?? null,
    label: data.label ?? null,
  });

  let updated = component;
  if (data.activate) {
    updated = await store.updateDesignComponent(ownerRef, component.id, {
      currentRevisionId: revision.id,
      status: component.status === 'archived' ? component.status : 'active',
    });
  }

  return { component: updated, revision };
}

export async function updateDesignComponent(ownerRef, id, input) {
  const data = updateDesignComponentSchema.parse(input);
  const store = await getPlatformStore();
  await requireComponent(store, ownerRef, id);
  const patch = { ...data };
  if (patch.tags) patch.tags = normalizeTags(patch.tags);
  if (patch.category) patch.category = normalizeDesignComponentCategory(patch.category);
  const component = await store.updateDesignComponent(ownerRef, id, patch);
  return { component };
}

export async function archiveDesignComponent(ownerRef, id) {
  const store = await getPlatformStore();
  await requireComponent(store, ownerRef, id);
  const component = await store.archiveDesignComponent(ownerRef, id);
  return { component };
}

export async function listComponentRevisions(ownerRef, componentId) {
  const store = await getPlatformStore();
  await requireComponent(store, ownerRef, componentId);
  const revisions = await store.listDesignComponentRevisions(ownerRef, componentId);
  return { revisions };
}

export async function getDesignComponentRevision(ownerRef, componentId, revisionId) {
  const store = await getPlatformStore();
  // Support legacy (ownerRef, revisionId) callers
  if (revisionId == null) {
    const revision = await requireComponentRevision(store, ownerRef, componentId);
    return { revision };
  }
  await requireComponent(store, ownerRef, componentId);
  const revision = await requireComponentRevision(store, ownerRef, revisionId);
  if (revision.componentId !== componentId) {
    throw notFound('COMPONENT_REVISION_NOT_FOUND', 'Component revision not found');
  }
  return { revision };
}

export async function listComponentUsage(ownerRef, componentId) {
  const store = await getPlatformStore();
  await requireComponent(store, ownerRef, componentId);
  const usage = await store.listComponentUsage(ownerRef, componentId);
  return { usage, instanceCount: usage.length };
}

/**
 * Evaluate whether an instance can update to a target revision (explicit only).
 */
export async function evaluateComponentInstanceUpdate(
  ownerRef,
  {
    componentId,
    currentRevisionId,
    targetRevisionId,
    overrides,
  }
) {
  const store = await getPlatformStore();
  const current = await requireComponentRevision(store, ownerRef, currentRevisionId);
  const target = await requireComponentRevision(store, ownerRef, targetRevisionId);
  if (current.componentId !== componentId || target.componentId !== componentId) {
    throw badRequest('COMPONENT_REVISION_MISMATCH', 'Revisions do not belong to the same Component');
  }
  const fromDoc = parseComponentDocument(current.document);
  const toDoc = parseComponentDocument(target.document);
  const result = evaluateComponentRevisionUpdate(fromDoc.properties, toDoc.properties, overrides || []);
  return {
    currentRevisionId,
    targetRevisionId,
    updateAvailable: currentRevisionId !== targetRevisionId,
    ...result,
  };
}

/**
 * Apply explicit revision update on a Composition draft instance layer.
 */
export async function updateComponentInstanceRevision(
  ownerRef,
  compositionId,
  {
    instanceLayerId,
    currentRevisionId,
    targetRevisionId,
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
  if (layer.componentRevisionId !== currentRevisionId) {
    throw badRequest('COMPONENT_REVISION_MISMATCH', 'Instance is not pinned to the expected current revision');
  }

  const evaluation = await evaluateComponentInstanceUpdate(ownerRef, {
    componentId: layer.componentId,
    currentRevisionId,
    targetRevisionId,
    overrides: layer.overrides,
  });

  if (evaluation.incompatible.length && !dropIncompatibleOverrides) {
    const err = badRequest(
      'COMPONENT_OVERRIDE_CONFLICT',
      'Incompatible overrides must be resolved before updating revision'
    );
    err.evaluation = evaluation;
    throw err;
  }

  const nextOverrides = dropIncompatibleOverrides
    ? evaluation.compatible
    : evaluation.compatible;

  const layers = [...doc.layers];
  layers[idx] = {
    ...layer,
    componentRevisionId: targetRevisionId,
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
  return { composition: row, evaluation, overrides: nextOverrides };
}

/**
 * Detach Component Instance → ordinary text/image layers.
 */
export async function detachComponentInstance(
  ownerRef,
  compositionId,
  { instanceLayerId, expectedDocumentVersion }
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
  const revision = await requireComponentRevision(store, ownerRef, layer.componentRevisionId);
  const resolved = resolveComponentInstance(
    revision.document,
    layer.overrides || [],
    {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      opacity: layer.opacity,
      visible: layer.visible,
      fitMode: layer.fitMode || 'proportional',
    }
  );

  const { randomUUID } = await import('node:crypto');
  const detachedLayers = resolved.layers.map((l, i) => ({
    ...l,
    id: randomUUID(),
    zIndex: (layer.zIndex ?? 0) + i,
  }));

  const layers = [...doc.layers];
  layers.splice(idx, 1, ...detachedLayers);
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
  return { composition: row, detachedLayerIds: detachedLayers.map((l) => l.id) };
}

/**
 * Insert Component Instance into Composition draft.
 */
export async function instantiateComponent(
  ownerRef,
  compositionId,
  {
    componentId,
    componentRevisionId = null,
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
  const component = await requireComponent(store, ownerRef, componentId);
  const revisionId = componentRevisionId || component.currentRevisionId;
  if (!revisionId) throw badRequest('COMPONENT_NO_REVISION', 'Component has no current revision');
  const revision = await requireComponentRevision(store, ownerRef, revisionId);
  if (revision.componentId !== component.id) {
    throw badRequest('COMPONENT_REVISION_MISMATCH', 'Revision does not belong to Component');
  }
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

  const { randomUUID } = await import('node:crypto');
  const doc = parseCompositionDocument(composition.document);
  const w = width ?? componentDoc.intrinsicWidth;
  const h = height ?? componentDoc.intrinsicHeight;
  const zIndex = Math.max(0, ...doc.layers.map((l) => l.zIndex ?? 0)) + 1;
  const instance = {
    id: randomUUID(),
    type: 'component_instance',
    name: component.name,
    componentId: component.id,
    componentRevisionId: revision.id,
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
  return { composition: row, instance };
}

export async function generateComponentThumbnail(ownerRef, componentId, opts = {}) {
  const store = await getPlatformStore();
  const component = await requireComponent(store, ownerRef, componentId);
  if (!component.currentRevisionId) {
    throw badRequest('COMPONENT_NO_REVISION', 'Component has no current revision');
  }
  const revision = await requireComponentRevision(store, ownerRef, component.currentRevisionId);
  const componentDoc = parseComponentDocument(revision.document);
  let compositionDoc = componentDocumentToCompositionDocument(componentDoc);

  const tokenRevisionId = compositionDoc.designSystem?.designSystemRevisionId;
  if (tokenRevisionId) {
    const dsRevision = await loadDesignSystemRevisionDocument(ownerRef, tokenRevisionId);
    if (dsRevision) {
      const { document: tokenResolved } = applyTokenBindingsToDocument(
        compositionDoc,
        dsRevision.document,
        {
          modesByCollection: compositionDoc.designSystem?.modes || {},
          rejectUnresolved: false,
        }
      );
      compositionDoc = tokenResolved;
    }
  }

  const project = await resolveProjectId(ownerRef, opts.projectId);
  const assetIds = collectDocumentAssetIds(compositionDoc);
  const assetsById = {};
  for (const id of assetIds) {
    const asset = await store.getAsset(ownerRef, id);
    if (!asset) throw notFound('ASSET_NOT_FOUND', `Asset not found: ${id}`);
    assetsById[id] = asset;
  }

  const { png, width, height, renderVersion } = await renderCompositionPng({
    document: compositionDoc,
    assetsById,
    fetchImpl: opts.fetchImpl,
    rasterizeFn: opts.rasterizeFn,
  });

  const blobStore =
    opts.blobStore || (await resolveAssetBlobStore(opts.blobStoreOpts || {}));
  const { asset } = await storeAndRegisterRenderedPng(ownerRef, {
    bytes: png,
    projectId: project.id,
    width,
    height,
    enforceDimensions: !opts.rasterizeFn,
    provider: 'dynaxis-component-thumbnail',
    blobStore,
    metadata: {
      kind: 'design_component_thumbnail',
      componentId: component.id,
      componentRevisionId: revision.id,
      renderVersion,
    },
  });

  const updated = await store.updateDesignComponent(ownerRef, component.id, {
    thumbnailAssetId: asset.id,
  });
  return { component: updated, asset, revision };
}

/**
 * Resolve Component revision document for rendering helpers.
 */
export async function loadComponentRevisionDocument(ownerRef, componentRevisionId) {
  const store = await getPlatformStore();
  const revision = await store.getDesignComponentRevision(ownerRef, componentRevisionId);
  if (!revision) return null;
  return revision;
}

export { DESIGN_ROUTE_LEGACY_COMPAT, resolveRouteOwnerRef } from './compositions.js';

async function findWorkspaceDesignResourceOwnership(table, type, resourceId) {
  const id = String(resourceId || '').trim();
  if (!id) {
    return null;
  }
  if (isMemoryDriverAllowed()) {
    return null;
  }
  const db = getDb();
  const rows = await db
    .select({
      id: table.id,
      organizationId: table.organizationId,
    })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    type,
    id: row.id,
    organizationId: row.organizationId ?? null,
    legacyOwnershipResolved: row.organizationId != null,
  };
}

export async function findDesignComponentOwnership(componentId) {
  const store = await getPlatformStore();
  if (typeof store.findDesignComponentOwnership === 'function') {
    return store.findDesignComponentOwnership(componentId);
  }
  return findWorkspaceDesignResourceOwnership(
    dynaxisDesignComponents,
    'design_component',
    componentId
  );
}

export async function findDesignComponentSetOwnership(componentSetId) {
  const store = await getPlatformStore();
  if (typeof store.findDesignComponentSetOwnership === 'function') {
    return store.findDesignComponentSetOwnership(componentSetId);
  }
  return findWorkspaceDesignResourceOwnership(
    dynaxisDesignComponentSets,
    'design_component_set',
    componentSetId
  );
}

export const designComponentOwnershipRepository = Object.freeze({
  async findResource({ type, id }) {
    if (type !== 'design_component') {
      return null;
    }
    return findDesignComponentOwnership(id);
  },
});

export const designComponentSetOwnershipRepository = Object.freeze({
  async findResource({ type, id }) {
    if (type !== 'design_component_set') {
      return null;
    }
    return findDesignComponentSetOwnership(id);
  },
});

export {
  resolveComponentInstance,
  expandCompositionDocument,
  parseComponentDocument,
  validateComponentOverrides,
  evaluateComponentRevisionUpdate,
  DESIGN_COMPONENT_STATUSES,
  DESIGN_COMPONENT_CATEGORIES,
};
