/**
 * In-memory Design Template store methods (tests).
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
export function createTemplateMemoryMethods(maps) {
  const { designTemplates, designTemplateRevisions, assets } = maps;

  return {
    async createDesignTemplate(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        description: data.description ?? null,
        category: data.category || 'custom',
        status: data.status || 'draft',
        thumbnailAssetId: data.thumbnailAssetId ?? null,
        sourceCompositionId: data.sourceCompositionId ?? null,
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
      designTemplates.set(row.id, row);
      return clone(row);
    },

    async getDesignTemplate(ownerRef, id) {
      const row = designTemplates.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignTemplates(
      ownerRef,
      { status = null, category = null, includeArchived = false, limit = 100 } = {}
    ) {
      return [...designTemplates.values()]
        .filter((t) => t.ownerRef === ownerRef)
        .filter((t) => !status || t.status === status)
        .filter((t) => !category || t.category === category)
        .filter((t) => includeArchived || !t.archivedAt)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateDesignTemplate(ownerRef, id, patch) {
      const row = designTemplates.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async archiveDesignTemplate(ownerRef, id) {
      const row = designTemplates.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      row.archivedAt = now();
      row.status = 'archived';
      row.updatedAt = now();
      return clone(row);
    },

    async createDesignTemplateRevision(data) {
      const existing = [...designTemplateRevisions.values()].filter(
        (r) => r.templateId === data.templateId
      );
      const revisionNumber =
        data.revisionNumber ??
        existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1;
      const row = {
        id: randomUUID(),
        templateId: data.templateId,
        ownerRef: data.ownerRef,
        revisionNumber,
        document: data.document || {},
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        aspectRatio: data.aspectRatio ?? null,
        sourceCompositionRevisionId: data.sourceCompositionRevisionId ?? null,
        label: data.label ?? null,
        createdAt: now(),
      };
      designTemplateRevisions.set(row.id, row);
      return clone(row);
    },

    async getDesignTemplateRevision(ownerRef, id) {
      const row = designTemplateRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listDesignTemplateRevisions(ownerRef, templateId) {
      return [...designTemplateRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.templateId === templateId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async assertAssetOwned(ownerRef, assetId) {
      const asset = assets.get(assetId);
      if (!asset || asset.ownerRef !== ownerRef) return null;
      return clone(asset);
    },
  };
}
