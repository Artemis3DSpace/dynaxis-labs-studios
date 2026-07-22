/**
 * Dynaxis Composition service — non-destructive editable documents + export.
 */

import 'server-only';
import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import {
  COMPOSITION_EXPORT_FORMATS,
  COMPOSITION_MAX_CANVAS_PX,
  COMPOSITION_MIN_CANVAS_PX,
  COMPOSITION_RENDER_VERSION,
} from '../types.js';
import { resolveProjectId } from './projects.js';
import {
  parseCompositionDocument,
  collectDocumentAssetIds,
  collectDocumentComponentRevisionIds,
} from '../compositions/document.js';
import {
  validateCompositionComponentInstances,
  syncCompositionComponentIndex,
  loadComponentRevisionDocument,
} from './components.js';
import { expandCompositionDocument } from '../components/resolver.js';
import {
  buildInitialAssetDocument,
  buildInitialDeliverableDocument,
  canvasDimensionsFromAspect,
} from '../compositions/initial-layout.js';
import { renderCompositionPng } from '../compositions/render-export.js';
import { getCampaignFormat } from '../campaigns/formats.js';
import { buildBrandVisualContext } from '../brands/consumer.js';
import { storeAndRegisterRenderedPng } from '../storage/register-rendered.js';
import { resolveAssetBlobStore } from '../storage/blob-store.js';
import { applyTokenBindingsToDocument } from '../design-systems/bindings.js';

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

function conflict(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 409;
  return err;
}

export const updateCompositionDraftSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  document: z.unknown(),
  documentVersion: z.number().int().positive(),
});

export const saveCompositionRevisionSchema = z.object({
  label: z.string().trim().max(200).optional().nullable(),
  document: z.unknown().optional(),
  documentVersion: z.number().int().positive().optional(),
});

export const createCompositionFromAssetSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
});

export const createCompositionFromDeliverableSchema = z.object({
  deliverableId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  templateId: z.string().uuid().optional().nullable(),
  templateRevisionId: z.string().uuid().optional().nullable(),
});

export const setDeliverableFinalAssetSchema = z.object({
  assetId: z.string().uuid(),
});

async function requireComposition(store, ownerRef, id) {
  const row = await store.getComposition(ownerRef, id);
  if (!row || row.archivedAt) throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  return row;
}

async function requireImageAsset(store, ownerRef, assetId, projectId = null) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  // Owner-scoped authorization. Same-owner cross-Project Assets are allowed for
  // Brand / Product / Character identity Assets and Component masters (matches
  // templates.js + design-agent.js reuse policy). projectId is retained for
  // call-site clarity / future preferred-project hints — do not hard-reject.
  void projectId;
  if (asset.type !== 'image') {
    throw badRequest('ASSET_NOT_IMAGE', 'Asset must be an image');
  }
  return asset;
}

async function validateDocumentAssets(store, ownerRef, projectId, document) {
  const doc = await validateCompositionComponentInstances(store, ownerRef, document);
  for (const id of collectDocumentAssetIds(doc)) {
    await requireImageAsset(store, ownerRef, id, projectId);
  }
  return doc;
}

function snapshotFromComposition(composition, doc) {
  return {
    reason: 'revision',
    document: doc,
    sourceAssetId: composition.sourceAssetId,
    brandId: composition.brandId,
    brandRevisionId: composition.brandRevisionId,
    campaignId: composition.campaignId,
    campaignDeliverableId: composition.campaignDeliverableId,
    canvas: { width: composition.canvasWidth, height: composition.canvasHeight },
  };
}

export async function getComposition(ownerRef, id) {
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, id);
  const revisions = await store.listCompositionRevisions(ownerRef, id);
  const exports = await store.listCompositionExports(ownerRef, id);
  return { composition, revisions, exports };
}

export async function listCompositions(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const compositions = await store.listCompositions(ownerRef, opts);
  return { compositions };
}

export async function createCompositionFromAsset(ownerRef, input) {
  const data = createCompositionFromAssetSchema.parse(input);
  const store = await getPlatformStore();
  const project = await resolveProjectId(ownerRef, data.projectId);
  const asset = await requireImageAsset(store, ownerRef, data.assetId, project.id);
  const width = asset.width || 1080;
  const height = asset.height || 1080;
  const document = buildInitialAssetDocument({
    backgroundAssetId: asset.id,
    width,
    height,
  });
  parseCompositionDocument(document);

  const composition = await store.createComposition({
    ownerRef,
    projectId: project.id,
    name: data.name || `Edit — ${asset.id.slice(0, 8)}`,
    sourceAssetId: asset.id,
    canvasWidth: width,
    canvasHeight: height,
    aspectRatio: null,
    document,
    status: 'draft',
  });
  return { composition };
}

export async function createCompositionFromDeliverable(ownerRef, input) {
  const data = createCompositionFromDeliverableSchema.parse(input);
  if (data.templateId) {
    const { createCompositionFromDeliverableWithTemplate } = await import(
      './templates.js'
    );
    return createCompositionFromDeliverableWithTemplate(ownerRef, {
      deliverableId: data.deliverableId,
      templateId: data.templateId,
      templateRevisionId: data.templateRevisionId,
      name: data.name,
    });
  }
  const store = await getPlatformStore();

  const existing = await store.getCompositionByDeliverable(ownerRef, data.deliverableId);
  if (existing) return { composition: existing, created: false };

  const deliverable = await store.getCampaignDeliverable(ownerRef, data.deliverableId);
  if (!deliverable) throw notFound('DELIVERABLE_NOT_FOUND', 'Deliverable not found');
  if (deliverable.status !== 'completed' || !deliverable.assetId) {
    throw badRequest('DELIVERABLE_NOT_READY', 'Deliverable must be completed with an image asset');
  }

  const campaign = await store.getCampaign(ownerRef, deliverable.campaignId);
  if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');

  const asset = await requireImageAsset(
    store,
    ownerRef,
    deliverable.assetId,
    campaign.projectId
  );
  const format = getCampaignFormat(deliverable.formatId);
  const dims = canvasDimensionsFromAspect(format?.aspectRatio, asset.width || 1080);

  let brandColors = [];
  let brandFonts = [];
  if (campaign.brandId && campaign.brandRevisionId) {
    const brand = await store.getBrand(ownerRef, campaign.brandId);
    const revision = await store.getBrandRevision(ownerRef, campaign.brandRevisionId);
    const brandAssets = await store.listBrandAssets(campaign.brandId);
    const visual = buildBrandVisualContext(brand, revision, brandAssets);
    brandColors = [...(visual.primaryColors || []), ...(visual.secondaryColors || [])];
    brandFonts = visual.fonts || [];
  }

  const document = buildInitialDeliverableDocument({
    formatId: deliverable.formatId,
    headline: deliverable.headline || '',
    body: deliverable.body || '',
    cta: deliverable.cta || '',
    backgroundAssetId: asset.id,
    brandColors,
    brandFonts,
    canvasWidth: dims.width,
    canvasHeight: dims.height,
  });
  parseCompositionDocument(document);

  const composition = await store.createComposition({
    ownerRef,
    projectId: campaign.projectId,
    name: data.name || `Edit — ${deliverable.formatId}`,
    sourceAssetId: asset.id,
    campaignId: campaign.id,
    campaignRevisionId: deliverable.campaignRevisionId,
    campaignConceptId: deliverable.conceptId,
    campaignDeliverableId: deliverable.id,
    brandId: campaign.brandId,
    brandRevisionId: campaign.brandRevisionId,
    canvasWidth: dims.width,
    canvasHeight: dims.height,
    aspectRatio: format?.aspectRatio || null,
    document,
    status: 'draft',
  });

  await store.updateCampaignDeliverable(ownerRef, deliverable.id, {
    compositionId: composition.id,
  });

  return { composition, created: true };
}

export async function updateCompositionDraft(ownerRef, compositionId, input) {
  const data = updateCompositionDraftSchema.parse(input);
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, compositionId);
  const doc = await validateDocumentAssets(
    store,
    ownerRef,
    composition.projectId,
    data.document
  );

  if (
    doc.canvas.width < COMPOSITION_MIN_CANVAS_PX ||
    doc.canvas.height < COMPOSITION_MIN_CANVAS_PX ||
    doc.canvas.width > COMPOSITION_MAX_CANVAS_PX ||
    doc.canvas.height > COMPOSITION_MAX_CANVAS_PX
  ) {
    throw badRequest('CANVAS_DIMENSIONS_INVALID', 'Canvas dimensions out of range');
  }

  const { row, stale } = await store.updateComposition(
    ownerRef,
    compositionId,
    {
      name: data.name ?? composition.name,
      document: doc,
      canvasWidth: doc.canvas.width,
      canvasHeight: doc.canvas.height,
      status: 'active',
      ...(doc.designSystem?.designSystemId != null
        ? { designSystemId: doc.designSystem.designSystemId }
        : {}),
      ...(doc.designSystem?.designSystemRevisionId != null
        ? { designSystemRevisionId: doc.designSystem.designSystemRevisionId }
        : {}),
      ...(doc.designSystem?.modes != null
        ? { designSystemModes: doc.designSystem.modes || {} }
        : {}),
    },
    { expectedVersion: data.documentVersion }
  );

  if (stale) {
    throw conflict('COMPOSITION_STALE_VERSION', 'Composition was modified elsewhere');
  }
  await syncCompositionComponentIndex(store, ownerRef, compositionId, null, doc);
  return { composition: row };
}

export async function saveCompositionRevision(ownerRef, compositionId, input = {}) {
  const data = saveCompositionRevisionSchema.parse(input);
  const store = await getPlatformStore();
  let composition = await requireComposition(store, ownerRef, compositionId);

  if (data.document != null) {
    const updated = await updateCompositionDraft(ownerRef, compositionId, {
      document: data.document,
      documentVersion: data.documentVersion ?? composition.documentVersion,
    });
    composition = updated.composition;
  }

  const doc = parseCompositionDocument(composition.document);
  const revision = await store.createCompositionRevision({
    compositionId,
    ownerRef,
    label: data.label ?? null,
    snapshot: snapshotFromComposition(composition, doc),
  });
  await store.updateComposition(ownerRef, compositionId, {
    currentRevisionId: revision.id,
  });
  await syncCompositionComponentIndex(store, ownerRef, compositionId, revision.id, doc);
  return { composition, revision };
}

/**
 * Resolve pinned Design System revision → apply token bindings before Component expansion.
 * Same pure resolver used by preview and export.
 */
export async function resolveCompositionTokens(ownerRef, composition, document) {
  const store = await getPlatformStore();
  const ctx = document?.designSystem || {};
  const revisionId =
    composition.designSystemRevisionId || ctx.designSystemRevisionId || null;
  if (!revisionId) {
    return { document, tokenDocument: null, warnings: [], modesByCollection: {} };
  }
  const revision = await store.getDesignSystemRevision(ownerRef, revisionId);
  if (!revision) {
    const err = notFound(
      'DESIGN_SYSTEM_REVISION_NOT_FOUND',
      `Pinned Design System revision not found: ${revisionId}`
    );
    throw err;
  }
  const modesByCollection = {
    ...(composition.designSystemModes || {}),
    ...(ctx.modes || {}),
  };
  const { document: resolvedDoc, warnings, errors } = applyTokenBindingsToDocument(
    document,
    revision.document,
    { modesByCollection, rejectUnresolved: true }
  );
  if (errors.length) {
    const first = errors[0];
    throw Object.assign(new Error(first.message), first);
  }
  return {
    document: resolvedDoc,
    tokenDocument: revision.document,
    warnings,
    modesByCollection,
    designSystemRevisionId: revision.id,
    designSystemId: revision.designSystemId,
  };
}

export async function exportComposition(ownerRef, compositionId, opts = {}) {
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, compositionId);
  const doc = parseCompositionDocument(composition.document);

  const { document: tokenResolvedDoc, tokenDocument, modesByCollection } =
    await resolveCompositionTokens(ownerRef, composition, doc);

  const { document: expandedDoc, errors: expandErrors } = await expandCompositionDocument(
    tokenResolvedDoc,
    async (revisionId) => loadComponentRevisionDocument(ownerRef, revisionId),
    {
      tokenDocument,
      modesByCollection,
      rejectUnresolvedTokens: true,
    }
  );
  if (expandErrors.some((e) => e.code === 'COMPONENT_REVISION_UNAVAILABLE')) {
    const first = expandErrors.find((e) => e.code === 'COMPONENT_REVISION_UNAVAILABLE');
    throw notFound('COMPONENT_REVISION_UNAVAILABLE', first.message);
  }

  const assetIds = new Set(collectDocumentAssetIds(expandedDoc));
  // Also collect assets from pinned component masters (image layers not in overrides)
  for (const revisionId of collectDocumentComponentRevisionIds(doc)) {
    const rev = await loadComponentRevisionDocument(ownerRef, revisionId);
    if (!rev) continue;
    for (const id of collectDocumentAssetIds({
      background: { kind: 'color', color: '#000' },
      layers: rev.document?.layers || [],
    })) {
      assetIds.add(id);
    }
  }

  const assetIdList = [...assetIds];
  const assetsById = {};
  for (const id of assetIdList) {
    assetsById[id] = await requireImageAsset(
      store,
      ownerRef,
      id,
      composition.projectId
    );
  }

  const { png, width, height, renderVersion } = await renderCompositionPng({
    document: expandedDoc,
    assetsById,
    fetchImpl: opts.fetchImpl,
    rasterizeFn: opts.rasterizeFn,
    alreadyExpanded: true,
  });

  const blobStore =
    opts.blobStore || (await resolveAssetBlobStore(opts.blobStoreOpts || {}));
  const { asset: derived, put, validated } = await storeAndRegisterRenderedPng(
    ownerRef,
    {
      bytes: png,
      projectId: composition.projectId,
      width,
      height,
      // Unit tests inject rasterizeFn with fixture PNGs; enforce dims for real Resvg only
      enforceDimensions: !opts.rasterizeFn,
      provider: 'dynaxis-composition',
      blobStore,
      metadata: {
        derivation: {
          compositionId: composition.id,
          campaignId: composition.campaignId,
          campaignDeliverableId: composition.campaignDeliverableId,
          sourceAssetIds: assetIdList,
          renderFormat: 'png',
          renderVersion,
        },
      },
    }
  );

  const revision =
    composition.currentRevisionId &&
    (await store.getCompositionRevision(ownerRef, composition.currentRevisionId));

  let revisionId = revision?.id;
  if (!revisionId) {
    const saved = await saveCompositionRevision(ownerRef, compositionId, {
      label: 'pre-export',
    });
    revisionId = saved.revision.id;
  }

  const exportRow = await store.createCompositionExport({
    compositionId: composition.id,
    compositionRevisionId: revisionId,
    ownerRef,
    assetId: derived.id,
    exportFormat: 'png',
    width,
    height,
    renderVersion,
    metadata: {
      sourceAssetIds: assetIdList,
      storage: {
        provider: put.provider,
        objectKey: put.key,
        bucket: put.bucket || null,
        byteSize: validated.byteSize,
        checksumSha256: validated.checksumSha256,
        contentType: 'image/png',
        url: put.url,
      },
    },
  });

  for (const sourceId of assetIdList) {
    await store.createAssetDerivation({
      derivedAssetId: derived.id,
      sourceAssetId: sourceId,
      ownerRef,
      compositionId: composition.id,
      compositionRevisionId: revisionId,
      compositionExportId: exportRow.id,
      campaignId: composition.campaignId,
      campaignDeliverableId: composition.campaignDeliverableId,
      renderFormat: 'png',
      renderVersion,
    });
  }

  if (composition.sourceAssetId && !assetIdList.includes(composition.sourceAssetId)) {
    await store.createAssetDerivation({
      derivedAssetId: derived.id,
      sourceAssetId: composition.sourceAssetId,
      ownerRef,
      compositionId: composition.id,
      compositionRevisionId: revisionId,
      compositionExportId: exportRow.id,
      campaignId: composition.campaignId,
      campaignDeliverableId: composition.campaignDeliverableId,
      renderFormat: 'png',
      renderVersion,
    });
  }

  return { composition, export: exportRow, asset: derived };
}

export async function setDeliverableFinalAsset(ownerRef, compositionId, input) {
  const data = setDeliverableFinalAssetSchema.parse(input);
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, compositionId);
  if (!composition.campaignDeliverableId) {
    throw badRequest('NOT_DELIVERABLE_COMPOSITION', 'Composition is not linked to a deliverable');
  }
  await requireImageAsset(store, ownerRef, data.assetId, composition.projectId);
  const deliverable = await store.updateCampaignDeliverable(
    ownerRef,
    composition.campaignDeliverableId,
    { finalAssetId: data.assetId }
  );
  return { deliverable };
}

export async function archiveComposition(ownerRef, compositionId) {
  const store = await getPlatformStore();
  const composition = await store.archiveComposition(ownerRef, compositionId);
  if (!composition) throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  return { composition };
}

/**
 * Prepare clean-background regeneration request (no MuAPI call here).
 */
export async function prepareCleanBackgroundRegeneration(ownerRef, compositionId) {
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, compositionId);
  const doc = parseCompositionDocument(composition.document);
  const bgId =
    doc.background?.kind === 'asset' ? doc.background.assetId : composition.sourceAssetId;
  if (!bgId) throw badRequest('NO_BACKGROUND_ASSET', 'No background asset to regenerate');

  const sourceAsset = await store.getAsset(ownerRef, bgId);
  const generationRequest = {
    modelId: 'nano-banana-pro-edit',
    endpoint: '/api/v1/predictions',
    prompt:
      'Regenerate this image as a clean marketing background without any text, logos, or typography. Preserve style, lighting, and subject context.',
    outputType: 'image',
    projectId: composition.projectId,
    brandId: composition.brandId,
    brandRevisionId: composition.brandRevisionId,
    campaignId: composition.campaignId,
    campaignRevisionId: composition.campaignRevisionId,
    parameters: {
      prompt:
        'Clean background without text. Same visual style and composition as reference.',
      images_list: sourceAsset?.url ? [sourceAsset.url] : [],
      aspect_ratio: composition.aspectRatio || '1:1',
      compositionId: composition.id,
      cleanBackground: true,
    },
    referenceAssets: [{ assetId: bgId, role: 'creative_reference' }],
  };
  return { composition, generationRequest, previousBackgroundAssetId: bgId };
}

/**
 * Update composition background after successful regeneration.
 */
export async function applyCompositionBackgroundAsset(
  ownerRef,
  compositionId,
  { assetId, documentVersion }
) {
  const store = await getPlatformStore();
  const composition = await requireComposition(store, ownerRef, compositionId);
  await requireImageAsset(store, ownerRef, assetId, composition.projectId);
  const doc = parseCompositionDocument(composition.document);
  doc.background = {
    kind: 'asset',
    assetId,
    fit: doc.background?.fit || 'cover',
    position: doc.background?.position || 'middle-center',
    opacity: doc.background?.opacity ?? 1,
  };
  return updateCompositionDraft(ownerRef, compositionId, {
    document: doc,
    documentVersion: documentVersion ?? composition.documentVersion,
  });
}

export const compositionServiceImpl = {
  get: getComposition,
  list: listCompositions,
  createFromAsset: createCompositionFromAsset,
  createFromDeliverable: createCompositionFromDeliverable,
  updateDraft: updateCompositionDraft,
  saveRevision: saveCompositionRevision,
  export: exportComposition,
  setDeliverableFinalAsset,
  archive: archiveComposition,
  prepareCleanBackgroundRegeneration,
  applyCompositionBackgroundAsset,
};
