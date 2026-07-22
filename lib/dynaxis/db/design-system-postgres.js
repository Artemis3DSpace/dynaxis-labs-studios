/**
 * PostgreSQL Design System + Component Set store methods.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  dynaxisDesignSystems,
  dynaxisDesignSystemRevisions,
  dynaxisDesignComponentSets,
  dynaxisDesignComponentSetVariants,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createDesignSystemPostgresMethods(db) {
  return {
    async createDesignSystem(data) {
      const [row] = await db
        .insert(dynaxisDesignSystems)
        .values({
          ownerRef: data.ownerRef,
          name: data.name,
          description: data.description ?? null,
          status: data.status || 'draft',
          brandId: data.brandId ?? null,
          brandRevisionId: data.brandRevisionId ?? null,
          currentRevisionId: data.currentRevisionId ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getDesignSystem(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignSystems)
        .where(and(eq(dynaxisDesignSystems.id, id), eq(dynaxisDesignSystems.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listDesignSystems(
      ownerRef,
      { status = null, brandId = null, q = null, includeArchived = false, limit = 100 } = {}
    ) {
      const rows = await db
        .select()
        .from(dynaxisDesignSystems)
        .where(eq(dynaxisDesignSystems.ownerRef, ownerRef))
        .orderBy(desc(dynaxisDesignSystems.updatedAt))
        .limit(Math.min(500, limit * 3));
      const query = q ? String(q).toLowerCase() : null;
      return rows
        .filter((s) => {
          if (status && s.status !== status) return false;
          if (brandId && s.brandId !== brandId) return false;
          if (!includeArchived && s.archivedAt) return false;
          if (query && !`${s.name || ''} ${s.description || ''}`.toLowerCase().includes(query)) {
            return false;
          }
          return true;
        })
        .slice(0, limit);
    },

    async updateDesignSystem(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisDesignSystems)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisDesignSystems.id, id), eq(dynaxisDesignSystems.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async archiveDesignSystem(ownerRef, id) {
      const [row] = await db
        .update(dynaxisDesignSystems)
        .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(and(eq(dynaxisDesignSystems.id, id), eq(dynaxisDesignSystems.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createDesignSystemRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisDesignSystemRevisions.revisionNumber })
          .from(dynaxisDesignSystemRevisions)
          .where(eq(dynaxisDesignSystemRevisions.designSystemId, data.designSystemId))
          .orderBy(desc(dynaxisDesignSystemRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisDesignSystemRevisions)
        .values({
          designSystemId: data.designSystemId,
          ownerRef: data.ownerRef,
          revisionNumber,
          document: data.document || {},
          brandRevisionId: data.brandRevisionId ?? null,
          reason: data.reason ?? null,
          label: data.label ?? null,
        })
        .returning();
      return row;
    },

    async getDesignSystemRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignSystemRevisions)
        .where(
          and(
            eq(dynaxisDesignSystemRevisions.id, id),
            eq(dynaxisDesignSystemRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listDesignSystemRevisions(ownerRef, designSystemId) {
      return db
        .select()
        .from(dynaxisDesignSystemRevisions)
        .where(
          and(
            eq(dynaxisDesignSystemRevisions.ownerRef, ownerRef),
            eq(dynaxisDesignSystemRevisions.designSystemId, designSystemId)
          )
        )
        .orderBy(desc(dynaxisDesignSystemRevisions.revisionNumber));
    },

    async createDesignComponentSet(data) {
      const [row] = await db
        .insert(dynaxisDesignComponentSets)
        .values({
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
        })
        .returning();
      return row;
    },

    async getDesignComponentSet(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisDesignComponentSets)
        .where(
          and(eq(dynaxisDesignComponentSets.id, id), eq(dynaxisDesignComponentSets.ownerRef, ownerRef))
        )
        .limit(1);
      return row || null;
    },

    async listDesignComponentSets(
      ownerRef,
      { status = null, category = null, q = null, includeArchived = false, limit = 100 } = {}
    ) {
      const rows = await db
        .select()
        .from(dynaxisDesignComponentSets)
        .where(eq(dynaxisDesignComponentSets.ownerRef, ownerRef))
        .orderBy(desc(dynaxisDesignComponentSets.updatedAt))
        .limit(Math.min(500, limit * 3));
      const query = q ? String(q).toLowerCase() : null;
      return rows
        .filter((s) => {
          if (status && s.status !== status) return false;
          if (category && s.category !== category) return false;
          if (!includeArchived && s.archivedAt) return false;
          if (query && !`${s.name || ''} ${s.description || ''}`.toLowerCase().includes(query)) {
            return false;
          }
          return true;
        })
        .slice(0, limit);
    },

    async updateDesignComponentSet(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisDesignComponentSets)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(dynaxisDesignComponentSets.id, id), eq(dynaxisDesignComponentSets.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async archiveDesignComponentSet(ownerRef, id) {
      const [row] = await db
        .update(dynaxisDesignComponentSets)
        .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(
          and(eq(dynaxisDesignComponentSets.id, id), eq(dynaxisDesignComponentSets.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async upsertDesignComponentSetVariant(data) {
      const existing = await this.getDesignComponentSetVariantByKey(
        data.ownerRef,
        data.componentSetId,
        data.combinationKey
      );
      if (existing) {
        const [row] = await db
          .update(dynaxisDesignComponentSetVariants)
          .set({
            combination: data.combination,
            componentId: data.componentId,
            componentRevisionId: data.componentRevisionId,
            label: data.label ?? existing.label,
            updatedAt: new Date(),
          })
          .where(eq(dynaxisDesignComponentSetVariants.id, existing.id))
          .returning();
        return row;
      }
      const [row] = await db
        .insert(dynaxisDesignComponentSetVariants)
        .values({
          componentSetId: data.componentSetId,
          ownerRef: data.ownerRef,
          combinationKey: data.combinationKey,
          combination: data.combination || {},
          componentId: data.componentId,
          componentRevisionId: data.componentRevisionId,
          label: data.label ?? null,
        })
        .returning();
      return row;
    },

    async listDesignComponentSetVariants(ownerRef, componentSetId) {
      return db
        .select()
        .from(dynaxisDesignComponentSetVariants)
        .where(
          and(
            eq(dynaxisDesignComponentSetVariants.ownerRef, ownerRef),
            eq(dynaxisDesignComponentSetVariants.componentSetId, componentSetId)
          )
        );
    },

    async getDesignComponentSetVariantByKey(ownerRef, componentSetId, combinationKey) {
      const [row] = await db
        .select()
        .from(dynaxisDesignComponentSetVariants)
        .where(
          and(
            eq(dynaxisDesignComponentSetVariants.ownerRef, ownerRef),
            eq(dynaxisDesignComponentSetVariants.componentSetId, componentSetId),
            eq(dynaxisDesignComponentSetVariants.combinationKey, combinationKey)
          )
        )
        .limit(1);
      return row || null;
    },

    async deleteDesignComponentSetVariant(ownerRef, id) {
      const [row] = await db
        .delete(dynaxisDesignComponentSetVariants)
        .where(
          and(
            eq(dynaxisDesignComponentSetVariants.id, id),
            eq(dynaxisDesignComponentSetVariants.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },
  };
}
