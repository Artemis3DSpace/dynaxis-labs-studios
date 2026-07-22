/**
 * In-memory Brand-domain store methods (tests).
 * Mixed into createMemoryStore().
 */

import { randomUUID } from 'node:crypto';

function now() {
  return new Date();
}

function clone(row) {
  return row == null ? row : JSON.parse(JSON.stringify(row));
}

/**
 * @param {object} maps
 */
export function createBrandMemoryMethods(maps) {
  const {
    brands,
    brandRevisions,
    brandAssets,
    brandProducts,
    projectBrands,
    assets,
    projects,
    products,
  } = maps;

  return {
    async createBrand(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        industry: data.industry ?? null,
        tagline: data.tagline ?? null,
        valueProposition: data.valueProposition ?? null,
        targetAudience: data.targetAudience ?? null,
        imageryStyle: data.imageryStyle ?? null,
        layoutStyle: data.layoutStyle ?? null,
        sourceUrl: data.sourceUrl ?? null,
        status: data.status || 'active',
        toneOfVoice: data.toneOfVoice || [],
        brandPersonality: data.brandPersonality || [],
        keyMessages: data.keyMessages || [],
        primaryColors: data.primaryColors || [],
        secondaryColors: data.secondaryColors || [],
        fonts: data.fonts || [],
        primaryAssetId: data.primaryAssetId ?? null,
        currentRevisionId: null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      brands.set(row.id, row);
      return clone(row);
    },

    async getBrand(ownerRef, id) {
      const row = brands.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listBrands(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      return [...brands.values()]
        .filter((b) => b.ownerRef === ownerRef)
        .filter((b) => includeArchived || b.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateBrand(ownerRef, id, patch) {
      const row = brands.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createBrandRevision(data) {
      const existing = [...brandRevisions.values()].filter(
        (r) => r.brandId === data.brandId
      );
      const revisionNumber =
        data.revisionNumber ??
        (existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1);
      const row = {
        id: randomUUID(),
        brandId: data.brandId,
        ownerRef: data.ownerRef,
        revisionNumber,
        snapshot: data.snapshot || {},
        createdAt: now(),
      };
      brandRevisions.set(row.id, row);
      return clone(row);
    },

    async getBrandRevision(ownerRef, id) {
      const row = brandRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listBrandRevisions(ownerRef, brandId) {
      return [...brandRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.brandId === brandId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async linkBrandAsset(data) {
      const key = `${data.brandId}:${data.assetId}`;
      const row = {
        brandId: data.brandId,
        assetId: data.assetId,
        role: data.role || 'brand_reference',
        sortOrder: data.sortOrder ?? 0,
        isPrimary: Boolean(data.isPrimary),
        createdAt: now(),
      };
      brandAssets.set(key, row);
      return clone(row);
    },

    async unlinkBrandAsset(brandId, assetId) {
      return brandAssets.delete(`${brandId}:${assetId}`);
    },

    async listBrandAssets(brandId) {
      const links = [...brandAssets.values()]
        .filter((l) => l.brandId === brandId)
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
      return links.map((l) => {
        const asset = assets.get(l.assetId);
        return clone({ ...l, asset: asset ? clone(asset) : null });
      });
    },

    async linkBrandProduct(data) {
      const key = `${data.brandId}:${data.productId}`;
      const row = {
        brandId: data.brandId,
        productId: data.productId,
        linkedAt: now(),
        isPrimary: data.isPrimary !== undefined ? Boolean(data.isPrimary) : true,
        metadata: data.metadata || {},
      };
      brandProducts.set(key, row);
      return clone(row);
    },

    async unlinkBrandProduct(brandId, productId) {
      return brandProducts.delete(`${brandId}:${productId}`);
    },

    async listBrandProducts(brandId) {
      return [...brandProducts.values()]
        .filter((l) => l.brandId === brandId)
        .map((l) => {
          const product = products?.get?.(l.productId);
          return clone({ ...l, product: product ? clone(product) : null });
        });
    },

    async listProductBrands(productId) {
      return [...brandProducts.values()]
        .filter((l) => l.productId === productId)
        .map((l) => {
          const brand = brands.get(l.brandId);
          return clone({ ...l, brand: brand ? clone(brand) : null });
        });
    },

    async linkProjectBrand(data) {
      const key = `${data.projectId}:${data.brandId}`;
      if (projectBrands.has(key)) return clone(projectBrands.get(key));
      const row = {
        projectId: data.projectId,
        brandId: data.brandId,
        linkedAt: now(),
        metadata: data.metadata || {},
      };
      projectBrands.set(key, row);
      return clone(row);
    },

    async unlinkProjectBrand(projectId, brandId) {
      return projectBrands.delete(`${projectId}:${brandId}`);
    },

    async listBrandProjects(brandId) {
      return [...projectBrands.values()]
        .filter((l) => l.brandId === brandId)
        .map((l) => {
          const project = projects.get(l.projectId);
          return clone({ ...l, project: project ? clone(project) : null });
        });
    },

    async listProjectBrands(projectId) {
      return [...projectBrands.values()]
        .filter((l) => l.projectId === projectId)
        .map(clone);
    },
  };
}
