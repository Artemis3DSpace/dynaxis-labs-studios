/**
 * In-memory Product-domain store methods (tests).
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
export function createProductMemoryMethods(maps) {
  const {
    products,
    productRevisions,
    productAssets,
    projectProducts,
    assets,
    projects,
  } = maps;

  return {
    async createProduct(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        description: data.description ?? null,
        productType: data.productType ?? null,
        sku: data.sku ?? null,
        brandName: data.brandName ?? null,
        category: data.category ?? null,
        status: data.status || 'active',
        visualDescription: data.visualDescription ?? null,
        claims: data.claims || [],
        primaryAssetId: data.primaryAssetId ?? null,
        currentRevisionId: null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      products.set(row.id, row);
      return clone(row);
    },

    async getProduct(ownerRef, id) {
      const row = products.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listProducts(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      return [...products.values()]
        .filter((p) => p.ownerRef === ownerRef)
        .filter((p) => includeArchived || p.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateProduct(ownerRef, id, patch) {
      const row = products.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createProductRevision(data) {
      const existing = [...productRevisions.values()].filter(
        (r) => r.productId === data.productId
      );
      const revisionNumber =
        data.revisionNumber ??
        (existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1);
      const row = {
        id: randomUUID(),
        productId: data.productId,
        ownerRef: data.ownerRef,
        revisionNumber,
        name: data.name,
        description: data.description ?? null,
        productType: data.productType ?? null,
        sku: data.sku ?? null,
        brandName: data.brandName ?? null,
        category: data.category ?? null,
        visualDescription: data.visualDescription ?? null,
        claims: data.claims || [],
        snapshot: data.snapshot || {},
        createdAt: now(),
      };
      productRevisions.set(row.id, row);
      return clone(row);
    },

    async getProductRevision(ownerRef, id) {
      const row = productRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listProductRevisions(ownerRef, productId) {
      return [...productRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.productId === productId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async linkProductAsset(data) {
      const key = `${data.productId}:${data.assetId}`;
      const row = {
        productId: data.productId,
        assetId: data.assetId,
        role: data.role || 'product_reference',
        sortOrder: data.sortOrder ?? 0,
        isPrimary: Boolean(data.isPrimary),
        createdAt: now(),
      };
      productAssets.set(key, row);
      return clone(row);
    },

    async unlinkProductAsset(productId, assetId) {
      return productAssets.delete(`${productId}:${assetId}`);
    },

    async listProductAssets(productId) {
      const links = [...productAssets.values()]
        .filter((l) => l.productId === productId)
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
      return links.map((l) => {
        const asset = assets.get(l.assetId);
        return clone({ ...l, asset: asset ? clone(asset) : null });
      });
    },

    async linkProjectProduct(data) {
      const key = `${data.projectId}:${data.productId}`;
      if (projectProducts.has(key)) return clone(projectProducts.get(key));
      const row = {
        projectId: data.projectId,
        productId: data.productId,
        linkedAt: now(),
        metadata: data.metadata || {},
      };
      projectProducts.set(key, row);
      return clone(row);
    },

    async unlinkProjectProduct(projectId, productId) {
      return projectProducts.delete(`${projectId}:${productId}`);
    },

    async listProjectProducts(projectId) {
      return [...projectProducts.values()]
        .filter((l) => l.projectId === projectId)
        .map(clone);
    },

    async listProductProjects(productId) {
      return [...projectProducts.values()]
        .filter((l) => l.productId === productId)
        .map((l) => {
          const project = projects.get(l.projectId);
          return clone({ ...l, project: project ? clone(project) : null });
        });
    },
  };
}
