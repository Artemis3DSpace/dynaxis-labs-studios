/**
 * Resolve the active platform store (PostgreSQL via Drizzle, or explicit memory for tests).
 */

import 'server-only';
import { and, desc, eq, ne } from 'drizzle-orm';
import {
  getDb,
  isMemoryDriverAllowed,
  isPlatformDbConfigured,
  PlatformPersistenceError,
} from './client.js';
import {
  dynaxisAssets,
  dynaxisGenerationAssets,
  dynaxisGenerations,
  dynaxisJobs,
  dynaxisProjectMembers,
  dynaxisProjects,
} from './schema.js';
import { getMemoryStore } from './memory-store.js';
import { createCharacterPostgresMethods } from './character-postgres.js';
import { createProductPostgresMethods } from './product-postgres.js';
import { createBrandPostgresMethods } from './brand-postgres.js';
import { createCampaignPostgresMethods } from './campaign-postgres.js';
import { createCompositionPostgresMethods } from './composition-postgres.js';
import { createTemplatePostgresMethods } from './template-postgres.js';
import { createComponentPostgresMethods } from './component-postgres.js';
import { createDesignSystemPostgresMethods } from './design-system-postgres.js';

/**
 * @returns {Promise<any>}
 */
export async function getPlatformStore() {
  if (isMemoryDriverAllowed()) {
    return getMemoryStore();
  }
  if (!isPlatformDbConfigured()) {
    throw new PlatformPersistenceError(
      'DATABASE_URL is required for Dynaxis platform persistence (PostgreSQL).'
    );
  }
  return createPostgresStore(getDb());
}

/**
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
function createPostgresStore(db) {
  const characterMethods = createCharacterPostgresMethods(db);
  const productMethods = createProductPostgresMethods(db);
  const brandMethods = createBrandPostgresMethods(db);
  const campaignMethods = createCampaignPostgresMethods(db);
  const compositionMethods = createCompositionPostgresMethods(db);
  const templateMethods = createTemplatePostgresMethods(db);
  const componentMethods = createComponentPostgresMethods(db);
  const designSystemMethods = createDesignSystemPostgresMethods(db);
  return {
    kind: 'postgres',
    ...characterMethods,
    ...productMethods,
    ...brandMethods,
    ...campaignMethods,
    ...compositionMethods,
    ...templateMethods,
    ...componentMethods,
    ...designSystemMethods,

    async createProject({ ownerRef, organizationId = null, name, description, status = 'active', isDefault = false, metadata = {} }) {
      const [row] = await db
        .insert(dynaxisProjects)
        .values({
          ownerRef,
          organizationId,
          name,
          description: description ?? null,
          status,
          isDefault,
          metadata,
        })
        .returning();
      return row;
    },

    async getProject(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisProjects)
        .where(and(eq(dynaxisProjects.id, id), eq(dynaxisProjects.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listProjects(ownerRef, { includeArchived = false } = {}) {
      const conditions = [eq(dynaxisProjects.ownerRef, ownerRef)];
      if (!includeArchived) {
        conditions.push(ne(dynaxisProjects.status, 'archived'));
      }
      return db
        .select()
        .from(dynaxisProjects)
        .where(and(...conditions))
        .orderBy(desc(dynaxisProjects.updatedAt));
    },

    async getDefaultProject(ownerRef) {
      const [row] = await db
        .select()
        .from(dynaxisProjects)
        .where(and(eq(dynaxisProjects.ownerRef, ownerRef), eq(dynaxisProjects.isDefault, true)))
        .limit(1);
      return row || null;
    },

    async updateProject(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisProjects)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisProjects.id, id), eq(dynaxisProjects.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createGeneration(data) {
      if (data.migrationKey) {
        const existing = await this.findGenerationByMigrationKey(data.ownerRef, data.migrationKey);
        if (existing) return existing;
      }
      try {
        const [row] = await db
          .insert(dynaxisGenerations)
          .values({
            ownerRef: data.ownerRef,
            projectId: data.projectId,
            featureId: data.featureId ?? null,
            provider: data.provider || 'muapi',
            model: data.model ?? null,
            prompt: data.prompt ?? null,
            parameters: data.parameters || {},
            status: data.status || 'queued',
            primaryJobId: data.primaryJobId ?? null,
            migrationKey: data.migrationKey ?? null,
            characterId: data.characterId ?? null,
            characterRevisionId: data.characterRevisionId ?? null,
            productId: data.productId ?? null,
            productRevisionId: data.productRevisionId ?? null,
            brandId: data.brandId ?? null,
            brandRevisionId: data.brandRevisionId ?? null,
            campaignId: data.campaignId ?? null,
            campaignRevisionId: data.campaignRevisionId ?? null,
            metadata: data.metadata || {},
          })
          .returning();
        return row;
      } catch (err) {
        if (data.migrationKey && String(err?.message || '').includes('dynaxis_generations_migration_key')) {
          return this.findGenerationByMigrationKey(data.ownerRef, data.migrationKey);
        }
        throw err;
      }
    },

    async getGeneration(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisGenerations)
        .where(and(eq(dynaxisGenerations.id, id), eq(dynaxisGenerations.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listGenerations(ownerRef, { projectId, limit = 50 } = {}) {
      const conditions = [eq(dynaxisGenerations.ownerRef, ownerRef)];
      if (projectId) conditions.push(eq(dynaxisGenerations.projectId, projectId));
      return db
        .select()
        .from(dynaxisGenerations)
        .where(and(...conditions))
        .orderBy(desc(dynaxisGenerations.createdAt))
        .limit(limit);
    },

    async updateGeneration(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisGenerations)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisGenerations.id, id), eq(dynaxisGenerations.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async findGenerationByMigrationKey(ownerRef, migrationKey) {
      const [row] = await db
        .select()
        .from(dynaxisGenerations)
        .where(
          and(eq(dynaxisGenerations.ownerRef, ownerRef), eq(dynaxisGenerations.migrationKey, migrationKey))
        )
        .limit(1);
      return row || null;
    },

    async createJob(data) {
      const [row] = await db
        .insert(dynaxisJobs)
        .values({
          ownerRef: data.ownerRef,
          projectId: data.projectId,
          generationId: data.generationId,
          provider: data.provider || 'muapi',
          providerJobId: data.providerJobId ?? null,
          status: data.status || 'queued',
          progress: data.progress ?? null,
          attemptCount: data.attemptCount ?? 0,
          submittedAt: data.submittedAt ?? null,
          providerMetadata: data.providerMetadata || {},
        })
        .returning();
      return row;
    },

    async getJob(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisJobs)
        .where(and(eq(dynaxisJobs.id, id), eq(dynaxisJobs.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async updateJob(ownerRef, id, patch) {
      const [row] = await db
        .update(dynaxisJobs)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(dynaxisJobs.id, id), eq(dynaxisJobs.ownerRef, ownerRef)))
        .returning();
      return row || null;
    },

    async createAsset(data) {
      const [row] = await db
        .insert(dynaxisAssets)
        .values({
          ownerRef: data.ownerRef,
          projectId: data.projectId,
          generationId: data.generationId ?? null,
          jobId: data.jobId ?? null,
          type: data.type,
          source: data.source || 'generated',
          provider: data.provider ?? null,
          model: data.model ?? null,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl ?? null,
          mimeType: data.mimeType ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          durationMs: data.durationMs ?? null,
          prompt: data.prompt ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getAsset(ownerRef, id) {
      const [row] = await db
        .select()
        .from(dynaxisAssets)
        .where(and(eq(dynaxisAssets.id, id), eq(dynaxisAssets.ownerRef, ownerRef)))
        .limit(1);
      return row || null;
    },

    async listAssets(ownerRef, { projectId, generationId, limit = 50 } = {}) {
      const conditions = [eq(dynaxisAssets.ownerRef, ownerRef)];
      if (projectId) conditions.push(eq(dynaxisAssets.projectId, projectId));
      if (generationId) conditions.push(eq(dynaxisAssets.generationId, generationId));
      return db
        .select()
        .from(dynaxisAssets)
        .where(and(...conditions))
        .orderBy(desc(dynaxisAssets.createdAt))
        .limit(limit);
    },

    async linkGenerationAsset({ generationId, assetId, role = 'primary', sortOrder = 0 }) {
      const [row] = await db
        .insert(dynaxisGenerationAssets)
        .values({ generationId, assetId, role, sortOrder })
        .onConflictDoNothing()
        .returning();
      return row || { generationId, assetId, role, sortOrder };
    },

    async listAssetsForGeneration(generationId) {
      const rows = await db
        .select({ asset: dynaxisAssets })
        .from(dynaxisGenerationAssets)
        .innerJoin(dynaxisAssets, eq(dynaxisGenerationAssets.assetId, dynaxisAssets.id))
        .where(eq(dynaxisGenerationAssets.generationId, generationId))
        .orderBy(dynaxisGenerationAssets.sortOrder);
      return rows.map((r) => r.asset);
    },

    // === Canonical Persistence Access Bridge (WP-7C-24: Projects and Assets) ===
    //
    // These methods resolve Projects and Assets by canonical Workspace
    // (organization_id) and Project identity rather than the legacy owner_ref
    // partition. Canonical rows persist organization_id (Projects) or project_id
    // inheritance (Assets) and carry no legacy owner_ref (owner_ref IS NULL).
    // They never read or write the owner_ref partition and never accept an
    // owner_ref as identity.

    /**
     * Atomically create a canonical Project and its explicit creator Project
     * membership (role: owner) in one transaction. The membership row lives in
     * the existing dynaxis_project_members table, so the database's Project
     * membership invariants apply unchanged — including the composite FK that
     * requires the creator to be a Better Auth member of the same Workspace. If
     * membership creation fails, the Project insert rolls back, so a failed
     * creation never leaves a durable orphan Project. Only the creator receives
     * this membership; Workspace owner/admin never implies Project owner.
     */
    async createCanonicalProject({
      organizationId,
      userId,
      name,
      description = null,
      status = 'active',
      isDefault = false,
      metadata = {},
    }) {
      return db.transaction(async (tx) => {
        const [project] = await tx
          .insert(dynaxisProjects)
          .values({
            ownerRef: null,
            organizationId,
            name,
            description: description ?? null,
            status,
            isDefault,
            metadata,
          })
          .returning();
        const [membership] = await tx
          .insert(dynaxisProjectMembers)
          .values({
            projectId: project.id,
            organizationId,
            userId,
            role: 'owner',
          })
          .returning();
        return { project, membership };
      });
    },

    async getCanonicalProject(projectId) {
      const [row] = await db
        .select()
        .from(dynaxisProjects)
        .where(eq(dynaxisProjects.id, projectId))
        .limit(1);
      return row || null;
    },

    async updateCanonicalProject({ projectId, organizationId }, patch) {
      const [row] = await db
        .update(dynaxisProjects)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(dynaxisProjects.id, projectId),
            eq(dynaxisProjects.organizationId, organizationId)
          )
        )
        .returning();
      return row || null;
    },

    /**
     * Canonical Project discovery for a human principal: only Projects the user
     * is an explicit dynaxis_project_members member of, within the Workspace.
     * Workspace membership alone never reveals Projects.
     */
    async listCanonicalProjectsForUser({ organizationId, userId, includeArchived = false }) {
      const conditions = [
        eq(dynaxisProjects.organizationId, organizationId),
        eq(dynaxisProjectMembers.userId, userId),
        eq(dynaxisProjectMembers.organizationId, organizationId),
      ];
      if (!includeArchived) {
        conditions.push(ne(dynaxisProjects.status, 'archived'));
      }
      const rows = await db
        .select({ project: dynaxisProjects })
        .from(dynaxisProjects)
        .innerJoin(
          dynaxisProjectMembers,
          eq(dynaxisProjectMembers.projectId, dynaxisProjects.id)
        )
        .where(and(...conditions))
        .orderBy(desc(dynaxisProjects.updatedAt));
      return rows.map((r) => r.project);
    },

    /**
     * The canonical Default Project the given user is an explicit member of.
     * Membership scoping prevents exposing another member's Default Project in a
     * shared Workspace.
     */
    async getCanonicalDefaultProjectForUser({ organizationId, userId }) {
      const [row] = await db
        .select({ project: dynaxisProjects })
        .from(dynaxisProjects)
        .innerJoin(
          dynaxisProjectMembers,
          eq(dynaxisProjectMembers.projectId, dynaxisProjects.id)
        )
        .where(
          and(
            eq(dynaxisProjects.organizationId, organizationId),
            eq(dynaxisProjects.isDefault, true),
            eq(dynaxisProjectMembers.userId, userId),
            eq(dynaxisProjectMembers.organizationId, organizationId)
          )
        )
        .limit(1);
      return row?.project || null;
    },

    async createCanonicalAsset(data) {
      const [row] = await db
        .insert(dynaxisAssets)
        .values({
          ownerRef: null,
          projectId: data.projectId,
          generationId: data.generationId ?? null,
          jobId: data.jobId ?? null,
          type: data.type,
          source: data.source || 'generated',
          provider: data.provider ?? null,
          model: data.model ?? null,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl ?? null,
          mimeType: data.mimeType ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          durationMs: data.durationMs ?? null,
          prompt: data.prompt ?? null,
          metadata: data.metadata || {},
        })
        .returning();
      return row;
    },

    async getCanonicalAsset(assetId) {
      const [row] = await db
        .select()
        .from(dynaxisAssets)
        .where(eq(dynaxisAssets.id, assetId))
        .limit(1);
      return row || null;
    },

    async listCanonicalAssetsForProject({ projectId, generationId, limit = 50 }) {
      const conditions = [eq(dynaxisAssets.projectId, projectId)];
      if (generationId) {
        conditions.push(eq(dynaxisAssets.generationId, generationId));
      }
      return db
        .select()
        .from(dynaxisAssets)
        .where(and(...conditions))
        .orderBy(desc(dynaxisAssets.createdAt))
        .limit(limit);
    },

    /**
     * Trusted Asset ownership lookup for resource-inheritance authorization.
     * organizationId is resolved Asset -> Project -> dynaxis_projects.organization_id,
     * never from caller input; null for an unprojected legacy Project. Returns
     * null when the Asset does not exist.
     */
    async findAssetOwnership(assetId) {
      const [row] = await db
        .select({
          id: dynaxisAssets.id,
          projectId: dynaxisAssets.projectId,
          organizationId: dynaxisProjects.organizationId,
        })
        .from(dynaxisAssets)
        .innerJoin(dynaxisProjects, eq(dynaxisAssets.projectId, dynaxisProjects.id))
        .where(eq(dynaxisAssets.id, assetId))
        .limit(1);
      if (!row) {
        return null;
      }
      return {
        type: 'asset',
        id: row.id,
        projectId: row.projectId,
        organizationId: row.organizationId ?? null,
      };
    },
  };
}

export { PlatformPersistenceError, isPlatformDbConfigured, isMemoryDriverAllowed };
