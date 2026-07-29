/**
 * Dynaxis Asset service — authoritative metadata catalogue for media.
 * Phase 3 stores MuAPI/CDN URLs; Dynaxis-owned object storage can plug in later.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { ASSET_SOURCES, ASSET_TYPES, inferAssetType } from '../types.js';
import {
  getProjectForAuthContext,
  listProjectsForAuthContext,
  resolveProjectForAuthContext,
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

function textOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function legacyOwnerRefFromAuthContext(authContext) {
  return (
    textOrNull(authContext?.compatibility?.ownerRef) ||
    textOrNull(authContext?.subject?.legacyOwnerRef)
  );
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

export async function registerAssetForAuthContext(authContext, input) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return registerAsset(legacyOwnerRef, input);
  }
  const data = registerAssetSchema.parse(input);
  const project = await resolveProjectForAuthContext(authContext, data.projectId);
  const store = await getPlatformStore();
  const type = data.type || inferAssetType({ url: data.url, mimeType: data.mimeType });
  const asset = await store.createCanonicalAsset({
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

export async function getAssetForAuthContext(authContext, id) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return getAsset(legacyOwnerRef, id);
  }
  const ownership = await findAssetOwnershipResource(id);
  if (!ownership?.projectId) {
    return null;
  }
  const project = await getProjectForAuthContext(authContext, ownership.projectId);
  if (!project) {
    return null;
  }
  const store = await getPlatformStore();
  return store.getCanonicalAsset(id);
}

export async function listAssets(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listAssets(ownerRef, opts);
}

export async function listAssetsForAuthContext(authContext, opts = {}) {
  const legacyOwnerRef = legacyOwnerRefFromAuthContext(authContext);
  if (legacyOwnerRef) {
    return listAssets(legacyOwnerRef, opts);
  }
  const store = await getPlatformStore();
  const limit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 50;
  const normalizedLimit = Math.max(1, Math.min(limit, 200));
  const projectId = textOrNull(opts.projectId);
  const generationId = textOrNull(opts.generationId);
  if (projectId) {
    const project = await getProjectForAuthContext(authContext, projectId);
    if (!project) {
      return [];
    }
    return store.listCanonicalAssetsForProject({ projectId, generationId, limit: normalizedLimit });
  }

  const projects = await listProjectsForAuthContext(authContext, {
    includeArchived: true,
    ensureDefault: false,
  });
  const assetLists = await Promise.all(
    projects.map((project) =>
      store.listCanonicalAssetsForProject({
        projectId: project.id,
        generationId,
        limit: normalizedLimit,
      })
    )
  );
  return assetLists
    .flat()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, normalizedLimit);
}

export async function findAssetOwnershipResource(assetId) {
  const store = await getPlatformStore();
  const ownership = await store.findAssetOwnership(assetId);
  if (!ownership) {
    return null;
  }
  return {
    type: 'asset',
    id: ownership.id,
    projectId: ownership.projectId,
    organizationId: ownership.organizationId,
  };
}

export async function listAssetsForGeneration(generationId) {
  const store = await getPlatformStore();
  return store.listAssetsForGeneration(generationId);
}

export const assetServiceImpl = {
  register: registerAsset,
  registerForAuthContext: registerAssetForAuthContext,
  get: getAsset,
  getForAuthContext: getAssetForAuthContext,
  list: listAssets,
  listForAuthContext: listAssetsForAuthContext,
  listForGeneration: listAssetsForGeneration,
  findOwnership: findAssetOwnershipResource,
};
