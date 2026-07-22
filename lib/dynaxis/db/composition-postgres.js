/**
 * PostgreSQL Composition-domain store methods.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  dynaxisCompositions,
  dynaxisCompositionRevisions,
  dynaxisCompositionExports,
  dynaxisAssetDerivations,
  dynaxisCampaignDeliverables,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createCompositionPostgresMethods(db) {
  return {
    async createComposition(data) {
      const [row] = await db
        .insert(dynaxisCompositions)
        .values({
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
        })
        .returning();
      return row;
    },

    async getComposition(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCompositions)
        .where(
          and(eq(dynaxisCompositions.id, id), eq(dynaxisCompositions.ownerRef, ownerRef))
        )
        .limit(1);
      return row || null;
    },

    async getCompositionByDeliverable(ownerRef, deliverableId) {
      const [row] = await db
        .select()
        .from(dynaxisCompositions)
        .where(
          and(
            eq(dynaxisCompositions.ownerRef, ownerRef),
            eq(dynaxisCompositions.campaignDeliverableId, deliverableId)
          )
        )
        .limit(1);
      if (!row?.archivedAt) return row || null;
      return null;
    },

    async listCompositions(
      ownerRef,
      { projectId = null, campaignId = null, includeArchived = false, limit = 100 } = {}
    ) {
      const rows = await db
        .select()
        .from(dynaxisCompositions)
        .where(eq(dynaxisCompositions.ownerRef, ownerRef))
        .orderBy(desc(dynaxisCompositions.updatedAt))
        .limit(limit);
      return rows.filter((c) => {
        if (projectId && c.projectId !== projectId) return false;
        if (campaignId && c.campaignId !== campaignId) return false;
        if (!includeArchived && c.archivedAt) return false;
        return true;
      });
    },

    async updateComposition(ownerRef, id, patch, { expectedVersion } = {}) {
      const [current] = await db
        .select()
        .from(dynaxisCompositions)
        .where(
          and(eq(dynaxisCompositions.id, id), eq(dynaxisCompositions.ownerRef, ownerRef))
        )
        .limit(1);
      if (!current) return { row: null, stale: false };
      if (expectedVersion != null && current.documentVersion !== expectedVersion) {
        return { row: current, stale: true };
      }
      const nextVersion =
        patch.document != null ? (current.documentVersion || 1) + 1 : current.documentVersion;
      const [row] = await db
        .update(dynaxisCompositions)
        .set({ ...patch, documentVersion: nextVersion, updatedAt: new Date() })
        .where(
          and(eq(dynaxisCompositions.id, id), eq(dynaxisCompositions.ownerRef, ownerRef))
        )
        .returning();
      return { row: row || null, stale: false };
    },

    async archiveComposition(ownerRef, id) {
      const [row] = await db
        .update(dynaxisCompositions)
        .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(
          and(eq(dynaxisCompositions.id, id), eq(dynaxisCompositions.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async createCompositionRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisCompositionRevisions.revisionNumber })
          .from(dynaxisCompositionRevisions)
          .where(eq(dynaxisCompositionRevisions.compositionId, data.compositionId))
          .orderBy(desc(dynaxisCompositionRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisCompositionRevisions)
        .values({
          compositionId: data.compositionId,
          ownerRef: data.ownerRef,
          revisionNumber,
          snapshot: data.snapshot || {},
          label: data.label ?? null,
        })
        .returning();
      return row;
    },

    async getCompositionRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCompositionRevisions)
        .where(
          and(
            eq(dynaxisCompositionRevisions.id, id),
            eq(dynaxisCompositionRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listCompositionRevisions(ownerRef, compositionId) {
      return db
        .select()
        .from(dynaxisCompositionRevisions)
        .where(
          and(
            eq(dynaxisCompositionRevisions.ownerRef, ownerRef),
            eq(dynaxisCompositionRevisions.compositionId, compositionId)
          )
        )
        .orderBy(desc(dynaxisCompositionRevisions.revisionNumber));
    },

    async createCompositionExport(data) {
      const [row] = await db
        .insert(dynaxisCompositionExports)
        .values({
          compositionId: data.compositionId,
          compositionRevisionId: data.compositionRevisionId,
          ownerRef: data.ownerRef,
          assetId: data.assetId,
          exportFormat: data.exportFormat || 'png',
          width: data.width,
          height: data.height,
          renderVersion: data.renderVersion || 'resvg-1',
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async listCompositionExports(ownerRef, compositionId) {
      return db
        .select()
        .from(dynaxisCompositionExports)
        .where(
          and(
            eq(dynaxisCompositionExports.ownerRef, ownerRef),
            eq(dynaxisCompositionExports.compositionId, compositionId)
          )
        )
        .orderBy(desc(dynaxisCompositionExports.createdAt));
    },

    async createAssetDerivation(data) {
      const [row] = await db
        .insert(dynaxisAssetDerivations)
        .values({
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
        })
        .returning();
      return row;
    },

    async listAssetDerivationsForAsset(ownerRef, derivedAssetId) {
      return db
        .select()
        .from(dynaxisAssetDerivations)
        .where(
          and(
            eq(dynaxisAssetDerivations.ownerRef, ownerRef),
            eq(dynaxisAssetDerivations.derivedAssetId, derivedAssetId)
          )
        );
    },

    async updateCampaignDeliverable(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisCampaignDeliverables)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisCampaignDeliverables.id, id),
            eq(dynaxisCampaignDeliverables.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },

    async getCampaignDeliverable(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCampaignDeliverables)
        .where(
          and(
            eq(dynaxisCampaignDeliverables.id, id),
            eq(dynaxisCampaignDeliverables.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },
  };
}
