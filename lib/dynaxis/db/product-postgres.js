/**
 * PostgreSQL Product-domain store methods.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  dynaxisProductAssets,
  dynaxisProductRevisions,
  dynaxisProducts,
  dynaxisProjectProducts,
  dynaxisAssets,
  dynaxisProjects,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createProductPostgresMethods(db) {
  return {
    async createProduct(data) {
      const [row] = await db
        .insert(dynaxisProducts)
        .values({
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
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getProduct(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisProducts)
        .where(and(eq(dynaxisProducts.id, id), eq(dynaxisProducts.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listProducts(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      const conditions = [eq(dynaxisProducts.ownerRef, ownerRef)];
      if (!includeArchived) conditions.push(ne(dynaxisProducts.status, 'archived'));
      return db
        .select()
        .from(dynaxisProducts)
        .where(and(...conditions))
        .orderBy(desc(dynaxisProducts.updatedAt))
        .limit(limit);
    },

    async updateProduct(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisProducts)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisProducts.id, id), eq(dynaxisProducts.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createProductRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisProductRevisions.revisionNumber })
          .from(dynaxisProductRevisions)
          .where(eq(dynaxisProductRevisions.productId, data.productId))
          .orderBy(desc(dynaxisProductRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisProductRevisions)
        .values({
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
        })
        .returning();
      return row;
    },

    async getProductRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisProductRevisions)
        .where(
          and(
            eq(dynaxisProductRevisions.id, id),
            eq(dynaxisProductRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listProductRevisions(ownerRef, productId) {
      return db
        .select()
        .from(dynaxisProductRevisions)
        .where(
          and(
            eq(dynaxisProductRevisions.productId, productId),
            eq(dynaxisProductRevisions.ownerRef, ownerRef)
          )
        )
        .orderBy(desc(dynaxisProductRevisions.revisionNumber));
    },

    async linkProductAsset(data) {
      const [row] = await db
        .insert(dynaxisProductAssets)
        .values({
          productId: data.productId,
          assetId: data.assetId,
          role: data.role || 'product_reference',
          sortOrder: data.sortOrder ?? 0,
          isPrimary: Boolean(data.isPrimary),
        })
        .onConflictDoUpdate({
          target: [dynaxisProductAssets.productId, dynaxisProductAssets.assetId],
          set: {
            role: data.role || 'product_reference',
            sortOrder: data.sortOrder ?? 0,
            isPrimary: Boolean(data.isPrimary),
          },
        })
        .returning();
      return row;
    },

    async unlinkProductAsset(productId, assetId) {
      const deleted = await db
        .delete(dynaxisProductAssets)
        .where(
          and(
            eq(dynaxisProductAssets.productId, productId),
            eq(dynaxisProductAssets.assetId, assetId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listProductAssets(productId) {
      const rows = await db
        .select({
          productId: dynaxisProductAssets.productId,
          assetId: dynaxisProductAssets.assetId,
          role: dynaxisProductAssets.role,
          sortOrder: dynaxisProductAssets.sortOrder,
          isPrimary: dynaxisProductAssets.isPrimary,
          createdAt: dynaxisProductAssets.createdAt,
          asset: dynaxisAssets,
        })
        .from(dynaxisProductAssets)
        .leftJoin(dynaxisAssets, eq(dynaxisProductAssets.assetId, dynaxisAssets.id))
        .where(eq(dynaxisProductAssets.productId, productId))
        .orderBy(desc(dynaxisProductAssets.isPrimary), asc(dynaxisProductAssets.sortOrder));
      return rows;
    },

    async linkProjectProduct(data) {
      const [existing] = await db
        .select()
        .from(dynaxisProjectProducts)
        .where(
          and(
            eq(dynaxisProjectProducts.projectId, data.projectId),
            eq(dynaxisProjectProducts.productId, data.productId)
          )
        )
        .limit(1);
      if (existing) return existing;
      const [row] = await db
        .insert(dynaxisProjectProducts)
        .values({
          projectId: data.projectId,
          productId: data.productId,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async unlinkProjectProduct(projectId, productId) {
      const deleted = await db
        .delete(dynaxisProjectProducts)
        .where(
          and(
            eq(dynaxisProjectProducts.projectId, projectId),
            eq(dynaxisProjectProducts.productId, productId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listProjectProducts(projectId) {
      return db
        .select()
        .from(dynaxisProjectProducts)
        .where(eq(dynaxisProjectProducts.projectId, projectId));
    },

    async listProductProjects(productId) {
      return db
        .select({
          projectId: dynaxisProjectProducts.projectId,
          productId: dynaxisProjectProducts.productId,
          linkedAt: dynaxisProjectProducts.linkedAt,
          metadata: dynaxisProjectProducts.metadata,
          project: dynaxisProjects,
        })
        .from(dynaxisProjectProducts)
        .leftJoin(
          dynaxisProjects,
          eq(dynaxisProjectProducts.projectId, dynaxisProjects.id)
        )
        .where(eq(dynaxisProjectProducts.productId, productId));
    },
  };
}
