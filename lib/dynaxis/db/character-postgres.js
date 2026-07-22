/**
 * PostgreSQL Character-domain store methods.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  dynaxisCharacterAssets,
  dynaxisCharacterConversations,
  dynaxisCharacterMessages,
  dynaxisCharacterRevisions,
  dynaxisCharacters,
  dynaxisAssets,
  dynaxisProjectCharacters,
  dynaxisProjects,
} from './schema.js';

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export function createCharacterPostgresMethods(db) {
  return {
    async createCharacter(data) {
      const [row] = await db
        .insert(dynaxisCharacters)
        .values({
          ownerRef: data.ownerRef,
          name: data.name,
          description: data.description ?? null,
          backstory: data.backstory ?? null,
          persona: data.persona ?? null,
          systemPrompt: data.systemPrompt ?? null,
          greeting: data.greeting ?? null,
          category: data.category ?? null,
          status: data.status || 'active',
          source: data.source || 'dynaxis',
          primaryAssetId: data.primaryAssetId ?? null,
          canonicalModel: data.canonicalModel ?? null,
          config: data.config || {},
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getCharacter(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCharacters)
        .where(and(eq(dynaxisCharacters.id, id), eq(dynaxisCharacters.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listCharacters(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      const conditions = [eq(dynaxisCharacters.ownerRef, ownerRef)];
      if (!includeArchived) conditions.push(ne(dynaxisCharacters.status, 'archived'));
      return db
        .select()
        .from(dynaxisCharacters)
        .where(and(...conditions))
        .orderBy(desc(dynaxisCharacters.updatedAt))
        .limit(limit);
    },

    async updateCharacter(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisCharacters)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisCharacters.id, id), eq(dynaxisCharacters.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createCharacterRevision(data) {
      let revisionNumber = data.revisionNumber;
      if (revisionNumber == null) {
        const existing = await db
          .select({ revisionNumber: dynaxisCharacterRevisions.revisionNumber })
          .from(dynaxisCharacterRevisions)
          .where(eq(dynaxisCharacterRevisions.characterId, data.characterId))
          .orderBy(desc(dynaxisCharacterRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (existing[0]?.revisionNumber || 0) + 1;
      }
      const [row] = await db
        .insert(dynaxisCharacterRevisions)
        .values({
          characterId: data.characterId,
          ownerRef: data.ownerRef,
          revisionNumber,
          name: data.name,
          description: data.description ?? null,
          backstory: data.backstory ?? null,
          persona: data.persona ?? null,
          systemPrompt: data.systemPrompt ?? null,
          greeting: data.greeting ?? null,
          category: data.category ?? null,
          canonicalModel: data.canonicalModel ?? null,
          config: data.config || {},
          snapshot: data.snapshot || {},
        })
        .returning();
      return row;
    },

    async getCharacterRevision(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCharacterRevisions)
        .where(
          and(
            eq(dynaxisCharacterRevisions.id, id),
            eq(dynaxisCharacterRevisions.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listCharacterRevisions(ownerRef, characterId) {
      return db
        .select()
        .from(dynaxisCharacterRevisions)
        .where(
          and(
            eq(dynaxisCharacterRevisions.ownerRef, ownerRef),
            eq(dynaxisCharacterRevisions.characterId, characterId)
          )
        )
        .orderBy(desc(dynaxisCharacterRevisions.revisionNumber));
    },

    async linkCharacterAsset({
      characterId,
      assetId,
      role = 'identity_reference',
      sortOrder = 0,
      isPrimary = false,
    }) {
      const [row] = await db
        .insert(dynaxisCharacterAssets)
        .values({ characterId, assetId, role, sortOrder, isPrimary })
        .onConflictDoUpdate({
          target: [dynaxisCharacterAssets.characterId, dynaxisCharacterAssets.assetId],
          set: { role, sortOrder, isPrimary },
        })
        .returning();
      return row;
    },

    async unlinkCharacterAsset(characterId, assetId) {
      const deleted = await db
        .delete(dynaxisCharacterAssets)
        .where(
          and(
            eq(dynaxisCharacterAssets.characterId, characterId),
            eq(dynaxisCharacterAssets.assetId, assetId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listCharacterAssets(characterId) {
      const rows = await db
        .select({
          characterId: dynaxisCharacterAssets.characterId,
          assetId: dynaxisCharacterAssets.assetId,
          role: dynaxisCharacterAssets.role,
          sortOrder: dynaxisCharacterAssets.sortOrder,
          isPrimary: dynaxisCharacterAssets.isPrimary,
          createdAt: dynaxisCharacterAssets.createdAt,
          asset: dynaxisAssets,
        })
        .from(dynaxisCharacterAssets)
        .innerJoin(dynaxisAssets, eq(dynaxisCharacterAssets.assetId, dynaxisAssets.id))
        .where(eq(dynaxisCharacterAssets.characterId, characterId))
        .orderBy(asc(dynaxisCharacterAssets.sortOrder));
      return rows;
    },

    async linkProjectCharacter(projectId, characterId, metadata = {}) {
      const [row] = await db
        .insert(dynaxisProjectCharacters)
        .values({ projectId, characterId, metadata })
        .onConflictDoNothing()
        .returning();
      if (row) return row;
      const [existing] = await db
        .select()
        .from(dynaxisProjectCharacters)
        .where(
          and(
            eq(dynaxisProjectCharacters.projectId, projectId),
            eq(dynaxisProjectCharacters.characterId, characterId)
          )
        )
        .limit(1);
      return existing;
    },

    async unlinkProjectCharacter(projectId, characterId) {
      const deleted = await db
        .delete(dynaxisProjectCharacters)
        .where(
          and(
            eq(dynaxisProjectCharacters.projectId, projectId),
            eq(dynaxisProjectCharacters.characterId, characterId)
          )
        )
        .returning();
      return deleted.length > 0;
    },

    async listProjectCharacters(projectId) {
      return db
        .select()
        .from(dynaxisProjectCharacters)
        .where(eq(dynaxisProjectCharacters.projectId, projectId));
    },

    async listCharacterProjects(characterId) {
      const rows = await db
        .select({
          projectId: dynaxisProjectCharacters.projectId,
          characterId: dynaxisProjectCharacters.characterId,
          linkedAt: dynaxisProjectCharacters.linkedAt,
          metadata: dynaxisProjectCharacters.metadata,
          project: dynaxisProjects,
        })
        .from(dynaxisProjectCharacters)
        .innerJoin(dynaxisProjects, eq(dynaxisProjectCharacters.projectId, dynaxisProjects.id))
        .where(eq(dynaxisProjectCharacters.characterId, characterId));
      return rows;
    },

    async createCharacterConversation(data) {
      const [row] = await db
        .insert(dynaxisCharacterConversations)
        .values({
          ownerRef: data.ownerRef,
          characterId: data.characterId,
          characterRevisionId: data.characterRevisionId ?? null,
          projectId: data.projectId ?? null,
          title: data.title ?? null,
          status: data.status || 'active',
          model: data.model ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getCharacterConversation(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisCharacterConversations)
        .where(
          and(
            eq(dynaxisCharacterConversations.id, id),
            eq(dynaxisCharacterConversations.ownerRef, ownerRef)
          )
        )
        .limit(1);
      return row || null;
    },

    async listCharacterConversations(ownerRef, { characterId, limit = 50 } = {}) {
      const conditions = [eq(dynaxisCharacterConversations.ownerRef, ownerRef)];
      if (characterId) {
        conditions.push(eq(dynaxisCharacterConversations.characterId, characterId));
      }
      return db
        .select()
        .from(dynaxisCharacterConversations)
        .where(and(...conditions))
        .orderBy(desc(dynaxisCharacterConversations.updatedAt))
        .limit(limit);
    },

    async updateCharacterConversation(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisCharacterConversations)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisCharacterConversations.id, id),
            eq(dynaxisCharacterConversations.ownerRef, ownerRef)
          )
        )
        .returning();
      return row || null;
    },

    async createCharacterMessage(data) {
      const [row] = await db
        .insert(dynaxisCharacterMessages)
        .values({
          conversationId: data.conversationId,
          ownerRef: data.ownerRef,
          role: data.role,
          content: data.content,
          model: data.model ?? null,
          characterRevisionId: data.characterRevisionId ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async listCharacterMessages(conversationId, { limit = 200 } = {}) {
      return db
        .select()
        .from(dynaxisCharacterMessages)
        .where(eq(dynaxisCharacterMessages.conversationId, conversationId))
        .orderBy(asc(dynaxisCharacterMessages.createdAt))
        .limit(limit);
    },
  };
}
