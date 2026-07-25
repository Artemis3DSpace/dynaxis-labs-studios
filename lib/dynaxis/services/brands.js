/**
 * Dynaxis Brand service — persistent reusable brand identity / DNA entities.
 * Brands belong to owner_ref, may link to many Projects and Products, and reference Assets.
 * Continuity: reference-based (logo / imagery identity + DNA snapshot).
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { resolveWorkspaceOrganizationForLegacyWrite } from '../identity/workspace-ownership.js';
import { ASSET_SEMANTIC_ROLES } from '../mini-apps/permissions.js';
import {
  BRAND_ASSET_ROLES,
  BRAND_CONTINUITY_STRATEGY,
} from '../types.js';
import { resolveProjectId } from './projects.js';

const roleEnum = z.enum(ASSET_SEMANTIC_ROLES);
const stringList = z.array(z.string().trim().max(500)).max(40).optional();
const colorList = z.array(z.string().trim().max(80)).max(40).optional();
const fontList = z
  .array(
    z.union([
      z.string().trim().max(200),
      z.record(z.string(), z.unknown()),
    ])
  )
  .max(20)
  .optional();

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).optional().nullable(),
  tagline: z.string().trim().max(500).optional().nullable(),
  valueProposition: z.string().trim().max(8000).optional().nullable(),
  targetAudience: z.string().trim().max(4000).optional().nullable(),
  imageryStyle: z.string().trim().max(2000).optional().nullable(),
  layoutStyle: z.string().trim().max(2000).optional().nullable(),
  sourceUrl: z.string().trim().max(2000).optional().nullable(),
  toneOfVoice: stringList,
  brandPersonality: stringList,
  keyMessages: stringList,
  primaryColors: colorList,
  secondaryColors: colorList,
  fonts: fontList,
  metadata: z.record(z.string(), z.unknown()).optional(),
  projectId: z.string().uuid().optional().nullable(),
});

export const updateBrandSchema = createBrandSchema
  .omit({ projectId: true })
  .partial()
  .extend({
    status: z.enum(['active', 'archived']).optional(),
  });

export const linkBrandAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: roleEnum.default('brand_reference'),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  createRevision: z.boolean().optional().default(true),
});

export const linkBrandProductSchema = z.object({
  productId: z.string().uuid(),
  isPrimary: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function notFound(code, message) {
  const err = new Error(message);
  err.status = 404;
  err.code = code;
  return err;
}

async function requireBrand(store, ownerRef, brandId) {
  const brand = await store.getBrand(ownerRef, brandId);
  if (!brand) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  return brand;
}

async function requireOwnedAsset(store, ownerRef, assetId) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  return asset;
}

async function requireOwnedProduct(store, ownerRef, productId) {
  const product = await store.getProduct(ownerRef, productId);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return product;
}

function dnaFromBrand(brand) {
  return {
    name: brand.name,
    industry: brand.industry,
    tagline: brand.tagline,
    valueProposition: brand.valueProposition,
    targetAudience: brand.targetAudience,
    imageryStyle: brand.imageryStyle,
    layoutStyle: brand.layoutStyle,
    sourceUrl: brand.sourceUrl,
    toneOfVoice: brand.toneOfVoice || [],
    brandPersonality: brand.brandPersonality || [],
    keyMessages: brand.keyMessages || [],
    primaryColors: brand.primaryColors || [],
    secondaryColors: brand.secondaryColors || [],
    fonts: brand.fonts || [],
  };
}

export async function createRevisionForBrand(ownerRef, brandId, { reason } = {}) {
  const store = await getPlatformStore();
  const brand = await requireBrand(store, ownerRef, brandId);
  const assetLinks = await store.listBrandAssets(brandId);
  const revision = await store.createBrandRevision({
    brandId,
    ownerRef,
    snapshot: {
      continuity: BRAND_CONTINUITY_STRATEGY,
      reason: reason || 'update',
      primaryAssetId: brand.primaryAssetId,
      dna: dnaFromBrand(brand),
      assets: assetLinks.map((l) => ({
        assetId: l.assetId,
        role: l.role,
        sortOrder: l.sortOrder,
        isPrimary: l.isPrimary,
        url: l.asset?.url || null,
      })),
    },
  });
  await store.updateBrand(ownerRef, brandId, {
    currentRevisionId: revision.id,
  });
  return revision;
}

export async function createBrand(ownerRef, input) {
  const data = createBrandSchema.parse(input);
  const store = await getPlatformStore();
  const organizationId = await resolveWorkspaceOrganizationForLegacyWrite(ownerRef);
  const brand = await store.createBrand({
    ownerRef,
    organizationId,
    name: data.name,
    industry: data.industry ?? null,
    tagline: data.tagline ?? null,
    valueProposition: data.valueProposition ?? null,
    targetAudience: data.targetAudience ?? null,
    imageryStyle: data.imageryStyle ?? null,
    layoutStyle: data.layoutStyle ?? null,
    sourceUrl: data.sourceUrl ?? null,
    toneOfVoice: data.toneOfVoice || [],
    brandPersonality: data.brandPersonality || [],
    keyMessages: data.keyMessages || [],
    primaryColors: data.primaryColors || [],
    secondaryColors: data.secondaryColors || [],
    fonts: data.fonts || [],
    metadata: {
      ...(data.metadata || {}),
      continuity: BRAND_CONTINUITY_STRATEGY,
    },
  });
  const revision = await createRevisionForBrand(ownerRef, brand.id, {
    reason: 'create',
  });
  if (data.projectId) {
    const project = await resolveProjectId(ownerRef, data.projectId);
    await store.linkProjectBrand({
      projectId: project.id,
      brandId: brand.id,
    });
  }
  const result = await getBrand(ownerRef, brand.id, { includeAssets: true });
  return { brand: result.brand, revision };
}

export async function updateBrand(ownerRef, brandId, input) {
  const data = updateBrandSchema.parse(input);
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const patch = { ...data };
  for (const key of [
    'toneOfVoice',
    'brandPersonality',
    'keyMessages',
    'primaryColors',
    'secondaryColors',
    'fonts',
  ]) {
    if (patch[key] === undefined) delete patch[key];
  }
  const updated = await store.updateBrand(ownerRef, brandId, patch);
  if (!updated) throw notFound('BRAND_NOT_FOUND', 'Brand not found');
  if (data.status === 'archived') {
    await store.updateBrand(ownerRef, brandId, { archivedAt: new Date() });
  }
  await createRevisionForBrand(ownerRef, brandId, { reason: 'profile_update' });
  return getBrand(ownerRef, brandId, { includeAssets: true });
}

export async function archiveBrand(ownerRef, brandId) {
  return updateBrand(ownerRef, brandId, { status: 'archived' });
}

export async function getBrand(ownerRef, brandId, { includeAssets = false } = {}) {
  const store = await getPlatformStore();
  const brand = await requireBrand(store, ownerRef, brandId);
  const result = { brand };
  if (includeAssets) {
    result.assets = await store.listBrandAssets(brandId);
  }
  return result;
}

export async function listBrands(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const brands = await store.listBrands(ownerRef, opts);
  return { brands };
}

export async function addBrandAsset(ownerRef, brandId, input) {
  const data = linkBrandAssetSchema.parse(input);
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  await requireOwnedAsset(store, ownerRef, data.assetId);

  if (data.isPrimary) {
    const existing = await store.listBrandAssets(brandId);
    for (const link of existing) {
      if (link.isPrimary && link.assetId !== data.assetId) {
        await store.linkBrandAsset({
          brandId,
          assetId: link.assetId,
          role: link.role,
          sortOrder: link.sortOrder,
          isPrimary: false,
        });
      }
    }
  }

  const link = await store.linkBrandAsset({
    brandId,
    assetId: data.assetId,
    role: data.role,
    sortOrder: data.sortOrder ?? 0,
    isPrimary: Boolean(data.isPrimary),
  });

  if (data.isPrimary) {
    await store.updateBrand(ownerRef, brandId, { primaryAssetId: data.assetId });
  }

  if (data.createRevision !== false) {
    await createRevisionForBrand(ownerRef, brandId, { reason: 'asset_link' });
  }

  return { link, brand: (await getBrand(ownerRef, brandId, { includeAssets: true })).brand };
}

export async function removeBrandAsset(ownerRef, brandId, assetId) {
  const store = await getPlatformStore();
  const brand = await requireBrand(store, ownerRef, brandId);
  const removed = await store.unlinkBrandAsset(brandId, assetId);
  if (!removed) throw notFound('BRAND_ASSET_NOT_FOUND', 'Brand asset link not found');
  if (brand.primaryAssetId === assetId) {
    await store.updateBrand(ownerRef, brandId, { primaryAssetId: null });
  }
  await createRevisionForBrand(ownerRef, brandId, { reason: 'asset_unlink' });
  return { ok: true };
}

export async function listBrandAssets(ownerRef, brandId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const assets = await store.listBrandAssets(brandId);
  return { assets };
}

export async function promoteAssetToBrandReference(ownerRef, brandId, input) {
  const data = linkBrandAssetSchema
    .extend({
      role: roleEnum.default('brand_reference'),
      isPrimary: z.boolean().optional().default(false),
    })
    .parse(input);
  return addBrandAsset(ownerRef, brandId, {
    ...data,
    role: data.role || 'brand_reference',
    createRevision: true,
  });
}

export async function linkBrandToProject(ownerRef, brandId, { projectId }) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const project = await resolveProjectId(ownerRef, projectId);
  const link = await store.linkProjectBrand({
    projectId: project.id,
    brandId,
  });
  return { link };
}

export async function unlinkBrandFromProject(ownerRef, brandId, projectId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const project = await resolveProjectId(ownerRef, projectId);
  await store.unlinkProjectBrand(project.id, brandId);
  return { ok: true };
}

export async function listBrandProjects(ownerRef, brandId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const links = await store.listBrandProjects(brandId);
  return { projects: links };
}

export async function linkBrandToProduct(ownerRef, brandId, input) {
  const data = linkBrandProductSchema.parse(input);
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  await requireOwnedProduct(store, ownerRef, data.productId);

  if (data.isPrimary !== false) {
    const existing = await store.listProductBrands(data.productId);
    for (const link of existing) {
      if (link.isPrimary && link.brandId !== brandId) {
        await store.linkBrandProduct({
          brandId: link.brandId,
          productId: data.productId,
          isPrimary: false,
          metadata: link.metadata || {},
        });
      }
    }
  }

  const link = await store.linkBrandProduct({
    brandId,
    productId: data.productId,
    isPrimary: data.isPrimary !== false,
    metadata: data.metadata || {},
  });
  return { link };
}

export async function unlinkBrandFromProduct(ownerRef, brandId, productId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  await requireOwnedProduct(store, ownerRef, productId);
  const removed = await store.unlinkBrandProduct(brandId, productId);
  if (!removed) throw notFound('BRAND_PRODUCT_NOT_FOUND', 'Brand product link not found');
  return { ok: true };
}

export async function listBrandProducts(ownerRef, brandId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const products = await store.listBrandProducts(brandId);
  return { products };
}

export async function listProductBrands(ownerRef, productId) {
  const store = await getPlatformStore();
  await requireOwnedProduct(store, ownerRef, productId);
  const brands = await store.listProductBrands(productId);
  return { brands };
}

export async function listBrandRevisions(ownerRef, brandId) {
  const store = await getPlatformStore();
  await requireBrand(store, ownerRef, brandId);
  const revisions = await store.listBrandRevisions(ownerRef, brandId);
  return { revisions };
}

export async function getBrandRevision(ownerRef, revisionId) {
  const store = await getPlatformStore();
  const revision = await store.getBrandRevision(ownerRef, revisionId);
  if (!revision) throw notFound('BRAND_REVISION_NOT_FOUND', 'Brand revision not found');
  return { revision };
}

export const brandServiceImpl = {
  create: createBrand,
  update: updateBrand,
  get: getBrand,
  list: listBrands,
  archive: archiveBrand,
  addAsset: addBrandAsset,
  removeAsset: removeBrandAsset,
  listAssets: listBrandAssets,
  promoteAsset: promoteAssetToBrandReference,
  linkProject: linkBrandToProject,
  unlinkProject: unlinkBrandFromProject,
  listProjects: listBrandProjects,
  linkProduct: linkBrandToProduct,
  unlinkProduct: unlinkBrandFromProduct,
  listProducts: listBrandProducts,
  listProductBrands,
  listRevisions: listBrandRevisions,
  getRevision: getBrandRevision,
  createRevision: createRevisionForBrand,
};

/** Roles preferred when selecting Brand visual references. */
export const BRAND_REFERENCE_ROLE_PRIORITY = [
  'primary_logo',
  'brand_mark',
  'wordmark',
  'alternate_logo',
  'brand_reference',
  'brand_screenshot',
  'imagery_reference',
];

export { BRAND_ASSET_ROLES };
