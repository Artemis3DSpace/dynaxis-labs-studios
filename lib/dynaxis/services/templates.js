/**
 * Dynaxis Design Template service — owner-scoped reusable blueprints.
 */

import 'server-only';
import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import {
  DESIGN_TEMPLATE_CATEGORIES,
  DESIGN_TEMPLATE_STATUSES,
  ADAPTATION_ENGINE_VERSION,
} from '../types.js';
import { resolveProjectId } from './projects.js';
import {
  parseTemplateDocument,
  compositionDocumentToTemplateDocument,
  collectTemplateDocumentAssetIds,
} from '../templates/document.js';
import { bindTemplateSlots, parseTemplateBindingContext } from '../templates/binding.js';
import {
  adaptCompositionDocument,
  resolveTargetCanvas,
} from '../templates/adapt.js';
import {
  isDesignTemplateCategory,
  normalizeTemplateTags,
} from '../templates/categories.js';
import { parseCompositionDocument, collectDocumentAssetIds } from '../compositions/document.js';
import { canvasDimensionsFromAspect } from '../compositions/initial-layout.js';
import { getCampaignFormat } from '../campaigns/formats.js';
import { buildBrandVisualContext } from '../brands/consumer.js';
import { normaliseProductAssetLinks } from '../products/consumer.js';
import { normaliseCharacterAssetLinks } from '../characters/consumer.js';
import { renderCompositionPng } from '../compositions/render-export.js';
import { storeAndRegisterRenderedPng } from '../storage/register-rendered.js';
import { resolveAssetBlobStore } from '../storage/blob-store.js';
import { syncCompositionComponentIndex } from './components.js';
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

export const createDesignTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_TEMPLATE_CATEGORIES).default('custom'),
  status: z.enum(['draft', 'active']).default('draft'),
  document: z.unknown(),
  tags: z.array(z.string()).max(24).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).default('neutral'),
  thumbnailAssetId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createTemplateFromCompositionSchema = z.object({
  compositionId: z.string().uuid(),
  compositionRevisionId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_TEMPLATE_CATEGORIES).default('custom'),
  slots: z.array(z.unknown()).max(48).optional().nullable(),
  tags: z.array(z.string()).max(24).optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).default('neutral'),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
});

export const updateDesignTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(DESIGN_TEMPLATE_CATEGORIES).optional(),
  status: z.enum(DESIGN_TEMPLATE_STATUSES).optional(),
  tags: z.array(z.string()).max(24).optional().nullable(),
  brandBinding: z.enum(['neutral', 'bound']).optional(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  thumbnailAssetId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createTemplateRevisionSchema = z.object({
  document: z.unknown(),
  label: z.string().trim().max(200).optional().nullable(),
  activate: z.boolean().default(true),
});

export const instantiateTemplateSchema = z.object({
  templateId: z.string().uuid(),
  templateRevisionId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200).optional().nullable(),
  binding: z.unknown(),
});

export const adaptCompositionSchema = z.object({
  compositionId: z.string().uuid(),
  compositionRevisionId: z.string().uuid().optional().nullable(),
  targetFormatId: z.string().max(64).optional().nullable(),
  targetAspectRatio: z.string().max(16).optional().nullable(),
  targetWidth: z.number().int().positive().max(4096).optional().nullable(),
  targetHeight: z.number().int().positive().max(4096).optional().nullable(),
  name: z.string().trim().min(1).max(200).optional().nullable(),
  omitDecorative: z.boolean().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

export const batchAdaptCompositionSchema = z.object({
  compositionId: z.string().uuid(),
  compositionRevisionId: z.string().uuid().optional().nullable(),
  targets: z
    .array(
      z.object({
        formatId: z.string().max(64).optional().nullable(),
        aspectRatio: z.string().max(16).optional().nullable(),
        name: z.string().trim().max(200).optional().nullable(),
      })
    )
    .min(1)
    .max(8),
  omitDecorative: z.boolean().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

async function requireTemplate(store, ownerRef, id) {
  const row = await store.getDesignTemplate(ownerRef, id);
  if (!row || row.archivedAt) throw notFound('TEMPLATE_NOT_FOUND', 'Design Template not found');
  return row;
}

async function requireImageAsset(store, ownerRef, assetId, projectId = null) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  if (asset.type !== 'image') {
    throw badRequest('ASSET_NOT_IMAGE', 'Asset must be an image');
  }
  if (projectId && asset.projectId !== projectId) {
    // Templates are cross-project; thumbnail may be from another project of same owner.
    // For Composition instantiation, assets must match target project OR be owned.
    // Cross-project owned assets are allowed for template defaults / logos that live
    // in Brand's home project — still owner-scoped.
  }
  return asset;
}

async function validateTemplateDocAssets(store, ownerRef, document) {
  const doc = parseTemplateDocument(document);
  for (const id of collectTemplateDocumentAssetIds(doc)) {
    await requireImageAsset(store, ownerRef, id);
  }
  return doc;
}

/**
 * Resolve Brand/Product/Character Asset IDs for binding precedence.
 */
async function resolveBindingMedia(store, ownerRef, binding) {
  const resolved = {
    brandLogoAssetId: null,
    brandReferenceAssetId: null,
    productAssetId: null,
    characterAssetId: null,
  };

  if (binding.brandId) {
    const brand = await store.getBrand(ownerRef, binding.brandId);
    if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
    if (binding.brandRevisionId) {
      const rev = await store.getBrandRevision(ownerRef, binding.brandRevisionId);
      if (!rev || rev.brandId !== brand.id) {
        throw notFound('BRAND_REVISION_NOT_FOUND', 'Brand revision not found');
      }
    }
    const brandAssets = await store.listBrandAssets(brand.id);
    const visual = buildBrandVisualContext(brand, null, brandAssets);
    resolved.brandLogoAssetId = visual.logoAssetId || null;
    resolved.brandReferenceAssetId =
      visual.references?.[1]?.assetId || visual.logoAssetId || null;
  }

  if (binding.productId) {
    const product = await store.getProduct(ownerRef, binding.productId);
    if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
    const productAssets = await store.listProductAssets(product.id);
    const links = normaliseProductAssetLinks(productAssets);
    const primary = links.find((a) => a.isPrimary) || links[0];
    resolved.productAssetId = primary?.assetId || null;
  }

  if (binding.characterId) {
    const character = await store.getCharacter(ownerRef, binding.characterId);
    if (!character) throw notFound('CHARACTER_NOT_FOUND', 'Character not found');
    const characterAssets = await store.listCharacterAssets(character.id);
    const links = normaliseCharacterAssetLinks(characterAssets);
    const identity =
      links.find((a) => a.role === 'identity_reference' && a.isPrimary) ||
      links.find((a) => a.role === 'identity_reference') ||
      links.find((a) => a.isPrimary) ||
      links[0];
    resolved.characterAssetId = identity?.assetId || null;
  }

  if (binding.campaignDeliverableId) {
    const deliverable = await store.getCampaignDeliverable(
      ownerRef,
      binding.campaignDeliverableId
    );
    if (!deliverable) throw notFound('DELIVERABLE_NOT_FOUND', 'Deliverable not found');
    if (binding.campaignId && deliverable.campaignId !== binding.campaignId) {
      throw badRequest('CAMPAIGN_MISMATCH', 'Deliverable does not belong to campaign');
    }
  }

  if (binding.campaignId) {
    const campaign = await store.getCampaign(ownerRef, binding.campaignId);
    if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');
  }

  return resolved;
}

export async function listDesignTemplates(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const templates = await store.listDesignTemplates(ownerRef, opts);
  return { templates };
}

export async function getDesignTemplate(ownerRef, id) {
  const store = await getPlatformStore();
  const template = await requireTemplate(store, ownerRef, id);
  const revisions = await store.listDesignTemplateRevisions(ownerRef, id);
  return { template, revisions };
}

export async function createDesignTemplate(ownerRef, input) {
  const data = createDesignTemplateSchema.parse(input);
  if (!isDesignTemplateCategory(data.category)) {
    throw badRequest('TEMPLATE_INVALID_CATEGORY', 'Invalid template category');
  }
  const store = await getPlatformStore();
  const document = await validateTemplateDocAssets(store, ownerRef, data.document);

  if (data.thumbnailAssetId) {
    await requireImageAsset(store, ownerRef, data.thumbnailAssetId);
  }
  if (data.brandId) {
    const brand = await store.getBrand(ownerRef, data.brandId);
    if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  }

  const template = await store.createDesignTemplate({
    ownerRef,
    name: data.name,
    description: data.description,
    category: data.category,
    status: data.status,
    thumbnailAssetId: data.thumbnailAssetId,
    brandId: data.brandBinding === 'bound' ? data.brandId : data.brandId || null,
    brandRevisionId: data.brandRevisionId,
    brandBinding: data.brandBinding,
    tags: normalizeTemplateTags(data.tags),
    metadata: data.metadata || {},
  });

  const revision = await store.createDesignTemplateRevision({
    templateId: template.id,
    ownerRef,
    document,
    canvasWidth: document.canvas.width,
    canvasHeight: document.canvas.height,
    aspectRatio: document.formatMetadata?.aspectRatio || null,
    label: 'v1',
  });

  const updated = await store.updateDesignTemplate(ownerRef, template.id, {
    currentRevisionId: revision.id,
  });

  return { template: updated, revision };
}

export async function createTemplateFromComposition(ownerRef, input) {
  const data = createTemplateFromCompositionSchema.parse(input);
  const store = await getPlatformStore();
  const composition = await store.getComposition(ownerRef, data.compositionId);
  if (!composition || composition.archivedAt) {
    throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  }

  let sourceDoc = composition.document;
  let sourceRevisionId = composition.currentRevisionId;
  if (data.compositionRevisionId) {
    const rev = await store.getCompositionRevision(ownerRef, data.compositionRevisionId);
    if (!rev || rev.compositionId !== composition.id) {
      throw notFound('COMPOSITION_REVISION_NOT_FOUND', 'Composition revision not found');
    }
    sourceDoc = rev.snapshot?.document || sourceDoc;
    sourceRevisionId = rev.id;
  }

  const compositionDoc = parseCompositionDocument(sourceDoc);
  const templateDoc = compositionDocumentToTemplateDocument(compositionDoc, {
    slots: data.slots || [],
    brandHints: {
      brandBinding: data.brandBinding,
      brandId: data.brandId || composition.brandId || null,
      brandRevisionId: data.brandRevisionId || composition.brandRevisionId || null,
      preferPrimaryLogo: true,
      preferBrandFonts: true,
      preferBrandPalette: true,
    },
    formatMetadata: {
      aspectRatio: composition.aspectRatio,
      formatId: null,
    },
  });
  await validateTemplateDocAssets(store, ownerRef, templateDoc);

  if (data.brandId) {
    const brand = await store.getBrand(ownerRef, data.brandId);
    if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  }

  const template = await store.createDesignTemplate({
    ownerRef,
    name: data.name,
    description: data.description,
    category: data.category,
    status: 'draft',
    sourceCompositionId: composition.id,
    brandId: data.brandId || (data.brandBinding === 'bound' ? composition.brandId : null),
    brandRevisionId: data.brandRevisionId || composition.brandRevisionId,
    brandBinding: data.brandBinding,
    tags: normalizeTemplateTags(data.tags),
    metadata: {
      createdFromCompositionId: composition.id,
      createdFromCompositionRevisionId: sourceRevisionId,
    },
  });

  const revision = await store.createDesignTemplateRevision({
    templateId: template.id,
    ownerRef,
    document: templateDoc,
    canvasWidth: templateDoc.canvas.width,
    canvasHeight: templateDoc.canvas.height,
    aspectRatio: composition.aspectRatio,
    sourceCompositionRevisionId: sourceRevisionId,
    label: 'v1',
  });

  const updated = await store.updateDesignTemplate(ownerRef, template.id, {
    currentRevisionId: revision.id,
  });

  return { template: updated, revision };
}

export async function updateDesignTemplate(ownerRef, id, input) {
  const data = updateDesignTemplateSchema.parse(input);
  const store = await getPlatformStore();
  await requireTemplate(store, ownerRef, id);
  if (data.thumbnailAssetId) {
    await requireImageAsset(store, ownerRef, data.thumbnailAssetId);
  }
  const patch = { ...data };
  if (data.tags) patch.tags = normalizeTemplateTags(data.tags);
  const template = await store.updateDesignTemplate(ownerRef, id, patch);
  return { template };
}

export async function archiveDesignTemplate(ownerRef, id) {
  const store = await getPlatformStore();
  await requireTemplate(store, ownerRef, id);
  const template = await store.archiveDesignTemplate(ownerRef, id);
  return { template };
}

export async function createTemplateRevision(ownerRef, templateId, input) {
  const data = createTemplateRevisionSchema.parse(input);
  const store = await getPlatformStore();
  const template = await requireTemplate(store, ownerRef, templateId);
  const document = await validateTemplateDocAssets(store, ownerRef, data.document);
  const revision = await store.createDesignTemplateRevision({
    templateId: template.id,
    ownerRef,
    document,
    canvasWidth: document.canvas.width,
    canvasHeight: document.canvas.height,
    aspectRatio: document.formatMetadata?.aspectRatio || null,
    label: data.label,
  });
  let updated = template;
  if (data.activate) {
    updated = await store.updateDesignTemplate(ownerRef, template.id, {
      currentRevisionId: revision.id,
      status: template.status === 'archived' ? 'draft' : template.status,
    });
  }
  return { template: updated, revision };
}

export async function getTemplateRevision(ownerRef, templateId, revisionId) {
  const store = await getPlatformStore();
  await requireTemplate(store, ownerRef, templateId);
  const revision = await store.getDesignTemplateRevision(ownerRef, revisionId);
  if (!revision || revision.templateId !== templateId) {
    throw notFound('TEMPLATE_REVISION_NOT_FOUND', 'Template revision not found');
  }
  return { revision };
}

export async function listTemplateRevisions(ownerRef, templateId) {
  const store = await getPlatformStore();
  await requireTemplate(store, ownerRef, templateId);
  const revisions = await store.listDesignTemplateRevisions(ownerRef, templateId);
  return { revisions };
}

export async function instantiateDesignTemplate(ownerRef, input) {
  const data = instantiateTemplateSchema.parse(input);
  const store = await getPlatformStore();
  const template = await requireTemplate(store, ownerRef, data.templateId);
  const revisionId = data.templateRevisionId || template.currentRevisionId;
  if (!revisionId) {
    throw badRequest('TEMPLATE_NO_REVISION', 'Template has no revision to instantiate');
  }
  const revision = await store.getDesignTemplateRevision(ownerRef, revisionId);
  if (!revision || revision.templateId !== template.id) {
    throw notFound('TEMPLATE_REVISION_NOT_FOUND', 'Template revision not found');
  }

  const project = await resolveProjectId(ownerRef, data.binding?.projectId || data.projectId);
  const bindingInput = {
    ...((typeof data.binding === 'object' && data.binding) || {}),
    projectId: project.id,
  };
  const binding = parseTemplateBindingContext(bindingInput);
  const media = await resolveBindingMedia(store, ownerRef, binding);
  const bindingWithMedia = {
    ...binding,
    resolved: { ...(binding.resolved || {}), ...media },
  };

  const { document, bindings, errors } = bindTemplateSlots(revision.document, bindingWithMedia);
  const templateDoc = parseTemplateDocument(revision.document);
  const hardErrors = errors.filter(
    (e) =>
      e.code === 'TEMPLATE_REQUIRED_SLOT_MISSING' || e.code === 'TEMPLATE_ASSET_UNAVAILABLE'
  );
  if (hardErrors.length) {
    const err = badRequest(hardErrors[0].code, hardErrors[0].message);
    err.details = { errors: hardErrors, bindings };
    throw err;
  }

  // Validate bound assets are owned
  for (const id of collectDocumentAssetIds(document)) {
    try {
      await requireImageAsset(store, ownerRef, id, project.id);
    } catch (e) {
      if (e.code === 'ASSET_NOT_FOUND') {
        const err = badRequest('TEMPLATE_ASSET_UNAVAILABLE', `Bound asset unavailable: ${id}`);
        err.details = { assetId: id };
        throw err;
      }
      throw e;
    }
  }

  const composition = await store.createComposition({
    ownerRef,
    projectId: project.id,
    name: data.name || `${template.name} — instance`,
    sourceAssetId:
      document.background?.kind === 'asset' ? document.background.assetId : null,
    campaignId: binding.campaignId || null,
    campaignRevisionId: binding.campaignRevisionId || null,
    campaignConceptId: binding.campaignConceptId || null,
    campaignDeliverableId: binding.campaignDeliverableId || null,
    brandId: binding.brandId || template.brandId || null,
    brandRevisionId: binding.brandRevisionId || template.brandRevisionId || null,
    templateId: template.id,
    templateRevisionId: revision.id,
    designSystemId:
      document.designSystem?.designSystemId ||
      templateDoc.designSystem?.designSystemId ||
      null,
    designSystemRevisionId:
      document.designSystem?.designSystemRevisionId ||
      templateDoc.designSystem?.designSystemRevisionId ||
      null,
    designSystemModes:
      document.designSystem?.modes || templateDoc.designSystem?.modes || {},
    canvasWidth: document.canvas.width,
    canvasHeight: document.canvas.height,
    aspectRatio: revision.aspectRatio,
    document,
    status: 'draft',
    metadata: {
      templateBindings: bindings,
      instantiationWarnings: errors.filter((e) => e.code === 'TEMPLATE_SLOT_CONSTRAINT'),
    },
  });

  await syncCompositionComponentIndex(store, ownerRef, composition.id, null, document);

  if (binding.campaignDeliverableId) {
    await store.updateCampaignDeliverable(ownerRef, binding.campaignDeliverableId, {
      compositionId: composition.id,
    });
  }

  return { composition, template, revision, bindings, warnings: errors };
}

export async function setTemplateThumbnail(ownerRef, templateId, { assetId } = {}) {
  const store = await getPlatformStore();
  await requireTemplate(store, ownerRef, templateId);
  if (!assetId) throw badRequest('THUMBNAIL_REQUIRED', 'thumbnail assetId required');
  await requireImageAsset(store, ownerRef, assetId);
  const template = await store.updateDesignTemplate(ownerRef, templateId, {
    thumbnailAssetId: assetId,
  });
  return { template };
}

/**
 * Render a preview PNG from the current Template revision and attach as thumbnail.
 */
export async function generateTemplatePreview(ownerRef, templateId, opts = {}) {
  const store = await getPlatformStore();
  const template = await requireTemplate(store, ownerRef, templateId);
  const revisionId = opts.revisionId || template.currentRevisionId;
  if (!revisionId) throw badRequest('TEMPLATE_NO_REVISION', 'No revision to preview');
  const revision = await store.getDesignTemplateRevision(ownerRef, revisionId);
  if (!revision || revision.templateId !== template.id) {
    throw notFound('TEMPLATE_REVISION_NOT_FOUND', 'Template revision not found');
  }

  const templateDoc = parseTemplateDocument(revision.document);
  let compositionDoc = parseCompositionDocument({
    version: 1,
    canvas: templateDoc.canvas,
    background: templateDoc.background,
    layers: templateDoc.layers,
    designSystem: templateDoc.designSystem || null,
  });

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

  const { png, width, height } = await renderCompositionPng({
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
    provider: 'dynaxis-template-preview',
    blobStore,
    metadata: {
      kind: 'template_thumbnail',
      templateId: template.id,
      templateRevisionId: revision.id,
    },
  });

  const updated = await store.updateDesignTemplate(ownerRef, template.id, {
    thumbnailAssetId: asset.id,
  });

  return { template: updated, asset };
}

export async function adaptComposition(ownerRef, input) {
  const data = adaptCompositionSchema.parse(input);
  const store = await getPlatformStore();
  const source = await store.getComposition(ownerRef, data.compositionId);
  if (!source || source.archivedAt) {
    throw notFound('COMPOSITION_NOT_FOUND', 'Composition not found');
  }

  let sourceDoc = source.document;
  let sourceRevisionId = source.currentRevisionId;
  if (data.compositionRevisionId) {
    const rev = await store.getCompositionRevision(ownerRef, data.compositionRevisionId);
    if (!rev || rev.compositionId !== source.id) {
      throw notFound('COMPOSITION_REVISION_NOT_FOUND', 'Composition revision not found');
    }
    sourceDoc = rev.snapshot?.document || sourceDoc;
    sourceRevisionId = rev.id;
  }

  const parsed = parseCompositionDocument(sourceDoc);
  const targetCanvas = resolveTargetCanvas({
    formatId: data.targetFormatId,
    aspectRatio: data.targetAspectRatio,
    width: data.targetWidth,
    height: data.targetHeight,
  });

  const { document, warnings, engineVersion } = adaptCompositionDocument(
    parsed,
    { width: source.canvasWidth, height: source.canvasHeight },
    targetCanvas,
    {
      formatId: data.targetFormatId,
      omitDecorative: Boolean(data.omitDecorative),
    }
  );

  const project = await resolveProjectId(ownerRef, data.projectId || source.projectId);
  const format = data.targetFormatId ? getCampaignFormat(data.targetFormatId) : null;

  const composition = await store.createComposition({
    ownerRef,
    projectId: project.id,
    name:
      data.name ||
      `${source.name} — ${format?.label || data.targetAspectRatio || 'adapted'}`,
    sourceAssetId: source.sourceAssetId,
    campaignId: source.campaignId,
    campaignRevisionId: source.campaignRevisionId,
    campaignConceptId: source.campaignConceptId,
    campaignDeliverableId: null, // adapted sibling is independent of deliverable link
    brandId: source.brandId,
    brandRevisionId: source.brandRevisionId,
    templateId: source.templateId,
    templateRevisionId: source.templateRevisionId,
    sourceCompositionId: source.id,
    sourceCompositionRevisionId: sourceRevisionId,
    adaptationEngineVersion: engineVersion || ADAPTATION_ENGINE_VERSION,
    adaptationTargetFormatId: data.targetFormatId || null,
    designSystemId: source.designSystemId || document.designSystem?.designSystemId || null,
    designSystemRevisionId:
      source.designSystemRevisionId || document.designSystem?.designSystemRevisionId || null,
    designSystemModes: {
      ...(source.designSystemModes || {}),
      ...(document.designSystem?.modes || {}),
    },
    canvasWidth: document.canvas.width,
    canvasHeight: document.canvas.height,
    aspectRatio: format?.aspectRatio || data.targetAspectRatio || null,
    document,
    status: 'draft',
    metadata: {
      adaptationWarnings: warnings,
      adaptedFrom: source.id,
    },
  });

  await syncCompositionComponentIndex(store, ownerRef, composition.id, null, document);

  return { composition, warnings, engineVersion };
}

export async function batchAdaptComposition(ownerRef, input) {
  const data = batchAdaptCompositionSchema.parse(input);
  const results = [];
  for (const target of data.targets) {
    try {
      const result = await adaptComposition(ownerRef, {
        compositionId: data.compositionId,
        compositionRevisionId: data.compositionRevisionId,
        targetFormatId: target.formatId,
        targetAspectRatio: target.aspectRatio,
        name: target.name,
        omitDecorative: data.omitDecorative,
        projectId: data.projectId,
      });
      results.push({ ok: true, ...result, target });
    } catch (err) {
      results.push({
        ok: false,
        target,
        error: { code: err.code || 'ADAPTATION_FAILED', message: err.message },
      });
    }
  }
  return { results };
}

/**
 * Optional Campaign Deliverable path: instantiate Template after imagery/copy exist.
 */
export async function createCompositionFromDeliverableWithTemplate(
  ownerRef,
  { deliverableId, templateId, templateRevisionId, name } = {}
) {
  const store = await getPlatformStore();
  const existing = await store.getCompositionByDeliverable(ownerRef, deliverableId);
  if (existing) return { composition: existing, created: false };

  const deliverable = await store.getCampaignDeliverable(ownerRef, deliverableId);
  if (!deliverable) throw notFound('DELIVERABLE_NOT_FOUND', 'Deliverable not found');
  if (deliverable.status !== 'completed' || !deliverable.assetId) {
    throw badRequest('DELIVERABLE_NOT_READY', 'Deliverable must be completed with an image asset');
  }
  const campaign = await store.getCampaign(ownerRef, deliverable.campaignId);
  if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');

  return instantiateDesignTemplate(ownerRef, {
    templateId,
    templateRevisionId,
    name: name || `Edit — ${deliverable.formatId}`,
    projectId: campaign.projectId,
    binding: {
      projectId: campaign.projectId,
      brandId: campaign.brandId,
      brandRevisionId: campaign.brandRevisionId,
      campaignId: campaign.id,
      campaignRevisionId: deliverable.campaignRevisionId,
      campaignConceptId: deliverable.conceptId,
      campaignDeliverableId: deliverable.id,
      headline: deliverable.headline,
      body: deliverable.body,
      cta: deliverable.cta,
      backgroundAssetId: deliverable.assetId,
    },
  });
}

export {
  canvasDimensionsFromAspect,
};
