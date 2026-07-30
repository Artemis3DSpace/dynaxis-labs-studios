/**
 * In-memory platform store for automated tests only.
 * Activated when DYNAXIS_PLATFORM_DRIVER=memory and NODE_ENV=test
 * (or DYNAXIS_ALLOW_MEMORY_STORE=1). Never used as production fallback.
 */

import { randomUUID } from 'node:crypto';
import { DEFAULT_PROJECT_NAME } from '../types.js';
import { createCharacterMemoryMethods } from './character-memory.js';
import { createProductMemoryMethods } from './product-memory.js';
import { createBrandMemoryMethods } from './brand-memory.js';
import { createCampaignMemoryMethods } from './campaign-memory.js';
import { createCompositionMemoryMethods } from './composition-memory.js';
import { createTemplateMemoryMethods } from './template-memory.js';
import { createComponentMemoryMethods } from './component-memory.js';
import { createDesignSystemMemoryMethods } from './design-system-memory.js';

function now() {
  return new Date();
}

function clone(row) {
  return row == null ? row : JSON.parse(JSON.stringify(row));
}

export function createMemoryStore() {
  /** @type {Map<string, any>} */
  const projects = new Map();
  /** @type {Map<string, any>} canonical Project membership (WP-7C-24 parity) */
  const projectMembers = new Map();
  /** @type {Map<string, any>} */
  const generations = new Map();
  /** @type {Map<string, any>} */
  const jobs = new Map();
  /** @type {Map<string, any>} */
  const assets = new Map();
  /** @type {Map<string, any>} */
  const generationAssets = new Map();
  /** @type {Map<string, any>} */
  const characters = new Map();
  /** @type {Map<string, any>} */
  const characterRevisions = new Map();
  /** @type {Map<string, any>} */
  const characterAssets = new Map();
  /** @type {Map<string, any>} */
  const projectCharacters = new Map();
  /** @type {Map<string, any>} */
  const conversations = new Map();
  /** @type {Map<string, any>} */
  const messages = new Map();
  /** @type {Map<string, any>} */
  const products = new Map();
  /** @type {Map<string, any>} */
  const productRevisions = new Map();
  /** @type {Map<string, any>} */
  const productAssets = new Map();
  /** @type {Map<string, any>} */
  const projectProducts = new Map();
  /** @type {Map<string, any>} */
  const brands = new Map();
  /** @type {Map<string, any>} */
  const brandRevisions = new Map();
  /** @type {Map<string, any>} */
  const brandAssets = new Map();
  /** @type {Map<string, any>} */
  const brandProducts = new Map();
  /** @type {Map<string, any>} */
  const projectBrands = new Map();
  /** @type {Map<string, any>} */
  const campaigns = new Map();
  /** @type {Map<string, any>} */
  const campaignRevisions = new Map();
  /** @type {Map<string, any>} */
  const campaignProducts = new Map();
  /** @type {Map<string, any>} */
  const campaignCharacters = new Map();
  /** @type {Map<string, any>} */
  const campaignConcepts = new Map();
  /** @type {Map<string, any>} */
  const campaignDeliverables = new Map();
  /** @type {Map<string, any>} */
  const campaignAssets = new Map();
  /** @type {Map<string, any>} */
  const compositions = new Map();
  /** @type {Map<string, any>} */
  const compositionRevisions = new Map();
  /** @type {Map<string, any>} */
  const compositionExports = new Map();
  /** @type {Map<string, any>} */
  const assetDerivations = new Map();
  /** @type {Map<string, any>} */
  const designTemplates = new Map();
  /** @type {Map<string, any>} */
  const designTemplateRevisions = new Map();
  /** @type {Map<string, any>} */
  const designComponents = new Map();
  /** @type {Map<string, any>} */
  const designComponentRevisions = new Map();
  /** @type {Map<string, any>} */
  const compositionComponentInstances = new Map();
  /** @type {Map<string, any>} */
  const designSystems = new Map();
  /** @type {Map<string, any>} */
  const designSystemRevisions = new Map();
  /** @type {Map<string, any>} */
  const designComponentSets = new Map();
  /** @type {Map<string, any>} */
  const designComponentSetVariants = new Map();

  const characterMethods = createCharacterMemoryMethods({
    characters,
    characterRevisions,
    characterAssets,
    projectCharacters,
    conversations,
    messages,
    assets,
    projects,
  });

  const productMethods = createProductMemoryMethods({
    products,
    productRevisions,
    productAssets,
    projectProducts,
    assets,
    projects,
  });

  const brandMethods = createBrandMemoryMethods({
    brands,
    brandRevisions,
    brandAssets,
    brandProducts,
    projectBrands,
    assets,
    projects,
    products,
  });

  const campaignMethods = createCampaignMemoryMethods({
    campaigns,
    campaignRevisions,
    campaignProducts,
    campaignCharacters,
    campaignConcepts,
    campaignDeliverables,
    campaignAssets,
    assets,
    projects,
    products,
    characters,
    brands,
  });

  const compositionMethods = createCompositionMemoryMethods({
    compositions,
    compositionRevisions,
    compositionExports,
    assetDerivations,
    assets,
    projects,
    campaigns,
    campaignDeliverables,
  });

  const templateMethods = createTemplateMemoryMethods({
    designTemplates,
    designTemplateRevisions,
    assets,
  });

  const componentMethods = createComponentMemoryMethods({
    designComponents,
    designComponentRevisions,
    compositionComponentInstances,
    assets,
  });

  const designSystemMethods = createDesignSystemMemoryMethods({
    designSystems,
    designSystemRevisions,
    designComponentSets,
    designComponentSetVariants,
  });

  return {
    kind: 'memory',
    ...characterMethods,
    ...productMethods,
    ...brandMethods,
    ...campaignMethods,
    ...compositionMethods,
    ...templateMethods,
    ...componentMethods,
    ...designSystemMethods,

    async createProject({ ownerRef, organizationId = null, name, description, status = 'active', isDefault = false, metadata = {} }) {
      if (isDefault) {
        for (const p of projects.values()) {
          if (p.ownerRef === ownerRef && p.isDefault) {
            throw Object.assign(new Error('Default project already exists'), { code: 'DEFAULT_EXISTS' });
          }
        }
      }
      const row = {
        id: randomUUID(),
        ownerRef,
        organizationId,
        name,
        description: description ?? null,
        status,
        isDefault,
        metadata,
        createdAt: now(),
        updatedAt: now(),
      };
      projects.set(row.id, row);
      return clone(row);
    },

    async getProject(ownerRef, id) {
      const row = projects.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listProjects(ownerRef, { includeArchived = false } = {}) {
      return [...projects.values()]
        .filter((p) => p.ownerRef === ownerRef)
        .filter((p) => includeArchived || p.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(clone);
    },

    async getDefaultProject(ownerRef) {
      const row = [...projects.values()].find((p) => p.ownerRef === ownerRef && p.isDefault);
      return row ? clone(row) : null;
    },

    async updateProject(ownerRef, id, patch) {
      const row = projects.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createGeneration(data) {
      if (data.migrationKey) {
        const existing = [...generations.values()].find((g) => g.migrationKey === data.migrationKey);
        if (existing) return clone(existing);
      }
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        projectId: data.projectId,
        featureId: data.featureId ?? null,
        provider: data.provider || 'muapi',
        model: data.model ?? null,
        prompt: data.prompt ?? null,
        parameters: data.parameters || {},
        status: data.status || 'queued',
        primaryJobId: data.primaryJobId ?? null,
        errorCode: null,
        errorMessage: null,
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
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      };
      generations.set(row.id, row);
      return clone(row);
    },

    async getGeneration(ownerRef, id) {
      const row = generations.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listGenerations(ownerRef, { projectId, limit = 50 } = {}) {
      return [...generations.values()]
        .filter((g) => g.ownerRef === ownerRef)
        .filter((g) => !projectId || g.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateGeneration(ownerRef, id, patch) {
      const row = generations.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async findGenerationByMigrationKey(ownerRef, migrationKey) {
      const row = [...generations.values()].find(
        (g) => g.ownerRef === ownerRef && g.migrationKey === migrationKey
      );
      return row ? clone(row) : null;
    },

    async createJob(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        projectId: data.projectId,
        generationId: data.generationId,
        provider: data.provider || 'muapi',
        providerJobId: data.providerJobId ?? null,
        status: data.status || 'queued',
        progress: data.progress ?? null,
        attemptCount: data.attemptCount ?? 0,
        submittedAt: data.submittedAt ?? null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        lastPolledAt: null,
        errorCode: null,
        errorMessage: null,
        providerMetadata: data.providerMetadata || {},
        createdAt: now(),
        updatedAt: now(),
      };
      jobs.set(row.id, row);
      return clone(row);
    },

    async getJob(ownerRef, id) {
      const row = jobs.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async updateJob(ownerRef, id, patch) {
      const row = jobs.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createAsset(data) {
      const row = {
        id: randomUUID(),
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
        createdAt: now(),
        updatedAt: now(),
      };
      assets.set(row.id, row);
      return clone(row);
    },

    async getAsset(ownerRef, id) {
      const row = assets.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listAssets(ownerRef, { projectId, generationId, limit = 50 } = {}) {
      return [...assets.values()]
        .filter((a) => a.ownerRef === ownerRef)
        .filter((a) => !projectId || a.projectId === projectId)
        .filter((a) => !generationId || a.generationId === generationId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },

    async linkGenerationAsset({ generationId, assetId, role = 'primary', sortOrder = 0 }) {
      const key = `${generationId}:${assetId}`;
      generationAssets.set(key, { generationId, assetId, role, sortOrder });
      return clone(generationAssets.get(key));
    },

    async listAssetsForGeneration(generationId) {
      const links = [...generationAssets.values()]
        .filter((l) => l.generationId === generationId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return links.map((l) => clone(assets.get(l.assetId))).filter(Boolean);
    },

    // === Canonical Persistence Access Bridge (WP-7C-24: Projects and Assets) ===
    //
    // Memory-store parity for the canonical Workspace/Project-scoped methods.
    // Canonical rows persist organization_id (Projects) or project_id inheritance
    // (Assets) and carry no legacy owner_ref (ownerRef === null); they never read
    // or write the owner_ref partition and never fall back to owner_ref.

    async createCanonicalProject({
      organizationId,
      userId,
      name,
      description = null,
      status = 'active',
      isDefault = false,
      metadata = {},
    }) {
      const project = {
        id: randomUUID(),
        ownerRef: null,
        organizationId,
        name,
        description: description ?? null,
        status,
        isDefault,
        metadata,
        createdAt: now(),
        updatedAt: now(),
      };
      // Simulated transaction: stage the Project, then create the creator's
      // owner membership. If membership creation fails, the staged Project is
      // removed so a failed creation never leaves a durable orphan Project.
      projects.set(project.id, project);
      try {
        if (!String(organizationId || '').trim()) {
          throw Object.assign(new Error('organizationId is required'), { code: 'REQUIRED_INPUT' });
        }
        if (!String(userId || '').trim()) {
          throw Object.assign(new Error('userId is required'), { code: 'REQUIRED_INPUT' });
        }
        const membership = {
          id: randomUUID(),
          projectId: project.id,
          organizationId,
          userId,
          role: 'owner',
          createdAt: now(),
          updatedAt: now(),
        };
        projectMembers.set(`${project.id}:${userId}`, membership);
        return { project: clone(project), membership: clone(membership) };
      } catch (err) {
        projects.delete(project.id);
        throw err;
      }
    },

    async getCanonicalProject(projectId) {
      const row = projects.get(projectId);
      return row ? clone(row) : null;
    },

    async updateCanonicalProject({ projectId, organizationId }, patch) {
      const row = projects.get(projectId);
      if (!row || row.organizationId !== organizationId) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async listCanonicalProjectsForUser({ organizationId, userId, includeArchived = false }) {
      const memberProjectIds = new Set(
        [...projectMembers.values()]
          .filter((m) => m.organizationId === organizationId && m.userId === userId)
          .map((m) => m.projectId)
      );
      return [...projects.values()]
        .filter((p) => p.organizationId === organizationId && memberProjectIds.has(p.id))
        .filter((p) => includeArchived || p.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(clone);
    },

    async getCanonicalDefaultProjectForUser({ organizationId, userId }) {
      const row = [...projects.values()].find(
        (p) =>
          p.organizationId === organizationId &&
          p.isDefault &&
          projectMembers.has(`${p.id}:${userId}`)
      );
      return row ? clone(row) : null;
    },

    async createCanonicalAsset(data) {
      const row = {
        id: randomUUID(),
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
        createdAt: now(),
        updatedAt: now(),
      };
      assets.set(row.id, row);
      return clone(row);
    },

    async getCanonicalAsset(assetId) {
      const row = assets.get(assetId);
      return row ? clone(row) : null;
    },

    async listCanonicalAssetsForProject({ projectId, generationId, limit = 50 }) {
      return [...assets.values()]
        .filter((a) => a.projectId === projectId)
        .filter((a) => !generationId || a.generationId === generationId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },

    async findAssetOwnership(assetId) {
      const asset = assets.get(assetId);
      if (!asset) return null;
      const project = projects.get(asset.projectId);
      return {
        type: 'asset',
        id: asset.id,
        projectId: asset.projectId,
        organizationId: project?.organizationId ?? null,
      };
    },

    /** @deprecated name retained for clarity in tests */
    DEFAULT_PROJECT_NAME,
  };
}

let memorySingleton = null;

export function getMemoryStore() {
  if (!memorySingleton) memorySingleton = createMemoryStore();
  return memorySingleton;
}

export function resetMemoryStore() {
  memorySingleton = createMemoryStore();
  return memorySingleton;
}
