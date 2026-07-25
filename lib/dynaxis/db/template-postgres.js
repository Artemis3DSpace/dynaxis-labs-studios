/**
 * PostgreSQL Design Template store methods.
 */

import { and, desc, eq } from 'drizzle-orm';
import { dynaxisDesignTemplates, dynaxisDesignTemplateRevisions } from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createTemplatePostgresMethods(db) {
  return {
    async createDesignTemplate(data) {
      const [row] = await db
        .insert(dynaxisDesignTemplates)
        .values({
          ownerRef: data.ownerRef,
          organizationId: data.organizationId ?? null,
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
        })
        .returning();
      return row;
    },

    async getDesignTemplate(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignTemplates)
        .where(
          and(
            eq(dynaxisDesignTemplates.id, id),
            eq(dynaxisDesignTemplates.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listDesignTemplates(
      ownerRef,
      { status = null, category = null, includeArchived = false, limit = 100 } = {}
    ) {
      const rows = await db
        .select()
        .from(dynaxisDesignTemplates)
        .where(eq(dynaxisDesignTemplates.ownerRef, ownerRef))
        .orderBy(desc(dynaxisDesignTemplates.updatedAt))
        .limit(limit);
      return rows.filter((t) => {
        if (status && t.status !== status) return false;
        if (category && t.category !== category) return false;
        if (!includeArchived && t.archivedAt) return false;
        return true;
      });
    },

    async updateDesignTemplate(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisDesignTemplates)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisDesignTemplates.id, id),
            eq(dynaxisDesignTemplates.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },

    async archiveDesignTemplate(ownerRef, id) {
      const [row] = await db
        .update(dynaxisDesignTemplates)
        .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisDesignTemplates.id, id),
            eq(dynaxisDesignTemplates.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },

    async createDesignTemplateRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisDesignTemplateRevisions.revisionNumber })
          .from(dynaxisDesignTemplateRevisions)
          .where(eq(dynaxisDesignTemplateRevisions.templateId, data.templateId))
          .orderBy(desc(dynaxisDesignTemplateRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisDesignTemplateRevisions)
        .values({
          templateId: data.templateId,
          ownerRef: data.ownerRef,
          revisionNumber,
          document: data.document || {},
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
          aspectRatio: data.aspectRatio ?? null,
          sourceCompositionRevisionId: data.sourceCompositionRevisionId ?? null,
          label: data.label ?? null,
        })
        .returning();
      return row;
    },

    async getDesignTemplateRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignTemplateRevisions)
        .where(
          and(
            eq(dynaxisDesignTemplateRevisions.id, id),
            eq(dynaxisDesignTemplateRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listDesignTemplateRevisions(ownerRef, templateId) {
      return db
        .select()
        .from(dynaxisDesignTemplateRevisions)
        .where(
          and(
            eq(dynaxisDesignTemplateRevisions.ownerRef, ownerRef),
            eq(dynaxisDesignTemplateRevisions.templateId, templateId)
          )
        )
        .orderBy(desc(dynaxisDesignTemplateRevisions.revisionNumber));
    },
  };
}
