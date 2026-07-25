/**
 * In-memory Design Component store methods (tests).
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
export function createComponentMemoryMethods(maps) {
  const {
    designComponents,
    designComponentRevisions,
    compositionComponentInstances,
    assets,
  } = maps;

  return {
    async createDesignComponent(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        organizationId: data.organizationId ?? null,
        name: data.name,
        description: data.description ?? null,
        category: data.category || 'custom',
        status: data.status || 'draft',
        thumbnailAssetId: data.thumbnailAssetId ?? null,
        brandId: data.brandId ?? null,
        brandRevisionId: data.brandRevisionId ?? null,
        brandBinding: data.brandBinding || 'neutral',
        currentRevisionId: data.currentRevisionId ?? null,
        tags: data.tags || [],
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      designComponents.set(row.id, row);
      return clone(row);
    },

    async getDesignComponent(ownerRef, id) {
      const row = designComponents.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignComponents(
      ownerRef,
      {
        status = null,
        category = null,
        brandId = null,
        q = null,
        tag = null,
        includeArchived = false,
        limit = 100,
      } = {}
    ) {
      const query = q ? String(q).toLowerCase() : null;
      return [...designComponents.values()]
        .filter((c) => c.ownerRef === ownerRef)
        .filter((c) => !status || c.status === status)
        .filter((c) => !category || c.category === category)
        .filter((c) => !brandId || c.brandId === brandId)
        .filter((c) => includeArchived || !c.archivedAt)
        .filter((c) => {
          if (!tag) return true;
          return Array.isArray(c.tags) && c.tags.includes(tag);
        })
        .filter((c) => {
          if (!query) return true;
          const hay = `${c.name || ''} ${c.description || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
          return hay.includes(query);
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateDesignComponent(ownerRef, id, patch) {
      const row = designComponents.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async archiveDesignComponent(ownerRef, id) {
      const row = designComponents.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      row.archivedAt = now();
      row.status = 'archived';
      row.updatedAt = now();
      return clone(row);
    },

    async createDesignComponentRevision(data) {
      const existing = [...designComponentRevisions.values()].filter(
        (r) => r.componentId === data.componentId
      );
      const revisionNumber =
        data.revisionNumber ??
        existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1;
      const row = {
        id: randomUUID(),
        componentId: data.componentId,
        ownerRef: data.ownerRef,
        revisionNumber,
        document: data.document || {},
        intrinsicWidth: data.intrinsicWidth,
        intrinsicHeight: data.intrinsicHeight,
        propertyDefinitions: data.propertyDefinitions || data.document?.properties || [],
        sourceCompositionId: data.sourceCompositionId ?? null,
        sourceCompositionRevisionId: data.sourceCompositionRevisionId ?? null,
        brandRevisionId: data.brandRevisionId ?? null,
        reason: data.reason ?? null,
        label: data.label ?? null,
        createdAt: now(),
      };
      designComponentRevisions.set(row.id, row);
      return clone(row);
    },

    async getDesignComponentRevision(ownerRef, id) {
      const row = designComponentRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignComponentRevisions(ownerRef, componentId) {
      return [...designComponentRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.componentId === componentId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async syncCompositionComponentInstances(ownerRef, compositionId, compositionRevisionId, instances) {
      for (const [key, row] of [...compositionComponentInstances.entries()]) {
        if (row.compositionId === compositionId && row.ownerRef === ownerRef) {
          compositionComponentInstances.delete(key);
        }
      }
      const created = [];
      for (const inst of instances || []) {
        const row = {
          id: randomUUID(),
          ownerRef,
          compositionId,
          compositionRevisionId: compositionRevisionId ?? null,
          layerId: inst.layerId,
          componentId: inst.componentId,
          componentRevisionId: inst.componentRevisionId,
          createdAt: now(),
          updatedAt: now(),
        };
        compositionComponentInstances.set(row.id, row);
        created.push(clone(row));
      }
      return created;
    },

    async listComponentUsage(ownerRef, componentId) {
      return [...compositionComponentInstances.values()]
        .filter((r) => r.ownerRef === ownerRef && r.componentId === componentId)
        .map(clone);
    },

    async listInstancesUsingComponentRevision(ownerRef, componentRevisionId) {
      return [...compositionComponentInstances.values()]
        .filter((r) => r.ownerRef === ownerRef && r.componentRevisionId === componentRevisionId)
        .map(clone);
    },

    async assertAssetOwned(ownerRef, assetId) {
      const asset = assets.get(assetId);
      if (!asset || asset.ownerRef !== ownerRef) return null;
      return clone(asset);
    },
  };
}
