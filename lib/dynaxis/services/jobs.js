/**
 * Dynaxis Job service — persistent generation lifecycle metadata.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { JOB_STATUSES, PROVIDER_MUAPI } from '../types.js';

export const createJobSchema = z.object({
  projectId: z.string().uuid(),
  generationId: z.string().uuid(),
  provider: z.string().default(PROVIDER_MUAPI),
  providerJobId: z.string().optional().nullable(),
  status: z.enum(JOB_STATUSES).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * @param {string} ownerRef
 * @param {z.infer<typeof createJobSchema>} input
 */
export async function createJob(ownerRef, input) {
  const data = createJobSchema.parse(input);
  const store = await getPlatformStore();
  return store.createJob({
    ownerRef,
    projectId: data.projectId,
    generationId: data.generationId,
    provider: data.provider,
    providerJobId: data.providerJobId ?? null,
    status: data.status || 'queued',
    submittedAt: new Date(),
    providerMetadata: data.providerMetadata || {},
  });
}

export async function getJob(ownerRef, id) {
  const store = await getPlatformStore();
  return store.getJob(ownerRef, id);
}

/**
 * @param {string} ownerRef
 * @param {string} id
 * @param {{
 *   status?: import('../types.js').JobStatus,
 *   providerJobId?: string|null,
 *   progress?: number|null,
 *   attemptCount?: number,
 *   errorCode?: string|null,
 *   errorMessage?: string|null,
 *   providerMetadata?: object,
 *   lastPolledAt?: Date|null,
 * }} patch
 */
export async function updateJob(ownerRef, id, patch) {
  const store = await getPlatformStore();
  const existing = await store.getJob(ownerRef, id);
  if (!existing) return null;

  const next = { ...patch };
  const status = patch.status;
  if (status === 'processing' && !existing.startedAt) {
    next.startedAt = new Date();
  }
  if (status === 'succeeded') {
    next.completedAt = new Date();
    next.failedAt = null;
  }
  if (status === 'failed') {
    next.failedAt = new Date();
  }
  if (status === 'submitted' && !existing.submittedAt) {
    next.submittedAt = new Date();
  }
  return store.updateJob(ownerRef, id, next);
}

export async function markJobSucceeded(ownerRef, id, { providerMetadata } = {}) {
  return updateJob(ownerRef, id, {
    status: 'succeeded',
    ...(providerMetadata ? { providerMetadata } : {}),
  });
}

export async function markJobFailed(ownerRef, id, { errorCode, errorMessage, providerMetadata } = {}) {
  return updateJob(ownerRef, id, {
    status: 'failed',
    errorCode: errorCode || 'GENERATION_FAILED',
    errorMessage: sanitizeErrorMessage(errorMessage),
    ...(providerMetadata ? { providerMetadata } : {}),
  });
}

/**
 * User-safe error message — strip secrets / long provider dumps.
 * @param {unknown} message
 */
export function sanitizeErrorMessage(message) {
  const raw = String(message || 'Generation failed');
  return raw
    .replace(/x-api-key[:\s]*[^\s,;]+/gi, 'x-api-key:[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .slice(0, 500);
}

export const jobServiceImpl = {
  create: createJob,
  get: getJob,
  update: updateJob,
  markSucceeded: markJobSucceeded,
  markFailed: markJobFailed,
};
