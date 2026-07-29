/**
 * Dynaxis Asset service — authoritative metadata catalogue for media.
 * Phase 3 stores MuAPI/CDN URLs; Dynaxis-owned object storage can plug in later.
 *
 * Canonical AuthContext flow uses WP-7C-24 Project-scoped Asset APIs
 * (owner_ref NULL + trusted ownership lookup). Legacy owner_ref flow remains
 * for explicit route-level legacyCompatibility only.
 */

import { z } from 'zod';
import {
  AUTH_CONTEXT_ERROR_CODES,
  AuthContextError,
} from '../auth/auth-context.js';
import { getPlatformStore } from '../db/store.js';
import { ASSET_SOURCES, ASSET_TYPES, inferAssetType } from '../types.js';
import {
  isLegacyRouteCompatibility,
  legacyOwnerRefFromRoute,
  resolveProjectId,
} from './projects.js';

export const registerAssetSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  generationId: z.string().uuid().optional().nullable(),
  jobId: z.string().uuid().optional().nullable(),
  type: z.enum(ASSET_TYPES).optional(),
  source: z.enum(ASSET_SOURCES).optional(),
  provider: z.string().max(100).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
  url: z.string().url().min(1),
  thumbnailUrl: z.string().url().optional().nullable(),
  mimeType: z.string().max(200).optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  prompt: z.string().max(20000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  role: z.string().max(50).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

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

/**
 * Trusted Asset ownership repository for AuthContext resource inheritance.
 * organizationId is resolved Asset -> Project -> organization_id.
 */
export function createAssetOwnershipRepository(store) {
  return {
    async findResource({ id }) {
      return store.findAssetOwnership(id);
    },
  };
}

export async function getAssetOwnershipRepository() {
  const store = await getPlatformStore();
  return createAssetOwnershipRepository(store);
}

/**
 * @param {string} ownerRef
 * @param {z.infer<typeof registerAssetSchema>} input
 */
export async function registerAsset(ownerRef, input) {
  const data = registerAssetSchema.parse(input);
  const project = await resolveProjectId(ownerRef, data.projectId);
  const store = await getPlatformStore();
  const type = data.type || inferAssetType({ url: data.url, mimeType: data.mimeType });
  const asset = await store.createAsset({
    ownerRef,
    projectId: project.id,
    generationId: data.generationId ?? null,
    jobId: data.jobId ?? null,
    type,
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
  });
  if (data.generationId) {
    await store.linkGenerationAsset({
      generationId: data.generationId,
      assetId: asset.id,
      role: data.role || 'primary',
      sortOrder: data.sortOrder ?? 0,
    });
  }
  return asset;
}

export async function getAsset(ownerRef, id) {
  const store = await getPlatformStore();
  return store.getAsset(ownerRef, id);
}

export async function listAssets(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listAssets(ownerRef, opts);
}

export async function listAssetsForGeneration(generationId) {
  const store = await getPlatformStore();
  return store.listAssetsForGeneration(generationId);
}

/**
 * Canonical Asset create under an already-authorized Project.
 * owner_ref is always NULL via WP-7C-24 createCanonicalAsset.
 */
export async function registerCanonicalAsset(authContext, input, { projectId } = {}) {
  requireCanonicalWorkspace(authContext);
  const resolvedProjectId = String(projectId || input?.projectId || '').trim();
  if (!resolvedProjectId) {
    const err = new Error('projectId is required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const data = registerAssetSchema.parse({ ...input, projectId: resolvedProjectId });
  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(resolvedProjectId);
  if (!project || project.organizationId !== authContext.workspace.organizationId) {
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

  const type = data.type || inferAssetType({ url: data.url, mimeType: data.mimeType });
  const asset = await store.createCanonicalAsset({
    projectId: resolvedProjectId,
    generationId: data.generationId ?? null,
    jobId: data.jobId ?? null,
    type,
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
  });
  if (data.generationId) {
    await store.linkGenerationAsset({
      generationId: data.generationId,
      assetId: asset.id,
      role: data.role || 'primary',
      sortOrder: data.sortOrder ?? 0,
    });
  }
  return asset;
}

export async function listCanonicalAssetsForAuthorizedProject(authContext, opts = {}) {
  requireCanonicalWorkspace(authContext);
  const projectId = String(opts.projectId || '').trim();
  if (!projectId) {
    const err = new Error('projectId is required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(projectId);
  if (!project || project.organizationId !== authContext.workspace.organizationId) {
    const err = new Error('Project not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return store.listCanonicalAssetsForProject({
    projectId,
    generationId: opts.generationId || undefined,
    limit: opts.limit,
  });
}

export async function getCanonicalAssetForAuthContext(authContext, assetId) {
  requireCanonicalWorkspace(authContext);
  const store = await getPlatformStore();
  const ownership = await store.findAssetOwnership(assetId);
  if (!ownership || ownership.organizationId !== authContext.workspace.organizationId) {
    return null;
  }
  return store.getCanonicalAsset(assetId);
}

export async function findTrustedAssetOwnership(assetId) {
  const store = await getPlatformStore();
  return store.findAssetOwnership(assetId);
}

export async function listAssetsForRoute(routeContext, opts = {}) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return listAssets(legacyOwnerRefFromRoute(routeContext), opts);
  }
  return listCanonicalAssetsForAuthorizedProject(routeContext.authContext, opts);
}

export async function registerAssetForRoute(routeContext, input, { projectId } = {}) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return registerAsset(legacyOwnerRefFromRoute(routeContext), input);
  }
  return registerCanonicalAsset(routeContext.authContext, input, { projectId });
}

export async function getAssetForRoute(routeContext, assetId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return getAsset(legacyOwnerRefFromRoute(routeContext), assetId);
  }
  return getCanonicalAssetForAuthContext(routeContext.authContext, assetId);
}

export const assetServiceImpl = {
  register: registerAsset,
  get: getAsset,
  list: listAssets,
  listForGeneration: listAssetsForGeneration,
  registerCanonical: registerCanonicalAsset,
  listCanonical: listCanonicalAssetsForAuthorizedProject,
  getCanonical: getCanonicalAssetForAuthContext,
  findOwnership: findTrustedAssetOwnership,
};
