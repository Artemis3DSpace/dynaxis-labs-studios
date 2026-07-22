/**
 * Dynaxis Product service — persistent reusable creative/commercial entities.
 * Products belong to owner_ref, may link to many Projects, and reference Assets.
 * Continuity: reference-based (product photography identity, not ERP).
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { ASSET_SEMANTIC_ROLES } from '../mini-apps/permissions.js';
import {
  PRODUCT_ASSET_ROLES,
  PRODUCT_CONTINUITY_STRATEGY,
  PRODUCT_TYPES,
} from '../types.js';
import { resolveProjectId } from './projects.js';

const roleEnum = z.enum(ASSET_SEMANTIC_ROLES);

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  productType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .refine(
      (v) => v == null || v === '' || PRODUCT_TYPES.includes(/** @type {any} */ (v)),
      'Invalid product type'
    ),
  sku: z.string().trim().max(120).optional().nullable(),
  brandName: z.string().trim().max(200).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  visualDescription: z.string().trim().max(8000).optional().nullable(),
  claims: z.array(z.string().trim().max(500)).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  projectId: z.string().uuid().optional().nullable(),
});

export const updateProductSchema = createProductSchema
  .omit({ projectId: true })
  .partial()
  .extend({
    status: z.enum(['active', 'archived']).optional(),
  });

export const linkProductAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: roleEnum.default('product_reference'),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  createRevision: z.boolean().optional().default(true),
});

function notFound(code, message) {
  const err = new Error(message);
  err.status = 404;
  err.code = code;
  return err;
}

async function requireProduct(store, ownerRef, productId) {
  const product = await store.getProduct(ownerRef, productId);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return product;
}

async function requireOwnedAsset(store, ownerRef, assetId) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  return asset;
}

function profileFromProduct(product) {
  return {
    name: product.name,
    description: product.description,
    productType: product.productType,
    sku: product.sku,
    brandName: product.brandName,
    category: product.category,
    visualDescription: product.visualDescription,
    claims: product.claims || [],
  };
}

export async function createRevisionForProduct(ownerRef, productId, { reason } = {}) {
  const store = await getPlatformStore();
  const product = await requireProduct(store, ownerRef, productId);
  const assetLinks = await store.listProductAssets(productId);
  const revision = await store.createProductRevision({
    productId,
    ownerRef,
    ...profileFromProduct(product),
    snapshot: {
      continuity: PRODUCT_CONTINUITY_STRATEGY,
      reason: reason || 'update',
      primaryAssetId: product.primaryAssetId,
      assets: assetLinks.map((l) => ({
        assetId: l.assetId,
        role: l.role,
        sortOrder: l.sortOrder,
        isPrimary: l.isPrimary,
        url: l.asset?.url || null,
      })),
    },
  });
  await store.updateProduct(ownerRef, productId, {
    currentRevisionId: revision.id,
  });
  return revision;
}

export async function createProduct(ownerRef, input) {
  const data = createProductSchema.parse(input);
  const store = await getPlatformStore();
  const product = await store.createProduct({
    ownerRef,
    name: data.name,
    description: data.description ?? null,
    productType: data.productType || 'physical',
    sku: data.sku ?? null,
    brandName: data.brandName ?? null,
    category: data.category ?? null,
    visualDescription: data.visualDescription ?? null,
    claims: data.claims || [],
    metadata: {
      ...(data.metadata || {}),
      continuity: PRODUCT_CONTINUITY_STRATEGY,
    },
  });
  const revision = await createRevisionForProduct(ownerRef, product.id, {
    reason: 'create',
  });
  if (data.projectId) {
    const project = await resolveProjectId(ownerRef, data.projectId);
    await store.linkProjectProduct({
      projectId: project.id,
      productId: product.id,
    });
  }
  const result = await getProduct(ownerRef, product.id, { includeAssets: true });
  return { ...result, revision };
}

export async function updateProduct(ownerRef, productId, input) {
  const data = updateProductSchema.parse(input);
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const patch = { ...data };
  if (patch.claims === undefined) delete patch.claims;
  const updated = await store.updateProduct(ownerRef, productId, patch);
  if (!updated) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
  if (data.status === 'archived') {
    await store.updateProduct(ownerRef, productId, { archivedAt: new Date() });
  }
  await createRevisionForProduct(ownerRef, productId, { reason: 'profile_update' });
  return getProduct(ownerRef, productId, { includeAssets: true });
}

export async function archiveProduct(ownerRef, productId) {
  return updateProduct(ownerRef, productId, { status: 'archived' });
}

export async function getProduct(ownerRef, productId, { includeAssets = false } = {}) {
  const store = await getPlatformStore();
  const product = await requireProduct(store, ownerRef, productId);
  const result = { product };
  if (includeAssets) {
    result.assets = await store.listProductAssets(productId);
  }
  return result;
}

export async function listProducts(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  const products = await store.listProducts(ownerRef, opts);
  return { products };
}

export async function addProductAsset(ownerRef, productId, input) {
  const data = linkProductAssetSchema.parse(input);
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  await requireOwnedAsset(store, ownerRef, data.assetId);

  if (data.isPrimary) {
    const existing = await store.listProductAssets(productId);
    for (const link of existing) {
      if (link.isPrimary && link.assetId !== data.assetId) {
        await store.linkProductAsset({
          productId,
          assetId: link.assetId,
          role: link.role,
          sortOrder: link.sortOrder,
          isPrimary: false,
        });
      }
    }
  }

  const link = await store.linkProductAsset({
    productId,
    assetId: data.assetId,
    role: data.role,
    sortOrder: data.sortOrder ?? 0,
    isPrimary: Boolean(data.isPrimary),
  });

  if (data.isPrimary) {
    await store.updateProduct(ownerRef, productId, { primaryAssetId: data.assetId });
  }

  if (data.createRevision !== false) {
    await createRevisionForProduct(ownerRef, productId, { reason: 'asset_link' });
  }

  return { link, product: (await getProduct(ownerRef, productId, { includeAssets: true })).product };
}

export async function removeProductAsset(ownerRef, productId, assetId) {
  const store = await getPlatformStore();
  const product = await requireProduct(store, ownerRef, productId);
  const removed = await store.unlinkProductAsset(productId, assetId);
  if (!removed) throw notFound('PRODUCT_ASSET_NOT_FOUND', 'Product asset link not found');
  if (product.primaryAssetId === assetId) {
    await store.updateProduct(ownerRef, productId, { primaryAssetId: null });
  }
  await createRevisionForProduct(ownerRef, productId, { reason: 'asset_unlink' });
  return { ok: true };
}

export async function listProductAssets(ownerRef, productId) {
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const assets = await store.listProductAssets(productId);
  return { assets };
}

export async function promoteAssetToProductReference(ownerRef, productId, input) {
  const data = linkProductAssetSchema
    .extend({
      role: roleEnum.default('product_reference'),
      isPrimary: z.boolean().optional().default(false),
    })
    .parse(input);
  return addProductAsset(ownerRef, productId, {
    ...data,
    role: data.role || 'product_reference',
    createRevision: true,
  });
}

export async function linkProductToProject(ownerRef, productId, { projectId }) {
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const project = await resolveProjectId(ownerRef, projectId);
  const link = await store.linkProjectProduct({
    projectId: project.id,
    productId,
  });
  return { link };
}

export async function unlinkProductFromProject(ownerRef, productId, projectId) {
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const project = await resolveProjectId(ownerRef, projectId);
  await store.unlinkProjectProduct(project.id, productId);
  return { ok: true };
}

export async function listProductProjects(ownerRef, productId) {
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const links = await store.listProductProjects(productId);
  return { projects: links };
}

export async function listProductRevisions(ownerRef, productId) {
  const store = await getPlatformStore();
  await requireProduct(store, ownerRef, productId);
  const revisions = await store.listProductRevisions(ownerRef, productId);
  return { revisions };
}

export async function getProductRevision(ownerRef, revisionId) {
  const store = await getPlatformStore();
  const revision = await store.getProductRevision(ownerRef, revisionId);
  if (!revision) throw notFound('PRODUCT_REVISION_NOT_FOUND', 'Product revision not found');
  return { revision };
}

export const productServiceImpl = {
  create: createProduct,
  update: updateProduct,
  get: getProduct,
  list: listProducts,
  archive: archiveProduct,
  addAsset: addProductAsset,
  removeAsset: removeProductAsset,
  listAssets: listProductAssets,
  promoteAsset: promoteAssetToProductReference,
  linkProject: linkProductToProject,
  unlinkProject: unlinkProductFromProject,
  listProjects: listProductProjects,
  listRevisions: listProductRevisions,
  getRevision: getProductRevision,
  createRevision: createRevisionForProduct,
};

/** Roles preferred when selecting Product photography references. */
export const PRODUCT_REFERENCE_ROLE_PRIORITY = [
  'product_reference',
  'transparent_product_reference',
  'packaging_reference',
  'detail_reference',
  'label_reference',
  'logo_reference',
];

export { PRODUCT_ASSET_ROLES };
