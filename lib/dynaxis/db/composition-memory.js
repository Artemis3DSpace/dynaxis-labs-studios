/**
 * In-memory Composition-domain store methods (tests).
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
export function createCompositionMemoryMethods(maps) {
  const {
    compositions,
    compositionRevisions,
    compositionExports,
    assetDerivations,
    assets,
    projects,
    campaigns,
    campaignDeliverables,
  } = maps;

  return {
    async createComposition(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        projectId: data.projectId,
        name: data.name,
        sourceAssetId: data.sourceAssetId ?? null,
        campaignId: data.campaignId ?? null,
        campaignRevisionId: data.campaignRevisionId ?? null,
        campaignConceptId: data.campaignConceptId ?? null,
        campaignDeliverableId: data.campaignDeliverableId ?? null,
        brandId: data.brandId ?? null,
        brandRevisionId: data.brandRevisionId ?? null,
        templateId: data.templateId ?? null,
        templateRevisionId: data.templateRevisionId ?? null,
        sourceCompositionId: data.sourceCompositionId ?? null,
        sourceCompositionRevisionId: data.sourceCompositionRevisionId ?? null,
        adaptationEngineVersion: data.adaptationEngineVersion ?? null,
        adaptationTargetFormatId: data.adaptationTargetFormatId ?? null,
        designSystemId: data.designSystemId ?? null,
        designSystemRevisionId: data.designSystemRevisionId ?? null,
        designSystemModes: data.designSystemModes || {},
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        aspectRatio: data.aspectRatio ?? null,
        status: data.status || 'draft',
        document: data.document || {},
        documentVersion: data.documentVersion ?? 1,
        currentRevisionId: data.currentRevisionId ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      compositions.set(row.id, row);
      return clone(row);
    },

    async getComposition(ownerRef, id) {
      const row = compositions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async getCompositionByDeliverable(ownerRef, deliverableId) {
      for (const row of compositions.values()) {
        if (
          row.ownerRef === ownerRef &&
          row.campaignDeliverableId === deliverableId &&
          !row.archivedAt
        ) {
          return clone(row);
        }
      }
      return null;
    },

    async listCompositions(
      ownerRef,
      { projectId = null, campaignId = null, includeArchived = false, limit = 100 } = {}
    ) {
      return [...compositions.values()]
        .filter((c) => c.ownerRef === ownerRef)
        .filter((c) => !projectId || c.projectId === projectId)
        .filter((c) => !campaignId || c.campaignId === campaignId)
        .filter((c) => includeArchived || !c.archivedAt)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateComposition(ownerRef, id, patch, { expectedVersion } = {}) {
      const row = compositions.get(id);
      if (!row || row.ownerRef !== ownerRef) return { row: null, stale: false };
      if (expectedVersion != null && row.documentVersion !== expectedVersion) {
        return { row: clone(row), stale: true };
      }
      Object.assign(row, patch, { updatedAt: now() });
      if (patch.document != null) {
        row.documentVersion = (row.documentVersion || 1) + 1;
      }
      return { row: clone(row), stale: false };
    },

    async archiveComposition(ownerRef, id) {
      const row = compositions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      row.archivedAt = now();
      row.status = 'archived';
      row.updatedAt = now();
      return clone(row);
    },

    async createCompositionRevision(data) {
      const existing = [...compositionRevisions.values()].filter(
        (r) => r.compositionId === data.compositionId
      );
      const revisionNumber =
        data.revisionNumber ??
        existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1;
      const row = {
        id: randomUUID(),
        compositionId: data.compositionId,
        ownerRef: data.ownerRef,
        revisionNumber,
        snapshot: data.snapshot || {},
        label: data.label ?? null,
        createdAt: now(),
      };
      compositionRevisions.set(row.id, row);
      return clone(row);
    },

    async getCompositionRevision(ownerRef, id) {
      const row = compositionRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCompositionRevisions(ownerRef, compositionId) {
      return [...compositionRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.compositionId === compositionId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async createCompositionExport(data) {
      const row = {
        id: randomUUID(),
        compositionId: data.compositionId,
        compositionRevisionId: data.compositionRevisionId,
        ownerRef: data.ownerRef,
        assetId: data.assetId,
        exportFormat: data.exportFormat || 'png',
        width: data.width,
        height: data.height,
        renderVersion: data.renderVersion || 'resvg-1',
        metadata: data.metadata || {},
        createdAt: now(),
      };
      compositionExports.set(row.id, row);
      return clone(row);
    },

    async listCompositionExports(ownerRef, compositionId) {
      return [...compositionExports.values()]
        .filter((e) => e.ownerRef === ownerRef && e.compositionId === compositionId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(clone);
    },

    async createAssetDerivation(data) {
      const key = `${data.derivedAssetId}:${data.sourceAssetId}`;
      const row = {
        derivedAssetId: data.derivedAssetId,
        sourceAssetId: data.sourceAssetId,
        ownerRef: data.ownerRef,
        compositionId: data.compositionId ?? null,
        compositionRevisionId: data.compositionRevisionId ?? null,
        compositionExportId: data.compositionExportId ?? null,
        campaignId: data.campaignId ?? null,
        campaignDeliverableId: data.campaignDeliverableId ?? null,
        renderFormat: data.renderFormat ?? null,
        renderVersion: data.renderVersion ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
      };
      assetDerivations.set(key, row);
      return clone(row);
    },

    async listAssetDerivationsForAsset(ownerRef, derivedAssetId) {
      return [...assetDerivations.values()]
        .filter((d) => d.ownerRef === ownerRef && d.derivedAssetId === derivedAssetId)
        .map(clone);
    },

    async updateCampaignDeliverable(ownerRef, id, patch) {
      const row = campaignDeliverables?.get?.(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async getCampaignDeliverable(ownerRef, id) {
      const row = campaignDeliverables?.get?.(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },
  };
}
