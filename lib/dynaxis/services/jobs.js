/**
 * Dynaxis Job service — persistent generation lifecycle metadata.
 *
 * Route migration (WP-7C-15) adds AuthContext-aware helpers while preserving
 * legacy owner_ref persistence for explicit route-level legacyCompatibility.
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { JOB_STATUSES, normalizeProviderId, PROVIDER_MUAPI } from '../types.js';
import {
  isLegacyRouteCompatibility,
  legacyOwnerRefFromRoute,
} from './generations.js';

export const createJobSchema = z.object({
  projectId: z.string().uuid(),
  generationId: z.string().uuid(),
  provider: z.string().default(PROVIDER_MUAPI),
  providerJobId: z.string().optional().nullable(),
  status: z.enum(JOB_STATUSES).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

/** @typedef {{ type: 'job', id: string, projectId: string, organizationId: string | null }} JobOwnership */

/** @type {Map<string, JobOwnership>} */
const trustedJobOwnership = new Map();

export function registerTrustedJobOwnership(job, organizationId = null) {
  if (!job?.id || !job?.projectId) {
    return;
  }
  trustedJobOwnership.set(job.id, {
    type: 'job',
    id: job.id,
    projectId: job.projectId,
    organizationId: organizationId ?? null,
  });
}

export function clearTrustedJobOwnership(jobId) {
  trustedJobOwnership.delete(jobId);
}

/**
 * Trusted Job ownership lookup for AuthContext resource inheritance.
 */
export async function findTrustedJobOwnership(jobId) {
  const cached = trustedJobOwnership.get(jobId);
  if (cached) {
    return cached;
  }

  const store = await getPlatformStore();
  if (typeof store.findJobOwnership === 'function') {
    return store.findJobOwnership(jobId);
  }

  return null;
}

export function createJobOwnershipRepository() {
  return {
    async findResource({ id }) {
      return findTrustedJobOwnership(id);
    },
  };
}

export async function getJobOwnershipRepository() {
  return createJobOwnershipRepository();
}

/**
 * @param {string} ownerRef
 * @param {z.infer<typeof createJobSchema>} input
 */
export async function createJob(ownerRef, input) {
  const data = createJobSchema.parse(input);
  const providerId = normalizeProviderId(data.provider || PROVIDER_MUAPI);
  if (!providerId) {
    const err = new Error('Invalid Job provider identifier');
    err.status = 400;
    err.code = 'PROVIDER_INVALID_REQUEST';
    throw err;
  }
  const store = await getPlatformStore();
  const job = await store.createJob({
    ownerRef,
    projectId: data.projectId,
    generationId: data.generationId,
    provider: providerId,
    providerJobId: data.providerJobId ?? null,
    status: data.status || 'queued',
    submittedAt: new Date(),
    providerMetadata: data.providerMetadata || {},
  });
  registerTrustedJobOwnership(job, null);
  return job;
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

export async function getJobForRoute(routeContext, jobId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return getJob(legacyOwnerRefFromRoute(routeContext), jobId);
  }

  const ownership = await findTrustedJobOwnership(jobId);
  if (
    !ownership ||
    ownership.organizationId !== routeContext.authContext.workspace.organizationId
  ) {
    return null;
  }

  const store = await getPlatformStore();
  if (typeof store.getCanonicalJob === 'function') {
    return store.getCanonicalJob(jobId);
  }

  const project = await store.getCanonicalProject(ownership.projectId);
  if (project?.ownerRef) {
    return getJob(project.ownerRef, jobId);
  }

  return null;
}

export const jobServiceImpl = {
  create: createJob,
  get: getJob,
  update: updateJob,
  markSucceeded: markJobSucceeded,
  markFailed: markJobFailed,
  findOwnership: findTrustedJobOwnership,
};
