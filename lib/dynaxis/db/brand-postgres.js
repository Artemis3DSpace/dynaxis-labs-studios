/**
 * PostgreSQL Brand-domain store methods.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  dynaxisBrandAssets,
  dynaxisBrandProducts,
  dynaxisBrandRevisions,
  dynaxisBrands,
  dynaxisProjectBrands,
  dynaxisAssets,
  dynaxisProjects,
  dynaxisProducts,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createBrandPostgresMethods(db) {
  return {
    async createBrand(data) {
      const [row] = await db
        .insert(dynaxisBrands)
        .values({
          ownerRef: data.ownerRef,
          organizationId: data.organizationId ?? null,
          name: data.name,
          industry: data.industry ?? null,
          tagline: data.tagline ?? null,
          valueProposition: data.valueProposition ?? null,
          targetAudience: data.targetAudience ?? null,
          imageryStyle: data.imageryStyle ?? null,
          layoutStyle: data.layoutStyle ?? null,
          sourceUrl: data.sourceUrl ?? null,
          status: data.status || 'active',
          toneOfVoice: data.toneOfVoice || [],
          brandPersonality: data.brandPersonality || [],
          keyMessages: data.keyMessages || [],
          primaryColors: data.primaryColors || [],
          secondaryColors: data.secondaryColors || [],
          fonts: data.fonts || [],
          primaryAssetId: data.primaryAssetId ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getBrand(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisBrands)
        .where(and(eq(dynaxisBrands.id, id), eq(dynaxisBrands.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listBrands(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      const conditions = [eq(dynaxisBrands.ownerRef, ownerRef)];
      if (!includeArchived) conditions.push(ne(dynaxisBrands.status, 'archived'));
      return db
        .select()
        .from(dynaxisBrands)
        .where(and(...conditions))
        .orderBy(desc(dynaxisBrands.updatedAt))
        .limit(limit);
    },

    async updateBrand(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisBrands)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisBrands.id, id), eq(dynaxisBrands.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createBrandRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisBrandRevisions.revisionNumber })
          .from(dynaxisBrandRevisions)
          .where(eq(dynaxisBrandRevisions.brandId, data.brandId))
          .orderBy(desc(dynaxisBrandRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisBrandRevisions)
        .values({
          brandId: data.brandId,
          ownerRef: data.ownerRef,
          revisionNumber,
          snapshot: data.snapshot || {},
        })
        .returning();
      return row;
    },

    async getBrandRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisBrandRevisions)
        .where(
          and(
            eq(dynaxisBrandRevisions.id, id),
            eq(dynaxisBrandRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listBrandRevisions(ownerRef, brandId) {
      return db
        .select()
        .from(dynaxisBrandRevisions)
        .where(
          and(
            eq(dynaxisBrandRevisions.brandId, brandId),
            eq(dynaxisBrandRevisions.ownerRef, ownerRef)
          )
        )
        .orderBy(desc(dynaxisBrandRevisions.revisionNumber));
    },

    async linkBrandAsset(data) {
      const [row] = await db
        .insert(dynaxisBrandAssets)
        .values({
          brandId: data.brandId,
          assetId: data.assetId,
          role: data.role || 'brand_reference',
          sortOrder: data.sortOrder ?? 0,
          isPrimary: Boolean(data.isPrimary),
        })
        .onConflictDoUpdate({
          target: [dynaxisBrandAssets.brandId, dynaxisBrandAssets.assetId],
          set: {
            role: data.role || 'brand_reference',
            sortOrder: data.sortOrder ?? 0,
            isPrimary: Boolean(data.isPrimary),
          },
        })
        .returning();
      return row;
    },

    async unlinkBrandAsset(brandId, assetId) {
      const deleted = await db
        .delete(dynaxisBrandAssets)
        .where(
          and(
            eq(dynaxisBrandAssets.brandId, brandId),
            eq(dynaxisBrandAssets.assetId, assetId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listBrandAssets(brandId) {
      const rows = await db
        .select({
          brandId: dynaxisBrandAssets.brandId,
          assetId: dynaxisBrandAssets.assetId,
          role: dynaxisBrandAssets.role,
          sortOrder: dynaxisBrandAssets.sortOrder,
          isPrimary: dynaxisBrandAssets.isPrimary,
          createdAt: dynaxisBrandAssets.createdAt,
          asset: dynaxisAssets,
        })
        .from(dynaxisBrandAssets)
        .leftJoin(dynaxisAssets, eq(dynaxisBrandAssets.assetId, dynaxisAssets.id))
        .where(eq(dynaxisBrandAssets.brandId, brandId))
        .orderBy(desc(dynaxisBrandAssets.isPrimary), asc(dynaxisBrandAssets.sortOrder));
      return rows;
    },

    async linkBrandProduct(data) {
      const [row] = await db
        .insert(dynaxisBrandProducts)
        .values({
          brandId: data.brandId,
          productId: data.productId,
          isPrimary: data.isPrimary !== undefined ? Boolean(data.isPrimary) : true,
          metadata: data.metadata || {},
        })
        .onConflictDoUpdate({
          target: [dynaxisBrandProducts.brandId, dynaxisBrandProducts.productId],
          set: {
            isPrimary: data.isPrimary !== undefined ? Boolean(data.isPrimary) : true,
            metadata: data.metadata || {},
          },
        })
        .returning();
      return row;
    },

    async unlinkBrandProduct(brandId, productId) {
      const deleted = await db
        .delete(dynaxisBrandProducts)
        .where(
          and(
            eq(dynaxisBrandProducts.brandId, brandId),
            eq(dynaxisBrandProducts.productId, productId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listBrandProducts(brandId) {
      return db
        .select({
          brandId: dynaxisBrandProducts.brandId,
          productId: dynaxisBrandProducts.productId,
          linkedAt: dynaxisBrandProducts.linkedAt,
          isPrimary: dynaxisBrandProducts.isPrimary,
          metadata: dynaxisBrandProducts.metadata,
          product: dynaxisProducts,
        })
        .from(dynaxisBrandProducts)
        .leftJoin(dynaxisProducts, eq(dynaxisBrandProducts.productId, dynaxisProducts.id))
        .where(eq(dynaxisBrandProducts.brandId, brandId));
    },

    async listProductBrands(productId) {
      return db
        .select({
          brandId: dynaxisBrandProducts.brandId,
          productId: dynaxisBrandProducts.productId,
          linkedAt: dynaxisBrandProducts.linkedAt,
          isPrimary: dynaxisBrandProducts.isPrimary,
          metadata: dynaxisBrandProducts.metadata,
          brand: dynaxisBrands,
        })
        .from(dynaxisBrandProducts)
        .leftJoin(dynaxisBrands, eq(dynaxisBrandProducts.brandId, dynaxisBrands.id))
        .where(eq(dynaxisBrandProducts.productId, productId));
    },

    async linkProjectBrand(data) {
      const [existing] = await db
        .select()
        .from(dynaxisProjectBrands)
        .where(
          and(
            eq(dynaxisProjectBrands.projectId, data.projectId),
            eq(dynaxisProjectBrands.brandId, data.brandId)
          )
        )
        .limit(1);
      if (existing) return existing;
      const [row] = await db
        .insert(dynaxisProjectBrands)
        .values({
          projectId: data.projectId,
          brandId: data.brandId,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async unlinkProjectBrand(projectId, brandId) {
      const deleted = await db
        .delete(dynaxisProjectBrands)
        .where(
          and(
            eq(dynaxisProjectBrands.projectId, projectId),
            eq(dynaxisProjectBrands.brandId, brandId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listBrandProjects(brandId) {
      return db
        .select({
          projectId: dynaxisProjectBrands.projectId,
          brandId: dynaxisProjectBrands.brandId,
          linkedAt: dynaxisProjectBrands.linkedAt,
          metadata: dynaxisProjectBrands.metadata,
          project: dynaxisProjects,
        })
        .from(dynaxisProjectBrands)
        .leftJoin(
          dynaxisProjects,
          eq(dynaxisProjectBrands.projectId, dynaxisProjects.id)
        )
        .where(eq(dynaxisProjectBrands.brandId, brandId));
    },

    async listProjectBrands(projectId) {
      return db
        .select()
        .from(dynaxisProjectBrands)
        .where(eq(dynaxisProjectBrands.projectId, projectId));
    },
  };
}
