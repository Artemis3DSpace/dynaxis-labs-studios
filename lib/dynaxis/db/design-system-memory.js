/**
 * In-memory Design System + Component Set store methods (tests).
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
export function createDesignSystemMemoryMethods(maps) {
  const {
    designSystems,
    designSystemRevisions,
    designComponentSets,
    designComponentSetVariants,
  } = maps;

  return {
    async createDesignSystem(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        description: data.description ?? null,
        status: data.status || 'draft',
        brandId: data.brandId ?? null,
        brandRevisionId: data.brandRevisionId ?? null,
        currentRevisionId: data.currentRevisionId ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      designSystems.set(row.id, row);
      return clone(row);
    },

    async getDesignSystem(ownerRef, id) {
      const row = designSystems.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignSystems(
      ownerRef,
      { status = null, brandId = null, q = null, includeArchived = false, limit = 100 } = {}
    ) {
      const query = q ? String(q).toLowerCase() : null;
      return [...designSystems.values()]
        .filter((s) => s.ownerRef === ownerRef)
        .filter((s) => !status || s.status === status)
        .filter((s) => !brandId || s.brandId === brandId)
        .filter((s) => includeArchived || !s.archivedAt)
        .filter((s) => {
          if (!query) return true;
          return `${s.name || ''} ${s.description || ''}`.toLowerCase().includes(query);
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateDesignSystem(ownerRef, id, patch) {
      const row = designSystems.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async archiveDesignSystem(ownerRef, id) {
      const row = designSystems.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      row.archivedAt = now();
      row.status = 'archived';
      row.updatedAt = now();
      return clone(row);
    },

    async createDesignSystemRevision(data) {
      const existing = [...designSystemRevisions.values()].filter(
        (r) => r.designSystemId === data.designSystemId
      );
      const revisionNumber =
        data.revisionNumber ??
        existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1;
      const row = {
        id: randomUUID(),
        designSystemId: data.designSystemId,
        ownerRef: data.ownerRef,
        revisionNumber,
        document: data.document || {},
        brandRevisionId: data.brandRevisionId ?? null,
        reason: data.reason ?? null,
        label: data.label ?? null,
        createdAt: now(),
      };
      designSystemRevisions.set(row.id, row);
      return clone(row);
    },

    async getDesignSystemRevision(ownerRef, id) {
      const row = designSystemRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignSystemRevisions(ownerRef, designSystemId) {
      return [...designSystemRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.designSystemId === designSystemId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async createDesignComponentSet(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        description: data.description ?? null,
        category: data.category || 'custom',
        status: data.status || 'draft',
        brandId: data.brandId ?? null,
        brandRevisionId: data.brandRevisionId ?? null,
        thumbnailAssetId: data.thumbnailAssetId ?? null,
        variantAxes: data.variantAxes || [],
        defaultCombination: data.defaultCombination || {},
        tags: data.tags || [],
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      designComponentSets.set(row.id, row);
      return clone(row);
    },

    async getDesignComponentSet(ownerRef, id) {
      const row = designComponentSets.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignComponentSets(
      ownerRef,
      { status = null, category = null, q = null, includeArchived = false, limit = 100 } = {}
    ) {
      const query = q ? String(q).toLowerCase() : null;
      return [...designComponentSets.values()]
        .filter((s) => s.ownerRef === ownerRef)
        .filter((s) => !status || s.status === status)
        .filter((s) => !category || s.category === category)
        .filter((s) => includeArchived || !s.archivedAt)
        .filter((s) => {
          if (!query) return true;
          return `${s.name || ''} ${s.description || ''}`.toLowerCase().includes(query);
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateDesignComponentSet(ownerRef, id, patch) {
      const row = designComponentSets.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async archiveDesignComponentSet(ownerRef, id) {
      const row = designComponentSets.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      row.archivedAt = now();
      row.status = 'archived';
      row.updatedAt = now();
      return clone(row);
    },

    async upsertDesignComponentSetVariant(data) {
      const existing = [...designComponentSetVariants.values()].find(
        (v) =>
          v.componentSetId === data.componentSetId &&
          v.combinationKey === data.combinationKey &&
          v.ownerRef === data.ownerRef
      );
      if (existing) {
        Object.assign(existing, {
          combination: data.combination,
          componentId: data.componentId,
          componentRevisionId: data.componentRevisionId,
          label: data.label ?? existing.label,
          updatedAt: now(),
        });
        return clone(existing);
      }
      const row = {
        id: randomUUID(),
        componentSetId: data.componentSetId,
        ownerRef: data.ownerRef,
        combinationKey: data.combinationKey,
        combination: data.combination || {},
        componentId: data.componentId,
        componentRevisionId: data.componentRevisionId,
        label: data.label ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      designComponentSetVariants.set(row.id, row);
      return clone(row);
    },

    async listDesignComponentSetVariants(ownerRef, componentSetId) {
      return [...designComponentSetVariants.values()]
        .filter((v) => v.ownerRef === ownerRef && v.componentSetId === componentSetId)
        .map(clone);
    },

    async getDesignComponentSetVariantByKey(ownerRef, componentSetId, combinationKey) {
      const row = [...designComponentSetVariants.values()].find(
        (v) =>
          v.ownerRef === ownerRef &&
          v.componentSetId === componentSetId &&
          v.combinationKey === combinationKey
      );
      return clone(row || null);
    },

    async deleteDesignComponentSetVariant(ownerRef, id) {
      const row = designComponentSetVariants.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      designComponentSetVariants.delete(id);
      return clone(row);
    },
  };
}
