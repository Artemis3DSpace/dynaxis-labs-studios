/**
 * Dynaxis Generation History service — durable records replacing hg_* as SoT.
 *
 * Route migration (WP-7C-15) adds AuthContext-aware helpers while preserving
 * legacy owner_ref persistence for explicit route-level legacyCompatibility.
 * Canonical Better Auth persistence for Generations remains blocked until a
 * future persistence bridge (owner_ref is still NOT NULL on dynaxis_generations).
 */

import { z } from 'zod';
import {
  AUTH_CONTEXT_ERROR_CODES,
  AuthContextError,
  assertAuthContextPermission,
} from '../auth/auth-context.js';
import { getPlatformStore } from '../db/store.js';
import { GENERATION_STATUSES, normalizeProviderId, PROVIDER_MUAPI, DEFAULT_PROJECT_NAME } from '../types.js';
import { resolveProjectId } from './projects.js';

function sanitizeErrorMessage(message) {
  const raw = String(message || 'Generation failed');
  return raw
    .replace(/x-api-key[:\s]*[^\s,;]+/gi, 'x-api-key:[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .slice(0, 500);
}

export const createGenerationSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  featureId: z.string().max(100).optional().nullable(),
  provider: z.string().max(100).optional(),
  model: z.string().max(200).optional().nullable(),
  prompt: z.string().max(50000).optional().nullable(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(GENERATION_STATUSES).optional(),
  migrationKey: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  characterId: z.string().uuid().optional().nullable(),
  characterRevisionId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  productRevisionId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  brandRevisionId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  campaignRevisionId: z.string().uuid().optional().nullable(),
});

/** @typedef {{ type: 'generation', id: string, projectId: string, organizationId: string | null }} GenerationOwnership */

/** @type {Map<string, GenerationOwnership>} */
const trustedGenerationOwnership = new Map();

export function isLegacyRouteCompatibility(routeContext) {
  return routeContext?.legacyCompatibility?.used === true;
}

export function legacyOwnerRefFromRoute(routeContext) {
  const ownerRef = String(routeContext?.legacyCompatibility?.ownerRef || '').trim();
  return ownerRef || null;
}

function requireCanonicalWorkspace(authContext) {
  const organizationId = String(authContext?.workspace?.organizationId || '').trim();
  if (!organizationId || authContext?.workspace?.isMember !== true) {
    throw new AuthContextError('Workspace access required', {
      code: AUTH_CONTEXT_ERROR_CODES.WORKSPACE_REQUIRED,
      status: 403,
    });
  }
  return organizationId;
}

function requireCanonicalUserId(authContext) {
  const userId = String(authContext?.principal?.userId || '').trim();
  if (!userId) {
    throw new AuthContextError('Authentication required', {
      code: AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED,
      status: 401,
    });
  }
  return userId;
}

function canonicalPersistenceBlocked() {
  throw new AuthContextError(
    'Canonical generation persistence requires a future persistence bridge',
    {
      code: AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED,
      status: 503,
    }
  );
}

export { canonicalPersistenceBlocked };

export function registerTrustedGenerationOwnership(generation, organizationId = null) {
  if (!generation?.id || !generation?.projectId) {
    return;
  }
  trustedGenerationOwnership.set(generation.id, {
    type: 'generation',
    id: generation.id,
    projectId: generation.projectId,
    organizationId: organizationId ?? null,
  });
}

export function clearTrustedGenerationOwnership(generationId) {
  trustedGenerationOwnership.delete(generationId);
}

/**
 * Trusted Generation ownership lookup for AuthContext resource inheritance.
 * Falls back to Asset linkage when lifecycle outputs exist.
 */
export async function findTrustedGenerationOwnership(generationId) {
  const cached = trustedGenerationOwnership.get(generationId);
  if (cached) {
    return cached;
  }

  const store = await getPlatformStore();
  if (typeof store.findGenerationOwnership === 'function') {
    return store.findGenerationOwnership(generationId);
  }

  const assets = await store.listAssetsForGeneration(generationId);
  if (assets.length > 0 && typeof store.findAssetOwnership === 'function') {
    const assetOwnership = await store.findAssetOwnership(assets[0].id);
    if (assetOwnership) {
      return {
        type: 'generation',
        id: generationId,
        projectId: assetOwnership.projectId,
        organizationId: assetOwnership.organizationId ?? null,
      };
    }
  }

  return null;
}

export function createGenerationOwnershipRepository() {
  return {
    async findResource({ id }) {
      return findTrustedGenerationOwnership(id);
    },
  };
}

export async function getGenerationOwnershipRepository() {
  return createGenerationOwnershipRepository();
}

async function ensureCanonicalDefaultProject(authContext) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const userId = requireCanonicalUserId(authContext);
  const store = await getPlatformStore();
  const existing = await store.getCanonicalDefaultProjectForUser({ organizationId, userId });
  if (existing) {
    if (existing.status === 'archived') {
      return store.updateCanonicalProject(
        { projectId: existing.id, organizationId },
        { status: 'active' }
      );
    }
    return existing;
  }

  await assertAuthContextPermission(authContext, 'project.create');
  const { project } = await store.createCanonicalProject({
    organizationId,
    userId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Automatically created for generations before an explicit project is selected.',
    status: 'active',
    isDefault: true,
    metadata: { system: true, kind: 'default' },
  });
  return project;
}

async function resolveCanonicalProjectForAuth(authContext, projectId) {
  const organizationId = requireCanonicalWorkspace(authContext);
  const store = await getPlatformStore();
  if (projectId) {
    const project = await store.getCanonicalProject(projectId);
    if (!project || project.organizationId !== organizationId) {
      const err = new Error('Project not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (project.status === 'archived') {
      const err = new Error('Project is archived');
      err.status = 400;
      err.code = 'PROJECT_ARCHIVED';
      throw err;
    }
    return project;
  }
  return ensureCanonicalDefaultProject(authContext);
}

/**
 * @param {string} ownerRef
 * @param {z.infer<typeof createGenerationSchema>} input
 */
export async function createGeneration(ownerRef, input) {
  const data = createGenerationSchema.parse(input);
  const project = await resolveProjectId(ownerRef, data.projectId);
  const providerId = normalizeProviderId(data.provider || PROVIDER_MUAPI);
  if (!providerId) {
    const err = new Error('Invalid Generation provider identifier');
    err.status = 400;
    err.code = 'PROVIDER_INVALID_REQUEST';
    throw err;
  }
  const store = await getPlatformStore();
  const generation = await store.createGeneration({
    ownerRef,
    projectId: project.id,
    featureId: data.featureId ?? null,
    provider: providerId,
    model: data.model ?? null,
    prompt: data.prompt ?? null,
    parameters: data.parameters || {},
    status: data.status || 'queued',
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
  });
  registerTrustedGenerationOwnership(
    generation,
    project.organizationId ?? authContextOrganizationIdFromProject(project)
  );
  return generation;
}

function authContextOrganizationIdFromProject(project) {
  return project?.organizationId ?? null;
}

export async function getGeneration(ownerRef, id) {
  const store = await getPlatformStore();
  return store.getGeneration(ownerRef, id);
}

export async function listGenerations(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listGenerations(ownerRef, opts);
}

export async function updateGenerationStatus(ownerRef, id, status, extra = {}) {
  const store = await getPlatformStore();
  const patch = { status, ...extra };
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    patch.completedAt = new Date();
  }
  if (extra.errorMessage) {
    patch.errorMessage = sanitizeErrorMessage(extra.errorMessage);
  }
  return store.updateGeneration(ownerRef, id, patch);
}

export async function listGenerationsForRoute(routeContext, opts = {}) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return listGenerations(legacyOwnerRefFromRoute(routeContext), opts);
  }
  canonicalPersistenceBlocked();
}

export async function createGenerationForRoute(routeContext, input) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return createGeneration(legacyOwnerRefFromRoute(routeContext), input);
  }
  canonicalPersistenceBlocked();
}

export async function getGenerationForRoute(routeContext, generationId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return getGeneration(legacyOwnerRefFromRoute(routeContext), generationId);
  }

  const ownership = await findTrustedGenerationOwnership(generationId);
  if (
    !ownership ||
    ownership.organizationId !== routeContext.authContext.workspace.organizationId
  ) {
    return null;
  }

  const store = await getPlatformStore();
  if (typeof store.getCanonicalGeneration === 'function') {
    return store.getCanonicalGeneration(generationId);
  }

  const project = await store.getCanonicalProject(ownership.projectId);
  if (project?.ownerRef) {
    return getGeneration(project.ownerRef, generationId);
  }

  return null;
}

export async function resolveProjectForGenerationRoute(routeContext, projectId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return resolveProjectId(legacyOwnerRefFromRoute(routeContext), projectId);
  }
  return resolveCanonicalProjectForAuth(routeContext.authContext, projectId);
}

export const generationServiceImpl = {
  create: createGeneration,
  get: getGeneration,
  list: listGenerations,
  updateStatus: updateGenerationStatus,
  findOwnership: findTrustedGenerationOwnership,
};
