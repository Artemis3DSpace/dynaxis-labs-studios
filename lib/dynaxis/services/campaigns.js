/**
 * Dynaxis Campaign service — project-scoped brand-led marketing campaigns.
 * Campaigns pin Brand / Product / Character revisions, generate concepts + deliverables,
 * and return Mini App generationRequest objects (no direct MuAPI image calls).
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, isMemoryDriverAllowed } from '../db/client.js';
import { dynaxisCampaigns, dynaxisProjects } from '../db/schema.js';
import { getPlatformStore } from '../db/store.js';
import { resolveProjectOrganization } from '../identity/workspace-ownership.js';
import { listLegacyOwnerRefClaimsForOrganization } from '../identity/legacy-owner-claims.js';
import {
  normalizeServiceContext,
  resolveRouteServiceContext,
} from './characters.js';
import { resolveProjectId } from './projects.js';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_CONCEPT_STATUSES,
  CAMPAIGN_DELIVERABLE_STATUSES,
  CAMPAIGN_CHARACTER_ROLES,
  CHARACTER_VISUAL_MODELS,
  PRODUCT_VISUAL_MODELS,
  PROVIDER_MUAPI,
  DEFAULT_CHARACTER_LLM_MODEL,
} from '../types.js';
import { isCampaignGoalId } from '../campaigns/goals.js';
import {
  getCampaignFormat,
  isCampaignFormatId,
  CAMPAIGN_FORMAT_IDS,
} from '../campaigns/formats.js';
import {
  buildConceptUserPrompt,
  CAMPAIGN_CONCEPT_SYSTEM_PROMPT,
  parseConceptsJson,
  validateConceptDrafts,
  CONCEPT_COUNT,
} from '../campaigns/concepts.js';
import {
  buildCopyUserPrompt,
  CAMPAIGN_COPY_SYSTEM_PROMPT,
  parseCopyJson,
  enforceFormatCopy,
  buildCampaignImagePrompt,
} from '../campaigns/copy.js';
import {
  buildOrderedCampaignReferences,
  assertCampaignReferenceBudget,
  CAMPAIGN_MAX_REFERENCE_IMAGES,
} from '../campaigns/references.js';
import {
  buildBrandMessagingContext,
  buildBrandVisualContext,
} from '../brands/consumer.js';
import { buildProductVisualDescription } from '../products/consumer.js';
import { buildVisualDescription } from '../characters/consumer.js';
import { executeLlmChat } from '../providers/llm.js';

/** @type {Map<string, { ownerRef: string, projectId: string, organizationId: string | null }>} */
const memoryCampaignOwnershipRegistry = new Map();

export function clearCampaignOwnershipRegistry() {
  memoryCampaignOwnershipRegistry.clear();
}

function rememberCampaignOwnership(campaign, organizationId = null) {
  if (!campaign?.id || !isMemoryDriverAllowed()) return;
  memoryCampaignOwnershipRegistry.set(campaign.id, {
    ownerRef: campaign.ownerRef,
    projectId: campaign.projectId,
    organizationId,
  });
}

function persistencePartitionError() {
  return Object.assign(
    new Error('Persistence partition unavailable for canonical AuthContext subject'),
    { status: 503, code: 'PERSISTENCE_PARTITION_UNAVAILABLE' }
  );
}

async function ownerRefFromContext(ctx) {
  const context = normalizeServiceContext(ctx);
  if (context.ownerRef) return context.ownerRef;
  if (context.organizationId) {
    const claims = await listLegacyOwnerRefClaimsForOrganization(context.organizationId);
    if (claims.length === 1) return claims[0].legacyOwnerRef;
  }
  throw persistencePartitionError();
}

export async function findCampaignOwnership(campaignId) {
  const store = await getPlatformStore();
  if (typeof store.findCampaignOwnership === 'function') {
    return store.findCampaignOwnership(campaignId);
  }
  if (isMemoryDriverAllowed()) {
    const entry = memoryCampaignOwnershipRegistry.get(campaignId);
    if (!entry) return null;
    return {
      type: 'campaign',
      id: campaignId,
      projectId: entry.projectId,
      organizationId: entry.organizationId,
    };
  }
  const db = getDb();
  const [row] = await db
    .select({
      id: dynaxisCampaigns.id,
      projectId: dynaxisCampaigns.projectId,
      organizationId: dynaxisProjects.organizationId,
    })
    .from(dynaxisCampaigns)
    .innerJoin(dynaxisProjects, eq(dynaxisCampaigns.projectId, dynaxisProjects.id))
    .where(eq(dynaxisCampaigns.id, campaignId))
    .limit(1);
  if (!row) return null;
  const organizationId = await resolveProjectOrganization(row.projectId);
  return {
    type: 'campaign',
    id: row.id,
    projectId: row.projectId,
    organizationId,
  };
}

export const campaignOwnershipRepository = Object.freeze({
  async findResource(input) {
    const type = String(input?.type || '').trim();
    if (type !== 'campaign') return null;
    const id = String(input?.id || '').trim();
    if (!id) return null;
    return findCampaignOwnership(id);
  },
});

export { normalizeServiceContext, resolveRouteServiceContext };

const campaignStatusEnum = z.enum(CAMPAIGN_STATUSES);
const conceptStatusEnum = z.enum(CAMPAIGN_CONCEPT_STATUSES);
const characterRoleEnum = z.enum(CAMPAIGN_CHARACTER_ROLES);

const productLinkInputSchema = z.object({
  productId: z.string().uuid(),
  productRevisionId: z.string().uuid().optional().nullable(),
});

const characterLinkInputSchema = z.object({
  characterId: z.string().uuid(),
  characterRevisionId: z.string().uuid().optional().nullable(),
  role: characterRoleEnum.optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  projectId: z.string().uuid(),
  brandId: z.string().uuid(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  goal: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isCampaignGoalId(v), 'Invalid campaign goal'),
  direction: z.string().trim().max(8000).optional().nullable(),
  includeBrandLogo: z.boolean().optional(),
  productIds: z.array(productLinkInputSchema).max(40).optional().default([]),
  characterIds: z.array(characterLinkInputSchema).max(40).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    goal: z
      .string()
      .trim()
      .min(1)
      .refine((v) => isCampaignGoalId(v), 'Invalid campaign goal')
      .optional(),
    direction: z.string().trim().max(8000).optional().nullable(),
    status: campaignStatusEnum.optional(),
    includeBrandLogo: z.boolean().optional(),
    brandRevisionId: z.string().uuid().optional().nullable(),
    selectedConceptId: z.string().uuid().optional().nullable(),
  })
  .strict();

export const updateConceptSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    theme: z.string().trim().min(1).max(500).optional(),
    keyMessage: z.string().trim().min(1).max(500).optional(),
    hook: z.string().trim().min(1).max(300).optional(),
    cta: z.string().trim().min(1).max(80).optional(),
    recommendedFormatIds: z
      .array(z.string().max(80))
      .max(12)
      .optional(),
    toneNotes: z.string().trim().max(1000).optional().nullable(),
    visualDirection: z.string().trim().max(1000).optional().nullable(),
    status: conceptStatusEnum.optional(),
  })
  .strict();

export const createDeliverablesSchema = z.object({
  conceptId: z.string().uuid(),
  formatIds: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((id) => isCampaignFormatId(id), 'Unknown campaign format')
    )
    .min(1)
    .max(CAMPAIGN_FORMAT_IDS.length),
  includeBrandLogo: z.boolean().optional(),
});

export const linkCampaignProductSchema = productLinkInputSchema.extend({
  sortOrder: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const linkCampaignCharacterSchema = characterLinkInputSchema.extend({
  sortOrder: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const linkCampaignAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: z.string().trim().max(80).optional().default('campaign_reference'),
  conceptId: z.string().uuid().optional().nullable(),
  deliverableId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});

function notFound(code, message) {
  const err = new Error(message);
  err.status = 404;
  err.code = code;
  return err;
}

function badRequest(code, message) {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

async function requireCampaign(store, ownerRef, campaignId) {
  const campaign = await store.getCampaign(ownerRef, campaignId);
  if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');
  return campaign;
}

async function requireBrand(store, ownerRef, brandId) {
  const brand = await store.getBrand(ownerRef, brandId);
  if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  return brand;
}

async function requireOwnedProduct(store, ownerRef, productId) {
  const product = await store.getProduct(ownerRef, productId);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return product;
}

async function requireOwnedCharacter(store, ownerRef, characterId) {
  const character = await store.getCharacter(ownerRef, characterId);
  if (!character) throw notFound('CHARACTER_NOT_FOUND', 'Character not found');
  return character;
}

async function requireOwnedAsset(store, ownerRef, assetId) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  return asset;
}

async function requireConcept(store, ownerRef, conceptId) {
  const concept = await store.getCampaignConcept(ownerRef, conceptId);
  if (!concept) throw notFound('CAMPAIGN_CONCEPT_NOT_FOUND', 'Campaign concept not found');
  return concept;
}

async function requireDeliverable(store, ownerRef, deliverableId) {
  const deliverable = await store.getCampaignDeliverable(ownerRef, deliverableId);
  if (!deliverable) {
    throw notFound('CAMPAIGN_DELIVERABLE_NOT_FOUND', 'Campaign deliverable not found');
  }
  return deliverable;
}

/**
 * Resolve a brand revision by id. Prefer getBrandRevision; fall back to list.
 */
async function resolveBrandRevision(store, ownerRef, brandId, revisionId) {
  if (!revisionId) return null;
  if (typeof store.getBrandRevision === 'function') {
    const revision = await store.getBrandRevision(ownerRef, revisionId);
    if (revision) return revision;
  }
  if (typeof store.listBrandRevisions === 'function') {
    const revisions = await store.listBrandRevisions(ownerRef, brandId);
    return revisions.find((r) => r.id === revisionId) || null;
  }
  return null;
}

/**
 * Brand DNA lives under revision.snapshot.dna when present.
 * Otherwise messaging/visual fall back to brand fields via consumer helpers.
 */
function brandContextsFromRevision(brand, revision, assets = []) {
  const dna = revision?.snapshot?.dna;
  const messagingRevision = dna
    ? { id: revision.id, snapshot: dna }
    : revision;
  return {
    messaging: buildBrandMessagingContext(brand, messagingRevision),
    visual: buildBrandVisualContext(brand, messagingRevision, assets),
  };
}

async function runCampaignLlmText(opts, { prompt, systemPrompt, model }) {
  if (typeof opts.textFn === 'function') {
    const out = await opts.textFn({ prompt, systemPrompt, model });
    if (typeof out === 'string') return out;
    return String(out?.reply ?? out?.text ?? out?.response ?? '');
  }
  if (!opts.apiKey) {
    throw badRequest('MUAPI_KEY_MISSING', 'MuAPI key required for campaign LLM');
  }
  const result = await executeLlmChat(opts.apiKey, {
    prompt,
    systemPrompt,
    model: model || DEFAULT_CHARACTER_LLM_MODEL,
    temperature: opts.temperature ?? 0.7,
  });
  return result.reply;
}

function briefSnapshotFromCampaign(campaign) {
  return {
    name: campaign.name,
    goal: campaign.goal,
    direction: campaign.direction ?? null,
    status: campaign.status,
    includeBrandLogo: Boolean(campaign.includeBrandLogo),
    brandId: campaign.brandId,
    brandRevisionId: campaign.brandRevisionId,
    selectedConceptId: campaign.selectedConceptId ?? null,
    projectId: campaign.projectId,
  };
}

/**
 * Snapshot campaign brief + product/character link pins into a new revision.
 */
export async function createRevisionForCampaign(ctx, campaignId, { reason } = {}) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const campaign = await requireCampaign(store, ownerRef, campaignId);
  const products = await store.listCampaignProducts(campaignId);
  const characters = await store.listCampaignCharacters(campaignId);
  const revision = await store.createCampaignRevision({
    campaignId,
    ownerRef,
    snapshot: {
      reason: reason || 'update',
      brief: briefSnapshotFromCampaign(campaign),
      products: products.map((l) => ({
        productId: l.productId,
        productRevisionId: l.productRevisionId,
        sortOrder: l.sortOrder ?? 0,
        metadata: l.metadata || {},
      })),
      characters: characters.map((l) => ({
        characterId: l.characterId,
        characterRevisionId: l.characterRevisionId,
        role: l.role || 'presenter',
        sortOrder: l.sortOrder ?? 0,
        metadata: l.metadata || {},
      })),
    },
  });
  await store.updateCampaign(ownerRef, campaignId, {
    currentRevisionId: revision.id,
  });
  return revision;
}

export async function createCampaign(ctx, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = createCampaignSchema.parse(input);
  const store = await getPlatformStore();
  const project = await resolveProjectId(ownerRef, data.projectId);
  const brand = await requireBrand(store, ownerRef, data.brandId);

  const brandRevisionId = data.brandRevisionId || brand.currentRevisionId;
  if (!brandRevisionId) {
    throw badRequest(
      'BRAND_REVISION_REQUIRED',
      'Brand must have a current revision or brandRevisionId'
    );
  }
  const brandRevision = await resolveBrandRevision(
    store,
    ownerRef,
    brand.id,
    brandRevisionId
  );
  if (!brandRevision) {
    throw notFound('BRAND_REVISION_NOT_FOUND', 'Brand revision not found');
  }

  const campaign = await store.createCampaign({
    ownerRef,
    projectId: project.id,
    brandId: brand.id,
    brandRevisionId,
    name: data.name,
    goal: data.goal,
    direction: data.direction ?? null,
    status: 'draft',
    includeBrandLogo: Boolean(data.includeBrandLogo),
    metadata: data.metadata || {},
  });

  rememberCampaignOwnership(
    campaign,
    project.organizationId ?? normalizeServiceContext(ctx).organizationId
  );

  let sort = 0;
  for (const entry of data.productIds || []) {
    const product = await requireOwnedProduct(store, ownerRef, entry.productId);
    const productRevisionId = entry.productRevisionId || product.currentRevisionId;
    if (!productRevisionId) {
      throw badRequest(
        'PRODUCT_REVISION_REQUIRED',
        `Product ${product.id} has no revision to pin`
      );
    }
    await store.linkCampaignProduct({
      campaignId: campaign.id,
      productId: product.id,
      productRevisionId,
      sortOrder: sort++,
    });
  }

  sort = 0;
  for (const entry of data.characterIds || []) {
    const character = await requireOwnedCharacter(store, ownerRef, entry.characterId);
    const characterRevisionId =
      entry.characterRevisionId || character.currentRevisionId;
    if (!characterRevisionId) {
      throw badRequest(
        'CHARACTER_REVISION_REQUIRED',
        `Character ${character.id} has no revision to pin`
      );
    }
    await store.linkCampaignCharacter({
      campaignId: campaign.id,
      characterId: character.id,
      characterRevisionId,
      role: entry.role || 'presenter',
      sortOrder: sort++,
    });
  }

  const revision = await createRevisionForCampaign(ctx, campaign.id, {
    reason: 'create',
  });
  const result = await getCampaign(ctx, campaign.id, { includeRelations: true });
  return { campaign: result.campaign, revision, ...result };
}

export async function updateCampaign(ctx, campaignId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = updateCampaignSchema.parse(input);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);

  if (data.brandRevisionId) {
    const campaign = await store.getCampaign(ownerRef, campaignId);
    const brandRevision = await resolveBrandRevision(
      store,
      ownerRef,
      campaign.brandId,
      data.brandRevisionId
    );
    if (!brandRevision) {
      throw notFound('BRAND_REVISION_NOT_FOUND', 'Brand revision not found');
    }
  }

  const patch = { ...data };
  const updated = await store.updateCampaign(ownerRef, campaignId, patch);
  if (!updated) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');

  if (data.status === 'archived') {
    await store.updateCampaign(ownerRef, campaignId, { archivedAt: new Date() });
  }

  await createRevisionForCampaign(ctx, campaignId, { reason: 'update' });
  return getCampaign(ctx, campaignId, { includeRelations: true });
}

export async function archiveCampaign(ctx, campaignId) {
  return updateCampaign(ctx, campaignId, { status: 'archived' });
}

export async function getCampaign(
  ctx,
  campaignId,
  { includeRelations = false } = {}
) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const campaign = await requireCampaign(store, ownerRef, campaignId);
  const result = { campaign };

  if (includeRelations) {
    result.products = await store.listCampaignProducts(campaignId);
    result.characters = await store.listCampaignCharacters(campaignId);
    const concepts = await store.listCampaignConcepts(ownerRef, campaignId);
    result.conceptsCount = concepts.length;
    if (campaign.currentRevisionId) {
      result.revision = await store.getCampaignRevision(
        ownerRef,
        campaign.currentRevisionId
      );
    }
  }

  return result;
}

export async function listCampaigns(ctx, opts = {}) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const campaigns = await store.listCampaigns(ownerRef, opts);
  return { campaigns };
}

export async function linkCampaignProduct(ctx, campaignId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = linkCampaignProductSchema.parse(input);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const product = await requireOwnedProduct(store, ownerRef, data.productId);
  const productRevisionId = data.productRevisionId || product.currentRevisionId;
  if (!productRevisionId) {
    throw badRequest(
      'PRODUCT_REVISION_REQUIRED',
      'Product has no revision to pin'
    );
  }
  const link = await store.linkCampaignProduct({
    campaignId,
    productId: product.id,
    productRevisionId,
    sortOrder: data.sortOrder ?? 0,
    metadata: data.metadata || {},
  });
  await createRevisionForCampaign(ctx, campaignId, { reason: 'product_link' });
  return { link };
}

export async function unlinkCampaignProduct(ctx, campaignId, productId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  await requireOwnedProduct(store, ownerRef, productId);
  const removed = await store.unlinkCampaignProduct(campaignId, productId);
  if (!removed) {
    throw notFound('CAMPAIGN_PRODUCT_NOT_FOUND', 'Campaign product link not found');
  }
  await createRevisionForCampaign(ctx, campaignId, { reason: 'product_unlink' });
  return { ok: true };
}

export async function listCampaignProducts(ctx, campaignId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const products = await store.listCampaignProducts(campaignId);
  return { products };
}

export async function linkCampaignCharacter(ctx, campaignId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = linkCampaignCharacterSchema.parse(input);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const character = await requireOwnedCharacter(store, ownerRef, data.characterId);
  const characterRevisionId =
    data.characterRevisionId || character.currentRevisionId;
  if (!characterRevisionId) {
    throw badRequest(
      'CHARACTER_REVISION_REQUIRED',
      'Character has no revision to pin'
    );
  }
  const link = await store.linkCampaignCharacter({
    campaignId,
    characterId: character.id,
    characterRevisionId,
    role: data.role || 'presenter',
    sortOrder: data.sortOrder ?? 0,
    metadata: data.metadata || {},
  });
  await createRevisionForCampaign(ctx, campaignId, {
    reason: 'character_link',
  });
  return { link };
}

export async function unlinkCampaignCharacter(ctx, campaignId, characterId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  await requireOwnedCharacter(store, ownerRef, characterId);
  const removed = await store.unlinkCampaignCharacter(campaignId, characterId);
  if (!removed) {
    throw notFound(
      'CAMPAIGN_CHARACTER_NOT_FOUND',
      'Campaign character link not found'
    );
  }
  await createRevisionForCampaign(ctx, campaignId, {
    reason: 'character_unlink',
  });
  return { ok: true };
}

export async function listCampaignCharacters(ctx, campaignId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const characters = await store.listCampaignCharacters(campaignId);
  return { characters };
}

export async function listCampaignRevisions(ctx, campaignId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const revisions = await store.listCampaignRevisions(ownerRef, campaignId);
  return { revisions };
}

export async function getCampaignRevision(ctx, revisionId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const revision = await store.getCampaignRevision(ownerRef, revisionId);
  if (!revision) {
    throw notFound('CAMPAIGN_REVISION_NOT_FOUND', 'Campaign revision not found');
  }
  return { revision };
}

/**
 * Load products linked to a campaign with pinned revision snapshots when possible.
 */
async function loadCampaignProductBriefs(store, ownerRef, campaignId) {
  const links = await store.listCampaignProducts(campaignId);
  const products = [];
  for (const link of links) {
    const product = await store.getProduct(ownerRef, link.productId);
    if (!product) continue;
    let revision = null;
    if (link.productRevisionId) {
      revision = await store.getProductRevision(ownerRef, link.productRevisionId);
    }
    const src = revision?.snapshot || revision || product;
    products.push({
      productId: product.id,
      productRevisionId: link.productRevisionId || product.currentRevisionId,
      name: src.name || product.name,
      description: src.description || product.description,
      visualDescription: buildProductVisualDescription(product, revision),
      claims: src.claims || product.claims || [],
    });
  }
  return products;
}

/**
 * Load characters linked to a campaign with pinned revision snapshots when possible.
 */
async function loadCampaignCharacterBriefs(store, ownerRef, campaignId) {
  const links = await store.listCampaignCharacters(campaignId);
  const characters = [];
  for (const link of links) {
    const character = await store.getCharacter(ownerRef, link.characterId);
    if (!character) continue;
    let revision = null;
    if (link.characterRevisionId) {
      revision = await store.getCharacterRevision(
        ownerRef,
        link.characterRevisionId
      );
    }
    const visualSrc = revision || character;
    characters.push({
      characterId: character.id,
      characterRevisionId:
        link.characterRevisionId || character.currentRevisionId,
      role: link.role || 'presenter',
      name: visualSrc.name || character.name,
      description: visualSrc.description || character.description,
      visualDescription: buildVisualDescription(character, revision),
    });
  }
  return characters;
}

export async function generateCampaignConcepts(
  ctx,
  campaignId,
  { apiKey, textFn, model } = {}
) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const campaign = await requireCampaign(store, ownerRef, campaignId);
  const brand = await requireBrand(store, ownerRef, campaign.brandId);
  const brandRevision = await resolveBrandRevision(
    store,
    ownerRef,
    brand.id,
    campaign.brandRevisionId
  );
  const brandAssets = await store.listBrandAssets(brand.id);
  const { messaging: brandMessaging, visual: brandVisual } =
    brandContextsFromRevision(brand, brandRevision, brandAssets);

  const products = await loadCampaignProductBriefs(store, ownerRef, campaignId);
  const characters = await loadCampaignCharacterBriefs(
    store,
    ownerRef,
    campaignId
  );

  const brief = {
    goal: campaign.goal,
    direction: campaign.direction,
    brandMessaging,
    brandVisual,
    products,
    characters,
  };

  const llmModel = model || DEFAULT_CHARACTER_LLM_MODEL;
  const userPrompt = buildConceptUserPrompt(brief);
  const rawText = await runCampaignLlmText(
    { apiKey, textFn, temperature: 0.75 },
    {
      prompt: userPrompt,
      systemPrompt: CAMPAIGN_CONCEPT_SYSTEM_PROMPT,
      model: llmModel,
    }
  );

  const parsed = parseConceptsJson(rawText);
  const drafts = validateConceptDrafts(parsed);

  let campaignRevisionId = campaign.currentRevisionId;
  if (!campaignRevisionId) {
    const revision = await createRevisionForCampaign(ctx, campaignId, {
      reason: 'concept_generate',
    });
    campaignRevisionId = revision.id;
  }

  const concepts = [];
  for (let i = 0; i < CONCEPT_COUNT; i++) {
    const draft = drafts[i];
    const concept = await store.createCampaignConcept({
      campaignId,
      campaignRevisionId,
      ownerRef,
      title: draft.title,
      theme: draft.theme,
      keyMessage: draft.keyMessage,
      hook: draft.hook,
      cta: draft.cta,
      recommendedFormatIds: draft.recommendedFormatIds || [],
      toneNotes: draft.toneNotes ?? null,
      visualDirection: draft.visualDirection ?? null,
      status: 'draft',
      sortOrder: i,
      provider: PROVIDER_MUAPI,
      model: llmModel,
      metadata: {},
    });
    concepts.push(concept);
  }

  await store.updateCampaign(ownerRef, campaignId, { status: 'concepting' });

  return { concepts };
}

export async function listCampaignConcepts(ctx, campaignId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const concepts = await store.listCampaignConcepts(ownerRef, campaignId);
  return { concepts };
}

export async function getCampaignConcept(ctx, conceptId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const concept = await requireConcept(store, ownerRef, conceptId);
  return { concept };
}

export async function updateCampaignConcept(ctx, conceptId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = updateConceptSchema.parse(input);
  const store = await getPlatformStore();
  await requireConcept(store, ownerRef, conceptId);

  if (data.recommendedFormatIds) {
    for (const formatId of data.recommendedFormatIds) {
      if (!isCampaignFormatId(formatId)) {
        throw badRequest(
          'CAMPAIGN_FORMAT_UNKNOWN',
          `Unknown campaign format: ${formatId}`
        );
      }
    }
  }

  const updated = await store.updateCampaignConcept(ownerRef, conceptId, data);
  if (!updated) {
    throw notFound('CAMPAIGN_CONCEPT_NOT_FOUND', 'Campaign concept not found');
  }
  return { concept: updated };
}

export async function selectCampaignConcept(ctx, campaignId, conceptId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const concept = await requireConcept(store, ownerRef, conceptId);
  if (concept.campaignId !== campaignId) {
    throw badRequest(
      'CAMPAIGN_CONCEPT_MISMATCH',
      'Concept does not belong to this campaign'
    );
  }

  const concepts = await store.listCampaignConcepts(ownerRef, campaignId);
  for (const row of concepts) {
    if (row.status === 'archived') continue;
    const nextStatus = row.id === conceptId ? 'selected' : 'draft';
    if (row.status !== nextStatus) {
      await store.updateCampaignConcept(ownerRef, row.id, { status: nextStatus });
    }
  }

  await store.updateCampaign(ownerRef, campaignId, {
    selectedConceptId: conceptId,
    status: 'active',
  });
  await createRevisionForCampaign(ctx, campaignId, {
    reason: 'concept_select',
  });

  return getCampaign(ctx, campaignId, { includeRelations: true });
}

export async function createCampaignDeliverables(ctx, campaignId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = createDeliverablesSchema.parse(input);
  const store = await getPlatformStore();
  const campaign = await requireCampaign(store, ownerRef, campaignId);
  const concept = await requireConcept(store, ownerRef, data.conceptId);
  if (concept.campaignId !== campaignId) {
    throw badRequest(
      'CAMPAIGN_CONCEPT_MISMATCH',
      'Concept does not belong to this campaign'
    );
  }

  for (const formatId of data.formatIds) {
    if (!isCampaignFormatId(formatId)) {
      throw badRequest(
        'CAMPAIGN_FORMAT_UNKNOWN',
        `Unknown campaign format: ${formatId}`
      );
    }
  }

  let campaignRevisionId = campaign.currentRevisionId;
  if (!campaignRevisionId) {
    const revision = await createRevisionForCampaign(ctx, campaignId, {
      reason: 'deliverable_plan',
    });
    campaignRevisionId = revision.id;
  }

  const includeBrandLogo =
    data.includeBrandLogo !== undefined
      ? Boolean(data.includeBrandLogo)
      : Boolean(campaign.includeBrandLogo);

  const deliverables = [];
  for (const formatId of data.formatIds) {
    const format = getCampaignFormat(formatId);
    const deliverable = await store.createCampaignDeliverable({
      campaignId,
      campaignRevisionId,
      conceptId: concept.id,
      ownerRef,
      formatId,
      outputModality: format?.outputModality || 'image',
      status: 'planned',
      includeBrandLogo,
      metadata: {},
    });
    deliverables.push(deliverable);
  }

  return {
    deliverables,
    generationCount: deliverables.length,
  };
}

/** Alias — plan deliverables for a concept in batch. */
export const batchCreateAndPlanDeliverables = createCampaignDeliverables;

export async function generateCampaignDeliverableCopy(
  ctx,
  deliverableId,
  { apiKey, textFn, model } = {}
) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const deliverable = await requireDeliverable(store, ownerRef, deliverableId);
  const campaign = await requireCampaign(store, ownerRef, deliverable.campaignId);
  const concept = await requireConcept(store, ownerRef, deliverable.conceptId);
  const brand = await requireBrand(store, ownerRef, campaign.brandId);
  const brandRevision = await resolveBrandRevision(
    store,
    ownerRef,
    brand.id,
    campaign.brandRevisionId
  );
  const { messaging: brandMessaging } = brandContextsFromRevision(
    brand,
    brandRevision,
    []
  );

  if (!isCampaignFormatId(deliverable.formatId)) {
    throw badRequest(
      'CAMPAIGN_FORMAT_UNKNOWN',
      `Unknown campaign format: ${deliverable.formatId}`
    );
  }

  const llmModel = model || DEFAULT_CHARACTER_LLM_MODEL;
  const userPrompt = buildCopyUserPrompt({
    formatId: deliverable.formatId,
    concept,
    brandMessaging,
  });
  const rawText = await runCampaignLlmText(
    { apiKey, textFn, temperature: 0.6 },
    {
      prompt: userPrompt,
      systemPrompt: CAMPAIGN_COPY_SYSTEM_PROMPT,
      model: llmModel,
    }
  );

  const parsed = parseCopyJson(rawText);
  const copy = enforceFormatCopy(deliverable.formatId, parsed);

  const updated = await store.updateCampaignDeliverable(ownerRef, deliverableId, {
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
    status: 'copy_ready',
    provider: PROVIDER_MUAPI,
    model: llmModel,
    errorCode: null,
    errorMessage: null,
  });

  return { deliverable: updated, copy };
}

/**
 * Build a Mini App generationRequest for deliverable image generation.
 * Does NOT call MuAPI — the runtime executes via createGeneration.
 */
export async function generateCampaignDeliverableImage(ctx, deliverableId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const deliverable = await requireDeliverable(store, ownerRef, deliverableId);
  const campaign = await requireCampaign(store, ownerRef, deliverable.campaignId);
  const concept = await requireConcept(store, ownerRef, deliverable.conceptId);
  const format = getCampaignFormat(deliverable.formatId);
  if (!format) {
    throw badRequest(
      'CAMPAIGN_FORMAT_UNKNOWN',
      `Unknown campaign format: ${deliverable.formatId}`
    );
  }

  const brand = await requireBrand(store, ownerRef, campaign.brandId);
  const brandRevision = await resolveBrandRevision(
    store,
    ownerRef,
    brand.id,
    campaign.brandRevisionId
  );
  const brandAssets = await store.listBrandAssets(brand.id);
  const { visual: brandVisual } = brandContextsFromRevision(
    brand,
    brandRevision,
    brandAssets
  );

  const productLinks = await store.listCampaignProducts(campaign.id);
  const characterLinks = await store.listCampaignCharacters(campaign.id);
  const campaignAssetLinks = await store.listCampaignAssets(campaign.id);

  const productRefs = [];
  let primaryProduct = null;
  let primaryProductRevisionId = null;
  let productVisual = null;
  for (const link of productLinks) {
    const product = await store.getProduct(ownerRef, link.productId);
    if (!product) continue;
    let revision = null;
    if (link.productRevisionId) {
      revision = await store.getProductRevision(ownerRef, link.productRevisionId);
    }
    if (!primaryProduct) {
      primaryProduct = product;
      primaryProductRevisionId =
        link.productRevisionId || product.currentRevisionId || null;
      productVisual = buildProductVisualDescription(product, revision);
    }
    const assets = await store.listProductAssets(product.id);
    for (const a of assets) {
      productRefs.push({
        assetId: a.assetId,
        url: a.asset?.url || a.url || null,
        role: a.role || 'product_reference',
      });
    }
  }

  const characterRefs = [];
  let characterVisual = null;
  let primaryCharacter = null;
  let primaryCharacterRevisionId = null;
  for (const link of characterLinks) {
    const character = await store.getCharacter(ownerRef, link.characterId);
    if (!character) continue;
    let revision = null;
    if (link.characterRevisionId) {
      revision = await store.getCharacterRevision(
        ownerRef,
        link.characterRevisionId
      );
    }
    if (!primaryCharacter) {
      primaryCharacter = character;
      primaryCharacterRevisionId =
        link.characterRevisionId || character.currentRevisionId || null;
      characterVisual = buildVisualDescription(character, revision);
    }
    const assets = await store.listCharacterAssets(character.id);
    for (const a of assets) {
      characterRefs.push({
        assetId: a.assetId,
        url: a.asset?.url || a.url || null,
        role: a.role || 'character_reference',
      });
    }
  }

  const campaignRefs = (campaignAssetLinks || []).map((l) => ({
    assetId: l.assetId,
    url: l.asset?.url || l.url || null,
    role: l.role || 'campaign_reference',
  }));

  const includeBrandLogo = Boolean(
    deliverable.includeBrandLogo ?? campaign.includeBrandLogo
  );

  const ordered = buildOrderedCampaignReferences({
    productRefs,
    characterRefs,
    brandLogo: brandVisual.logo,
    brandRefs: brandVisual.references || [],
    campaignRefs,
    includeBrandLogo,
    maxImages: CAMPAIGN_MAX_REFERENCE_IMAGES,
  });
  assertCampaignReferenceBudget(ordered.count, CAMPAIGN_MAX_REFERENCE_IMAGES);

  const prompt = buildCampaignImagePrompt({
    formatId: deliverable.formatId,
    concept,
    brandVisual,
    copy: {
      headline: deliverable.headline,
      body: deliverable.body,
      cta: deliverable.cta,
    },
    productVisual,
    characterVisual,
    includeBrandLogo,
  });

  const hasRefs = ordered.urls.length > 0;
  const modelId = hasRefs
    ? PRODUCT_VISUAL_MODELS.edit
    : CHARACTER_VISUAL_MODELS.generate;

  const campaignRevisionId =
    deliverable.campaignRevisionId || campaign.currentRevisionId || null;

  const generationRequest = {
    modelId,
    endpoint: modelId,
    prompt,
    outputType: 'image',
    projectId: campaign.projectId,
    productId: primaryProduct?.id || null,
    productRevisionId: primaryProductRevisionId,
    characterId: primaryCharacter?.id || null,
    characterRevisionId: primaryCharacterRevisionId,
    brandId: campaign.brandId,
    brandRevisionId: campaign.brandRevisionId,
    campaignId: campaign.id,
    campaignRevisionId,
    parameters: {
      prompt,
      ...(hasRefs ? { images_list: ordered.urls } : {}),
      aspect_ratio: format.aspectRatio,
      campaignId: campaign.id,
      campaignRevisionId,
      conceptId: concept.id,
      deliverableId: deliverable.id,
      formatId: deliverable.formatId,
      brandId: campaign.brandId,
      brandRevisionId: campaign.brandRevisionId,
      ...(primaryProduct?.id ? { productId: primaryProduct.id } : {}),
      ...(primaryProductRevisionId
        ? { productRevisionId: primaryProductRevisionId }
        : {}),
      ...(includeBrandLogo && brandVisual.logoAssetId
        ? { brandLogoAssetId: brandVisual.logoAssetId }
        : {}),
    },
    referenceAssets: ordered.references.map((r) => ({
      assetId: r.assetId || undefined,
      url: r.url,
      role: r.role || 'campaign_reference',
    })),
  };

  const updated = await store.updateCampaignDeliverable(ownerRef, deliverableId, {
    status: 'generating',
    provider: PROVIDER_MUAPI,
    model: modelId,
    errorCode: null,
    errorMessage: null,
  });

  return { deliverable: updated, generationRequest };
}

export async function completeCampaignDeliverable(
  ctx,
  deliverableId,
  { generationId, assetId, appendHistory = true } = {}
) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const deliverable = await requireDeliverable(store, ownerRef, deliverableId);

  const history = Array.isArray(deliverable.outputHistory)
    ? [...deliverable.outputHistory]
    : [];
  if (appendHistory && deliverable.assetId) {
    history.push({
      assetId: deliverable.assetId,
      generationId: deliverable.generationId || null,
      completedAt: deliverable.completedAt || null,
    });
  }

  const updated = await store.updateCampaignDeliverable(ownerRef, deliverableId, {
    status: 'completed',
    generationId: generationId ?? deliverable.generationId ?? null,
    assetId: assetId ?? deliverable.assetId ?? null,
    outputHistory: history,
    completedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });

  return { deliverable: updated };
}

export async function failCampaignDeliverable(
  ctx,
  deliverableId,
  { errorCode, errorMessage } = {}
) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireDeliverable(store, ownerRef, deliverableId);
  const updated = await store.updateCampaignDeliverable(ownerRef, deliverableId, {
    status: 'failed',
    errorCode: errorCode || 'CAMPAIGN_DELIVERABLE_FAILED',
    errorMessage: errorMessage || 'Campaign deliverable generation failed',
  });
  return { deliverable: updated };
}

export async function attachCampaignAsset(ctx, campaignId, input) {
  const ownerRef = await ownerRefFromContext(ctx);
  const data = linkCampaignAssetSchema.parse(input);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  await requireOwnedAsset(store, ownerRef, data.assetId);
  const link = await store.linkCampaignAsset({
    campaignId,
    assetId: data.assetId,
    role: data.role || 'campaign_reference',
    conceptId: data.conceptId ?? null,
    deliverableId: data.deliverableId ?? null,
    sortOrder: data.sortOrder ?? 0,
  });
  return { link };
}

export async function listCampaignAssets(ctx, campaignId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const assets = await store.listCampaignAssets(campaignId);
  return { assets };
}

export async function removeCampaignAsset(ctx, campaignId, assetId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  await requireOwnedAsset(store, ownerRef, assetId);
  const removed = await store.unlinkCampaignAsset(campaignId, assetId);
  if (!removed) {
    throw notFound('CAMPAIGN_ASSET_NOT_FOUND', 'Campaign asset link not found');
  }
  return { ok: true };
}

export async function listCampaignDeliverables(ctx, campaignId, opts = {}) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  await requireCampaign(store, ownerRef, campaignId);
  const deliverables = await store.listCampaignDeliverables(
    ownerRef,
    campaignId,
    opts
  );
  return { deliverables };
}

export async function getCampaignDeliverable(ctx, deliverableId) {
  const ownerRef = await ownerRefFromContext(ctx);
  const store = await getPlatformStore();
  const deliverable = await requireDeliverable(store, ownerRef, deliverableId);
  return { deliverable };
}

export const campaignServiceImpl = {
  create: createCampaign,
  update: updateCampaign,
  get: getCampaign,
  list: listCampaigns,
  archive: archiveCampaign,
  createRevision: createRevisionForCampaign,
  listRevisions: listCampaignRevisions,
  getRevision: getCampaignRevision,
  linkProduct: linkCampaignProduct,
  unlinkProduct: unlinkCampaignProduct,
  listProducts: listCampaignProducts,
  linkCharacter: linkCampaignCharacter,
  unlinkCharacter: unlinkCampaignCharacter,
  listCharacters: listCampaignCharacters,
  generateConcepts: generateCampaignConcepts,
  listConcepts: listCampaignConcepts,
  getConcept: getCampaignConcept,
  updateConcept: updateCampaignConcept,
  selectConcept: selectCampaignConcept,
  createDeliverables: createCampaignDeliverables,
  batchCreateAndPlanDeliverables,
  generateDeliverableCopy: generateCampaignDeliverableCopy,
  generateDeliverableImage: generateCampaignDeliverableImage,
  completeDeliverable: completeCampaignDeliverable,
  failDeliverable: failCampaignDeliverable,
  listDeliverables: listCampaignDeliverables,
  getDeliverable: getCampaignDeliverable,
  attachAsset: attachCampaignAsset,
  listAssets: listCampaignAssets,
  removeAsset: removeCampaignAsset,
};

/** Deliverable statuses re-exported for callers that import the service module. */
export { CAMPAIGN_DELIVERABLE_STATUSES };
