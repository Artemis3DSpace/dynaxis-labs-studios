/**
 * Product Consumer — resolve generation-safe Product context for Studios.
 * Pure helpers + async browser resolution via platform-api client.
 *
 * Continuity: reference-based. Scene styling does NOT mutate Products.
 */

/** Preferred roles when auto-selecting product identity references (highest first). */
export const PRODUCT_IDENTITY_ROLE_PRIORITY = [
  'product_reference',
  'transparent_product_reference',
  'packaging_reference',
  'label_reference',
  'detail_reference',
  'logo_reference',
];

/** Roles eligible as visual product photography sources. */
export const PRODUCT_VISUAL_SOURCE_ROLES = [
  'product_reference',
  'transparent_product_reference',
  'packaging_reference',
  'label_reference',
  'detail_reference',
  'logo_reference',
  'generated_product_scene',
];

/**
 * Normalise Product asset link rows from API into a flat list.
 * @param {Array} links
 */
export function normaliseProductAssetLinks(links = []) {
  return (links || [])
    .map((link) => {
      const asset = link.asset || link;
      const assetId = link.assetId || asset?.id || null;
      const url = asset?.url || link.url || null;
      if (!assetId && !url) return null;
      return {
        assetId,
        url,
        role: link.role || asset?.metadata?.semanticRole || 'product_reference',
        sortOrder: link.sortOrder ?? 0,
        isPrimary: Boolean(link.isPrimary),
        type: asset?.type || 'image',
      };
    })
    .filter(Boolean)
    .filter((a) => !a.type || a.type === 'image')
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

/**
 * Deterministic reference selection for a model input budget.
 *
 * @param {ReturnType<typeof normaliseProductAssetLinks>} assets
 * @param {{
 *   maxImages?: number,
 *   selectedAssetIds?: string[]|null,
 *   preferredRoles?: string[],
 * }} opts
 */
export function selectProductReferences(assets, opts = {}) {
  const maxImages = Math.max(0, opts.maxImages ?? 1);
  const preferredRoles = opts.preferredRoles || PRODUCT_IDENTITY_ROLE_PRIORITY;
  const selectedIds = Array.isArray(opts.selectedAssetIds)
    ? opts.selectedAssetIds.filter(Boolean)
    : null;

  const pool = normaliseProductAssetLinks(assets).filter(
    (a) => a.url && /^https?:\/\//i.test(a.url)
  );

  let chosen = [];
  if (selectedIds?.length) {
    const byId = new Map(pool.map((a) => [a.assetId, a]));
    for (const id of selectedIds) {
      const hit = byId.get(id);
      if (hit) chosen.push(hit);
      if (chosen.length >= maxImages) break;
    }
  }

  if (!chosen.length && maxImages > 0) {
    const ranked = [...pool].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const ra = preferredRoles.indexOf(a.role);
      const rb = preferredRoles.indexOf(b.role);
      const sa = ra === -1 ? preferredRoles.length : ra;
      const sb = rb === -1 ? preferredRoles.length : rb;
      if (sa !== sb) return sa - sb;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    chosen = ranked.slice(0, maxImages);
  }

  if (selectedIds?.length && chosen.length > maxImages) {
    const err = new Error(
      `Selected ${chosen.length} Product references exceeds model limit of ${maxImages}`
    );
    err.code = 'PRODUCT_REFERENCE_LIMIT';
    throw err;
  }

  return {
    references: chosen.slice(0, maxImages),
    urls: chosen.slice(0, maxImages).map((r) => r.url).filter(Boolean),
    assetIds: chosen
      .slice(0, maxImages)
      .map((r) => r.assetId)
      .filter(Boolean),
    maxImages,
    truncated: pool.length > maxImages,
    availableCount: pool.length,
  };
}

/**
 * Visual-only fields for product photography (not Brand DNA / campaigns).
 * @param {object} product
 * @param {object|null} revision
 */
export function buildProductVisualDescription(product, revision = null) {
  const src = revision?.snapshot || revision || product || {};
  const parts = [];
  if (src.name || product?.name) parts.push(String(src.name || product.name).trim());
  const visual =
    src.visualDescription ||
    product?.visualDescription ||
    src.description ||
    product?.description;
  if (visual) parts.push(String(visual).trim());
  // Claims are optional marketing facts — include briefly only if short
  const claims = src.claims || product?.claims;
  if (Array.isArray(claims) && claims.length) {
    const joined = claims
      .map((c) => String(c).trim())
      .filter(Boolean)
      .slice(0, 5)
      .join('; ');
    if (joined && joined.length <= 300) parts.push(`Features: ${joined}`);
  }
  return parts.filter(Boolean).join('. ');
}

/**
 * Runtime ProductVisualContext projection (not a DB entity).
 */
export function buildProductVisualContext({
  product,
  revision = null,
  assets = [],
  referenceSelection = null,
  consumer = null,
}) {
  const rev = revision || null;
  const productId = product?.id || null;
  const productRevisionId = rev?.id || product?.currentRevisionId || null;
  const allAssets = normaliseProductAssetLinks(assets);
  const selection =
    referenceSelection ||
    selectProductReferences(allAssets, { maxImages: 14 });

  return {
    productId,
    productRevisionId,
    name: product?.name || rev?.snapshot?.name || null,
    productType: product?.productType || rev?.snapshot?.productType || null,
    category: product?.category || rev?.snapshot?.category || null,
    brandName: product?.brandName || rev?.snapshot?.brandName || null,
    visualDescription: buildProductVisualDescription(product, rev),
    primaryAssetId: product?.primaryAssetId || null,
    references: selection.references,
    referenceUrls: selection.urls,
    referenceAssetIds: selection.assetIds,
    allAssets,
    continuity: 'reference-based',
    consumer: consumer || null,
    pinnedRevision: Boolean(revision),
  };
}

/**
 * Resolve Product context via platform client (browser / tests).
 *
 * @param {{ getProduct: Function, listProductAssets?: Function, listProductRevisions?: Function, linkProductToProject?: Function }} client
 * @param {string} productId
 * @param {{
 *   revisionId?: string|null,
 *   maxImages?: number,
 *   selectedAssetIds?: string[]|null,
 *   projectId?: string|null,
 *   linkToProject?: boolean,
 *   consumer?: string,
 * }} [options]
 */
export async function resolveProductContext(client, productId, options = {}) {
  if (!client || typeof client.getProduct !== 'function') {
    const err = new Error('Platform client required to resolve Product context');
    err.code = 'PRODUCT_CLIENT_REQUIRED';
    throw err;
  }
  if (!productId) {
    const err = new Error('productId is required');
    err.code = 'PRODUCT_ID_REQUIRED';
    throw err;
  }

  const data = await client.getProduct(productId, { includeAssets: 'true' });
  const product = data?.product || data;
  if (!product?.id) {
    const err = new Error('Product not found');
    err.code = 'PRODUCT_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let revision = null;
  const revisionId = options.revisionId || null;
  if (revisionId && typeof client.listProductRevisions === 'function') {
    const list = await client.listProductRevisions(productId);
    const revisions = list?.revisions || list || [];
    revision = revisions.find((r) => r.id === revisionId) || null;
    if (!revision) {
      const err = new Error('Product revision not found');
      err.code = 'PRODUCT_REVISION_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  let assets = product.assets || data?.assets || [];
  if ((!assets || !assets.length) && typeof client.listProductAssets === 'function') {
    const assetRes = await client.listProductAssets(productId);
    assets = assetRes?.assets || assetRes || [];
  }

  if (revision?.snapshot?.assets?.length && !options.selectedAssetIds?.length) {
    const snapIds = new Set(
      revision.snapshot.assets.map((a) => a.assetId).filter(Boolean)
    );
    if (snapIds.size) {
      assets = (assets || []).filter(
        (l) => snapIds.has(l.assetId || l.asset?.id)
      );
    }
  }

  const maxImages = options.maxImages ?? 14;
  const selectedCount = Array.isArray(options.selectedAssetIds)
    ? options.selectedAssetIds.filter(Boolean).length
    : 0;
  if (selectedCount > maxImages) {
    const err = new Error(
      `Selected ${selectedCount} Product references exceeds model limit of ${maxImages}`
    );
    err.code = 'PRODUCT_REFERENCE_LIMIT';
    throw err;
  }

  const referenceSelection = selectProductReferences(assets, {
    maxImages,
    selectedAssetIds: options.selectedAssetIds || null,
  });

  if (options.linkToProject && options.projectId && typeof client.linkProductToProject === 'function') {
    try {
      await client.linkProductToProject(productId, {
        projectId: options.projectId,
      });
    } catch {
      // non-fatal — Product remains usable
    }
  }

  const visual = buildProductVisualContext({
    product,
    revision,
    assets,
    referenceSelection,
    consumer: options.consumer || null,
  });

  return {
    product,
    revision: revision || {
      id: product.currentRevisionId,
      revisionNumber: null,
      impliedCurrent: true,
    },
    visual,
    provenance: {
      productId: visual.productId,
      productRevisionId: visual.productRevisionId,
      referenceAssetIds: visual.referenceAssetIds,
      continuity: 'reference-based',
    },
  };
}

/**
 * Publish Product provenance onto window for studio submitAndPoll lifecycle.
 */
export function publishProductGenerationContext(ctx = {}) {
  if (typeof window === 'undefined') return;
  window.__dynaxisProductId = ctx.productId || null;
  window.__dynaxisProductRevisionId = ctx.productRevisionId || null;
  window.__dynaxisProductReferenceAssetIds = Array.isArray(ctx.referenceAssetIds)
    ? ctx.referenceAssetIds
    : null;
  if (ctx.generationMetadata && typeof ctx.generationMetadata === 'object') {
    window.__dynaxisGenerationMetadata = {
      ...(window.__dynaxisGenerationMetadata &&
      typeof window.__dynaxisGenerationMetadata === 'object'
        ? window.__dynaxisGenerationMetadata
        : {}),
      ...ctx.generationMetadata,
    };
  }
  window.dispatchEvent(
    new CustomEvent('dynaxis:product-context', {
      detail: {
        productId: window.__dynaxisProductId,
        productRevisionId: window.__dynaxisProductRevisionId,
        referenceAssetIds: window.__dynaxisProductReferenceAssetIds,
        generationMetadata: window.__dynaxisGenerationMetadata || null,
      },
    })
  );
}

export function clearProductGenerationContext() {
  if (typeof window === 'undefined') return;
  window.__dynaxisProductId = null;
  window.__dynaxisProductRevisionId = null;
  window.__dynaxisProductReferenceAssetIds = null;
  window.dispatchEvent(
    new CustomEvent('dynaxis:product-context', {
      detail: {
        productId: null,
        productRevisionId: null,
        referenceAssetIds: null,
        generationMetadata: window.__dynaxisGenerationMetadata || null,
      },
    })
  );
}

export function readProductGenerationContext() {
  if (typeof window === 'undefined') {
    return {
      productId: null,
      productRevisionId: null,
      referenceAssetIds: null,
      generationMetadata: null,
    };
  }
  return {
    productId: window.__dynaxisProductId || null,
    productRevisionId: window.__dynaxisProductRevisionId || null,
    referenceAssetIds: window.__dynaxisProductReferenceAssetIds || null,
    generationMetadata: window.__dynaxisGenerationMetadata || null,
  };
}
