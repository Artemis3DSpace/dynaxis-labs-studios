/**
 * Dynaxis Asset service — authoritative metadata catalogue for media.
 * Phase 3 stores MuAPI/CDN URLs; Dynaxis-owned object storage can plug in later.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { ASSET_SOURCES, ASSET_TYPES, inferAssetType } from '../types.js';
import { resolveProjectId } from './projects.js';

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

export const assetServiceImpl = {
  register: registerAsset,
  get: getAsset,
  list: listAssets,
  listForGeneration: listAssetsForGeneration,
};
