/**
 * Dynaxis Generation History service — durable records replacing hg_* as SoT.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { GENERATION_STATUSES, PROVIDER_MUAPI } from '../types.js';
import { resolveProjectId } from './projects.js';
import { sanitizeErrorMessage } from './jobs.js';

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

/**
 * @param {string} ownerRef
 * @param {z.infer<typeof createGenerationSchema>} input
 */
export async function createGeneration(ownerRef, input) {
  const data = createGenerationSchema.parse(input);
  const project = await resolveProjectId(ownerRef, data.projectId);
  const store = await getPlatformStore();
  return store.createGeneration({
    ownerRef,
    projectId: project.id,
    featureId: data.featureId ?? null,
    provider: data.provider || PROVIDER_MUAPI,
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

export const generationServiceImpl = {
  create: createGeneration,
  get: getGeneration,
  list: listGenerations,
  updateStatus: updateGenerationStatus,
};
