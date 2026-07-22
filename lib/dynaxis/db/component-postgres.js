/**
 * PostgreSQL Design Component store methods.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  dynaxisDesignComponents,
  dynaxisDesignComponentRevisions,
  dynaxisCompositionComponentInstances,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createComponentPostgresMethods(db) {
  return {
    async createDesignComponent(data) {
      const [row] = await db
        .insert(dynaxisDesignComponents)
        .values({
          ownerRef: data.ownerRef,
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
        })
        .returning();
      return row;
    },

    async getDesignComponent(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignComponents)
        .where(
          and(eq(dynaxisDesignComponents.id, id), eq(dynaxisDesignComponents.ownerRef, ownerRef))
        )
        .limit(1);
      return row || null;
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
      const rows = await db
        .select()
        .from(dynaxisDesignComponents)
        .where(eq(dynaxisDesignComponents.ownerRef, ownerRef))
        .orderBy(desc(dynaxisDesignComponents.updatedAt))
        .limit(Math.min(500, limit * 3));

      const query = q ? String(q).toLowerCase() : null;
      return rows
        .filter((c) => {
          if (status && c.status !== status) return false;
          if (category && c.category !== category) return false;
          if (brandId && c.brandId !== brandId) return false;
          if (!includeArchived && c.archivedAt) return false;
          if (tag && !(Array.isArray(c.tags) && c.tags.includes(tag))) return false;
          if (query) {
            const hay = `${c.name || ''} ${c.description || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
            if (!hay.includes(query)) return false;
          }
          return true;
        })
        .slice(0, limit);
    },

    async updateDesignComponent(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisDesignComponents)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(dynaxisDesignComponents.id, id), eq(dynaxisDesignComponents.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async archiveDesignComponent(ownerRef, id) {
      const [row] = await db
        .update(dynaxisDesignComponents)
        .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(
          and(eq(dynaxisDesignComponents.id, id), eq(dynaxisDesignComponents.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async createDesignComponentRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisDesignComponentRevisions.revisionNumber })
          .from(dynaxisDesignComponentRevisions)
          .where(eq(dynaxisDesignComponentRevisions.componentId, data.componentId))
          .orderBy(desc(dynaxisDesignComponentRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisDesignComponentRevisions)
        .values({
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
        })
        .returning();
      return row;
    },

    async getDesignComponentRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignComponentRevisions)
        .where(
          and(
            eq(dynaxisDesignComponentRevisions.id, id),
            eq(dynaxisDesignComponentRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listDesignComponentRevisions(ownerRef, componentId) {
      return db
        .select()
        .from(dynaxisDesignComponentRevisions)
        .where(
          and(
            eq(dynaxisDesignComponentRevisions.ownerRef, ownerRef),
            eq(dynaxisDesignComponentRevisions.componentId, componentId)
          )
        )
        .orderBy(desc(dynaxisDesignComponentRevisions.revisionNumber));
    },

    async syncCompositionComponentInstances(ownerRef, compositionId, compositionRevisionId, instances) {
      await db
        .delete(dynaxisCompositionComponentInstances)
        .where(
          and(
            eq(dynaxisCompositionComponentInstances.ownerRef, ownerRef),
            eq(dynaxisCompositionComponentInstances.compositionId, compositionId)
          )
        );

      if (!instances?.length) return [];

      const rows = await db
        .insert(dynaxisCompositionComponentInstances)
        .values(
          instances.map((inst) => ({
            ownerRef,
            compositionId,
            compositionRevisionId: compositionRevisionId ?? null,
            layerId: inst.layerId,
            componentId: inst.componentId,
            componentRevisionId: inst.componentRevisionId,
          }))
        )
        .returning();
      return rows;
    },

    async listComponentUsage(ownerRef, componentId) {
      return db
        .select()
        .from(dynaxisCompositionComponentInstances)
        .where(
          and(
            eq(dynaxisCompositionComponentInstances.ownerRef, ownerRef),
            eq(dynaxisCompositionComponentInstances.componentId, componentId)
          )
        );
    },

    async listInstancesUsingComponentRevision(ownerRef, componentRevisionId) {
      return db
        .select()
        .from(dynaxisCompositionComponentInstances)
        .where(
          and(
            eq(dynaxisCompositionComponentInstances.ownerRef, ownerRef),
            eq(dynaxisCompositionComponentInstances.componentRevisionId, componentRevisionId)
          )
        );
    },
  };
}
