/**
 * PostgreSQL Campaign-domain store methods.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  dynaxisCampaigns,
  dynaxisCampaignRevisions,
  dynaxisCampaignProducts,
  dynaxisCampaignCharacters,
  dynaxisCampaignConcepts,
  dynaxisCampaignDeliverables,
  dynaxisCampaignAssets,
  dynaxisAssets,
  dynaxisProducts,
  dynaxisCharacters,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createCampaignPostgresMethods(db) {
  return {
    async createCampaign(data) {
      const [row] = await db
        .insert(dynaxisCampaigns)
        .values({
          ownerRef: data.ownerRef,
          projectId: data.projectId,
          brandId: data.brandId,
          brandRevisionId: data.brandRevisionId,
          name: data.name,
          goal: data.goal,
          direction: data.direction ?? null,
          status: data.status || 'draft',
          selectedConceptId: data.selectedConceptId ?? null,
          includeBrandLogo: Boolean(data.includeBrandLogo),
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getCampaign(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCampaigns)
        .where(
          and(eq(dynaxisCampaigns.id, id), eq(dynaxisCampaigns.ownerRef, ownerRef))
        )
        .limit(1);
      return row || null;
    },

    async listCampaigns(
      ownerRef,
      { projectId = null, includeArchived = false, limit = 100 } = {}
    ) {
      const conditions = [eq(dynaxisCampaigns.ownerRef, ownerRef)];
      if (projectId) conditions.push(eq(dynaxisCampaigns.projectId, projectId));
      if (!includeArchived) conditions.push(ne(dynaxisCampaigns.status, 'archived'));
      return db
        .select()
        .from(dynaxisCampaigns)
        .where(and(...conditions))
        .orderBy(desc(dynaxisCampaigns.updatedAt))
        .limit(limit);
    },

    async updateCampaign(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisCampaigns)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(dynaxisCampaigns.id, id), eq(dynaxisCampaigns.ownerRef, ownerRef))
        )
        .returning();
      return row || null;
    },

    async createCampaignRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisCampaignRevisions.revisionNumber })
          .from(dynaxisCampaignRevisions)
          .where(eq(dynaxisCampaignRevisions.campaignId, data.campaignId))
          .orderBy(desc(dynaxisCampaignRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisCampaignRevisions)
        .values({
          campaignId: data.campaignId,
          ownerRef: data.ownerRef,
          revisionNumber,
          snapshot: data.snapshot || {},
        })
        .returning();
      return row;
    },

    async getCampaignRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCampaignRevisions)
        .where(
          and(
            eq(dynaxisCampaignRevisions.id, id),
            eq(dynaxisCampaignRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listCampaignRevisions(ownerRef, campaignId) {
      return db
        .select()
        .from(dynaxisCampaignRevisions)
        .where(
          and(
            eq(dynaxisCampaignRevisions.campaignId, campaignId),
            eq(dynaxisCampaignRevisions.ownerRef, ownerRef)
          )
        )
        .orderBy(desc(dynaxisCampaignRevisions.revisionNumber));
    },

    async linkCampaignProduct(data) {
      const [row] = await db
        .insert(dynaxisCampaignProducts)
        .values({
          campaignId: data.campaignId,
          productId: data.productId,
          productRevisionId: data.productRevisionId,
          sortOrder: data.sortOrder ?? 0,
          metadata: data.metadata || {},
        })
        .onConflictDoUpdate({
          target: [dynaxisCampaignProducts.campaignId, dynaxisCampaignProducts.productId],
          set: {
            productRevisionId: data.productRevisionId,
            sortOrder: data.sortOrder ?? 0,
            metadata: data.metadata || {},
          },
        })
        .returning();
      return row;
    },

    async unlinkCampaignProduct(campaignId, productId) {
      const deleted = await db
        .delete(dynaxisCampaignProducts)
        .where(
          and(
            eq(dynaxisCampaignProducts.campaignId, campaignId),
            eq(dynaxisCampaignProducts.productId, productId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listCampaignProducts(campaignId) {
      return db
        .select({
          campaignId: dynaxisCampaignProducts.campaignId,
          productId: dynaxisCampaignProducts.productId,
          productRevisionId: dynaxisCampaignProducts.productRevisionId,
          sortOrder: dynaxisCampaignProducts.sortOrder,
          linkedAt: dynaxisCampaignProducts.linkedAt,
          metadata: dynaxisCampaignProducts.metadata,
          product: dynaxisProducts,
        })
        .from(dynaxisCampaignProducts)
        .leftJoin(
          dynaxisProducts,
          eq(dynaxisCampaignProducts.productId, dynaxisProducts.id)
        )
        .where(eq(dynaxisCampaignProducts.campaignId, campaignId))
        .orderBy(asc(dynaxisCampaignProducts.sortOrder));
    },

    async linkCampaignCharacter(data) {
      const [row] = await db
        .insert(dynaxisCampaignCharacters)
        .values({
          campaignId: data.campaignId,
          characterId: data.characterId,
          characterRevisionId: data.characterRevisionId,
          role: data.role || 'presenter',
          sortOrder: data.sortOrder ?? 0,
          metadata: data.metadata || {},
        })
        .onConflictDoUpdate({
          target: [
            dynaxisCampaignCharacters.campaignId,
            dynaxisCampaignCharacters.characterId,
          ],
          set: {
            characterRevisionId: data.characterRevisionId,
            role: data.role || 'presenter',
            sortOrder: data.sortOrder ?? 0,
            metadata: data.metadata || {},
          },
        })
        .returning();
      return row;
    },

    async unlinkCampaignCharacter(campaignId, characterId) {
      const deleted = await db
        .delete(dynaxisCampaignCharacters)
        .where(
          and(
            eq(dynaxisCampaignCharacters.campaignId, campaignId),
            eq(dynaxisCampaignCharacters.characterId, characterId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listCampaignCharacters(campaignId) {
      return db
        .select({
          campaignId: dynaxisCampaignCharacters.campaignId,
          characterId: dynaxisCampaignCharacters.characterId,
          characterRevisionId: dynaxisCampaignCharacters.characterRevisionId,
          role: dynaxisCampaignCharacters.role,
          sortOrder: dynaxisCampaignCharacters.sortOrder,
          linkedAt: dynaxisCampaignCharacters.linkedAt,
          metadata: dynaxisCampaignCharacters.metadata,
          character: dynaxisCharacters,
        })
        .from(dynaxisCampaignCharacters)
        .leftJoin(
          dynaxisCharacters,
          eq(dynaxisCampaignCharacters.characterId, dynaxisCharacters.id)
        )
        .where(eq(dynaxisCampaignCharacters.campaignId, campaignId))
        .orderBy(asc(dynaxisCampaignCharacters.sortOrder));
    },

    async createCampaignConcept(data) {
      const [row] = await db
        .insert(dynaxisCampaignConcepts)
        .values({
          campaignId: data.campaignId,
          campaignRevisionId: data.campaignRevisionId,
          ownerRef: data.ownerRef,
          title: data.title,
          theme: data.theme,
          keyMessage: data.keyMessage,
          hook: data.hook,
          cta: data.cta,
          recommendedFormatIds: data.recommendedFormatIds || [],
          toneNotes: data.toneNotes ?? null,
          visualDirection: data.visualDirection ?? null,
          status: data.status || 'draft',
          sortOrder: data.sortOrder ?? 0,
          provider: data.provider ?? null,
          model: data.model ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getCampaignConcept(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCampaignConcepts)
        .where(
          and(
            eq(dynaxisCampaignConcepts.id, id),
            eq(dynaxisCampaignConcepts.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listCampaignConcepts(ownerRef, campaignId) {
      return db
        .select()
        .from(dynaxisCampaignConcepts)
        .where(
          and(
            eq(dynaxisCampaignConcepts.campaignId, campaignId),
            eq(dynaxisCampaignConcepts.ownerRef, ownerRef)
          )
        )
        .orderBy(
          asc(dynaxisCampaignConcepts.sortOrder),
          desc(dynaxisCampaignConcepts.updatedAt)
        );
    },

    async updateCampaignConcept(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisCampaignConcepts)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisCampaignConcepts.id, id),
            eq(dynaxisCampaignConcepts.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },

    async createCampaignDeliverable(data) {
      const [row] = await db
        .insert(dynaxisCampaignDeliverables)
        .values({
          campaignId: data.campaignId,
          campaignRevisionId: data.campaignRevisionId,
          conceptId: data.conceptId,
          ownerRef: data.ownerRef,
          formatId: data.formatId,
          outputModality: data.outputModality || 'image',
          status: data.status || 'planned',
          headline: data.headline ?? null,
          body: data.body ?? null,
          cta: data.cta ?? null,
          generationId: data.generationId ?? null,
          assetId: data.assetId ?? null,
          compositionId: data.compositionId ?? null,
          finalAssetId: data.finalAssetId ?? null,
          includeBrandLogo: Boolean(data.includeBrandLogo),
          provider: data.provider ?? null,
          model: data.model ?? null,
          errorCode: data.errorCode ?? null,
          errorMessage: data.errorMessage ?? null,
          outputHistory: data.outputHistory || [],
          metadata: data.metadata || {},
          completedAt: data.completedAt ?? null,
        })
        .returning();
      return row;
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

    async listCampaignDeliverables(
      ownerRef,
      campaignId,
      { conceptId = null, status = null, limit = 100 } = {}
    ) {
      const conditions = [
        eq(dynaxisCampaignDeliverables.campaignId, campaignId),
        eq(dynaxisCampaignDeliverables.ownerRef, ownerRef),
      ];
      if (conceptId) {
        conditions.push(eq(dynaxisCampaignDeliverables.conceptId, conceptId));
      }
      if (status) {
        conditions.push(eq(dynaxisCampaignDeliverables.status, status));
      }
      return db
        .select()
        .from(dynaxisCampaignDeliverables)
        .where(and(...conditions))
        .orderBy(desc(dynaxisCampaignDeliverables.updatedAt))
        .limit(limit);
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

    async linkCampaignAsset(data) {
      const [row] = await db
        .insert(dynaxisCampaignAssets)
        .values({
          campaignId: data.campaignId,
          assetId: data.assetId,
          role: data.role || 'campaign_reference',
          conceptId: data.conceptId ?? null,
          deliverableId: data.deliverableId ?? null,
          sortOrder: data.sortOrder ?? 0,
        })
        .onConflictDoUpdate({
          target: [dynaxisCampaignAssets.campaignId, dynaxisCampaignAssets.assetId],
          set: {
            role: data.role || 'campaign_reference',
            conceptId: data.conceptId ?? null,
            deliverableId: data.deliverableId ?? null,
            sortOrder: data.sortOrder ?? 0,
          },
        })
        .returning();
      return row;
    },

    async unlinkCampaignAsset(campaignId, assetId) {
      const deleted = await db
        .delete(dynaxisCampaignAssets)
        .where(
          and(
            eq(dynaxisCampaignAssets.campaignId, campaignId),
            eq(dynaxisCampaignAssets.assetId, assetId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listCampaignAssets(campaignId) {
      return db
        .select({
          campaignId: dynaxisCampaignAssets.campaignId,
          assetId: dynaxisCampaignAssets.assetId,
          role: dynaxisCampaignAssets.role,
          conceptId: dynaxisCampaignAssets.conceptId,
          deliverableId: dynaxisCampaignAssets.deliverableId,
          sortOrder: dynaxisCampaignAssets.sortOrder,
          createdAt: dynaxisCampaignAssets.createdAt,
          asset: dynaxisAssets,
        })
        .from(dynaxisCampaignAssets)
        .leftJoin(dynaxisAssets, eq(dynaxisCampaignAssets.assetId, dynaxisAssets.id))
        .where(eq(dynaxisCampaignAssets.campaignId, campaignId))
        .orderBy(asc(dynaxisCampaignAssets.sortOrder));
    },
  };
}
