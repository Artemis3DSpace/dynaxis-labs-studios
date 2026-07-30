/**
 * Dynaxis generation lifecycle orchestration.
 *
 * Studio (client submitAndPoll)
 *   → lifecycle.start / provider-id / complete / fail APIs
 *   → Generation + Job + Asset persistence
 *   → Provider kernel validates provider identity; current Studio execution path remains client submit/poll.
 */

import { z } from 'zod';
import {
  createGeneration,
  updateGenerationStatus,
  getGeneration,
  isLegacyRouteCompatibility,
  legacyOwnerRefFromRoute,
  registerTrustedGenerationOwnership,
  resolveProjectForGenerationRoute,
  findTrustedGenerationOwnership,
  canonicalPersistenceBlocked,
} from './generations.js';
import {
  createJob,
  updateJob,
  markJobSucceeded,
  markJobFailed,
  getJob,
  registerTrustedJobOwnership,
  findTrustedJobOwnership,
} from './jobs.js';
import { registerAsset } from './assets.js';
import { resolveProjectId } from './projects.js';
import { extractOutputUrls, isHttpOutputUrl, safeProviderPayload } from '../providers/common.js';
import { getProductionProviderRegistry } from '../providers/index.js';
import { DynaxisProviderError } from '../providers/errors.js';
import { inferAssetType, normalizeProviderId, PROVIDER_MUAPI } from '../types.js';
import { getPlatformStore } from '../db/store.js';

export const lifecycleStartSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  featureId: z.string().max(100).optional().nullable(),
  provider: z.string().max(100).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
  prompt: z.string().max(50000).optional().nullable(),
  endpoint: z.string().max(300).optional().nullable(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  assetHint: z.enum(['image', 'video', 'audio', 'other']).optional().nullable(),
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

function ownerRefFromRouteContext(routeContext) {
  return legacyOwnerRefFromRoute(routeContext);
}

async function resolveLifecycleOwnerRef(routeContext, generationId, jobId) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return ownerRefFromRouteContext(routeContext);
  }

  const jobOwnership = await findTrustedJobOwnership(jobId);
  const generationOwnership = await findTrustedGenerationOwnership(generationId);
  const projectId = jobOwnership?.projectId || generationOwnership?.projectId;
  if (!projectId) {
    const err = new Error('Generation or job not found');
    err.status = 404;
    err.code = 'GENERATION_JOB_NOT_FOUND';
    throw err;
  }

  const store = await getPlatformStore();
  const project = await store.getCanonicalProject(projectId);
  if (project?.ownerRef) {
    return project.ownerRef;
  }

  canonicalPersistenceBlocked();
}

function organizationIdFromProject(project) {
  return project?.organizationId ?? null;
}

/**
 * Create Generation + Job before provider submit.
 * @param {string} ownerRef
 * @param {z.infer<typeof lifecycleStartSchema>} input
 * @param {{ providerRegistry?: import('../providers/registry.js').ProviderRegistry, organizationId?: string | null }} [opts]
 */
export async function startLifecycle(ownerRef, input, opts = {}) {
  const data = lifecycleStartSchema.parse(input);
  const providerRegistry = opts.providerRegistry || getProductionProviderRegistry();
  const providerId = normalizeProviderId(data.provider || PROVIDER_MUAPI);
  if (!providerId) {
    throw new DynaxisProviderError('Invalid lifecycle provider identifier', {
      code: 'PROVIDER_INVALID_REQUEST',
      providerId: String(data.provider || ''),
      operation: 'lifecycle.start',
      retryable: false,
    });
  }
  providerRegistry.require(providerId);
  const project = await resolveProjectId(ownerRef, data.projectId);
  const organizationId = opts.organizationId ?? organizationIdFromProject(project);
  const generation = await createGeneration(ownerRef, {
    projectId: project.id,
    featureId: data.featureId,
    provider: providerId,
    model: data.model,
    prompt: data.prompt,
    parameters: {
      ...(data.parameters || {}),
      ...(data.endpoint ? { endpoint: data.endpoint } : {}),
    },
    status: 'queued',
    characterId: data.characterId ?? null,
    characterRevisionId: data.characterRevisionId ?? null,
    productId: data.productId ?? null,
    productRevisionId: data.productRevisionId ?? null,
    brandId: data.brandId ?? null,
    brandRevisionId: data.brandRevisionId ?? null,
    campaignId: data.campaignId ?? null,
    campaignRevisionId: data.campaignRevisionId ?? null,
    metadata: {
      ...(data.metadata || {}),
      ...(data.assetHint ? { assetHint: data.assetHint } : {}),
      ...(data.characterId ? { characterId: data.characterId } : {}),
      ...(data.characterRevisionId
        ? { characterRevisionId: data.characterRevisionId }
        : {}),
      ...(data.productId ? { productId: data.productId } : {}),
      ...(data.productRevisionId
        ? { productRevisionId: data.productRevisionId }
        : {}),
      ...(data.brandId ? { brandId: data.brandId } : {}),
      ...(data.brandRevisionId ? { brandRevisionId: data.brandRevisionId } : {}),
      ...(data.campaignId ? { campaignId: data.campaignId } : {}),
      ...(data.campaignRevisionId
        ? { campaignRevisionId: data.campaignRevisionId }
        : {}),
    },
  });
  registerTrustedGenerationOwnership(generation, organizationId);
  const job = await createJob(ownerRef, {
    projectId: project.id,
    generationId: generation.id,
    provider: providerId,
    status: 'queued',
    providerMetadata: data.endpoint ? { endpoint: data.endpoint } : {},
  });
  registerTrustedJobOwnership(job, organizationId);
  const store = await getPlatformStore();
  await store.updateGeneration(ownerRef, generation.id, {
    primaryJobId: job.id,
    status: 'submitted',
  });
  await updateJob(ownerRef, job.id, { status: 'submitted' });
  return {
    project,
    generation: await getGeneration(ownerRef, generation.id),
    job: await getJob(ownerRef, job.id),
  };
}

export async function startLifecycleForRoute(routeContext, input, opts = {}) {
  if (isLegacyRouteCompatibility(routeContext)) {
    return startLifecycle(ownerRefFromRouteContext(routeContext), input, opts);
  }
  await resolveProjectForGenerationRoute(routeContext, input?.projectId);
  canonicalPersistenceBlocked();
}

/**
 * @param {string} ownerRef
 * @param {string} generationId
 * @param {string} jobId
 */
export async function requireLifecyclePair(ownerRef, generationId, jobId) {
  const generation = await getGeneration(ownerRef, generationId);
  const job = await getJob(ownerRef, jobId);
  if (!generation || !job) {
    const err = new Error('Generation or job not found');
    err.status = 404;
    err.code = 'GENERATION_JOB_NOT_FOUND';
    throw err;
  }
  const fail = (message, code = 'LIFECYCLE_INVARIANT_FAILED') => {
    const err = new Error(message);
    err.status = 409;
    err.code = code;
    throw err;
  };
  if (job.generationId !== generation.id) {
    fail('Job does not belong to Generation', 'JOB_GENERATION_MISMATCH');
  }
  if (job.projectId !== generation.projectId) {
    fail('Job and Generation belong to different Projects', 'JOB_PROJECT_MISMATCH');
  }
  if (job.provider !== generation.provider) {
    fail('Job and Generation use different providers', 'JOB_PROVIDER_MISMATCH');
  }
  return { generation, job };
}

export const providerIdSchema = z.object({
  generationId: z.string().uuid(),
  jobId: z.string().uuid(),
  providerJobId: z.string().min(1).max(200),
});

/**
 * Persist the external provider job identifier after submit.
 */
export async function attachProviderJobId(ownerRef, input) {
  const data = providerIdSchema.parse(input);
  const { generation } = await requireLifecyclePair(ownerRef, data.generationId, data.jobId);
  const updatedJob = await updateJob(ownerRef, data.jobId, {
    providerJobId: data.providerJobId,
    status: 'processing',
    lastPolledAt: new Date(),
  });
  await updateGenerationStatus(ownerRef, data.generationId, 'processing');
  return { generation, job: updatedJob };
}

export async function attachProviderJobIdForRoute(routeContext, input) {
  const data = providerIdSchema.parse(input);
  const ownerRef = await resolveLifecycleOwnerRef(routeContext, data.generationId, data.jobId);
  return attachProviderJobId(ownerRef, input);
}

export const completeSchema = z.object({
  generationId: z.string().uuid(),
  jobId: z.string().uuid(),
  result: z.record(z.string(), z.unknown()).optional(),
  urls: z.array(z.string().url()).optional(),
  providerJobId: z.string().optional().nullable(),
});

/**
 * Mark success and register one or more assets.
 */
export async function completeLifecycle(ownerRef, input) {
  const data = completeSchema.parse(input);
  const { generation, job } = await requireLifecyclePair(ownerRef, data.generationId, data.jobId);

  const urls =
    (data.urls && data.urls.length > 0
      ? data.urls
      : extractOutputUrls(data.result || {}))?.filter(isHttpOutputUrl) || [];

  if (data.providerJobId) {
    await updateJob(ownerRef, data.jobId, { providerJobId: data.providerJobId });
  }

  const assetHint = generation.metadata?.assetHint || null;
  const assets = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const asset = await registerAsset(ownerRef, {
      projectId: generation.projectId,
      generationId: generation.id,
      jobId: job.id,
      type: inferAssetType({ url, hint: assetHint || undefined }),
      source: 'generated',
      provider: generation.provider,
      model: generation.model,
      url,
      prompt: generation.prompt,
      role: i === 0 ? 'primary' : 'variant',
      sortOrder: i,
      metadata: { fromLifecycle: true },
    });
    assets.push(asset);
  }

  const updatedJob = await markJobSucceeded(ownerRef, data.jobId, {
    providerMetadata: {
      ...(job.providerMetadata || {}),
      result: safeProviderPayload(data.result || {}),
      outputCount: urls.length,
    },
  });
  const updatedGeneration = await updateGenerationStatus(ownerRef, data.generationId, 'succeeded');

  return {
    generation: updatedGeneration,
    job: updatedJob,
    assets,
  };
}

export async function completeLifecycleForRoute(routeContext, input) {
  const data = completeSchema.parse(input);
  const ownerRef = await resolveLifecycleOwnerRef(routeContext, data.generationId, data.jobId);
  return completeLifecycle(ownerRef, input);
}

export const failSchema = z.object({
  generationId: z.string().uuid(),
  jobId: z.string().uuid(),
  errorCode: z.string().max(100).optional().nullable(),
  errorMessage: z.string().max(1000).optional().nullable(),
  providerJobId: z.string().optional().nullable(),
});

export async function failLifecycle(ownerRef, input) {
  const data = failSchema.parse(input);
  const { generation } = await requireLifecyclePair(ownerRef, data.generationId, data.jobId);
  if (data.providerJobId) {
    await updateJob(ownerRef, data.jobId, { providerJobId: data.providerJobId });
  }
  const updatedJob = await markJobFailed(ownerRef, data.jobId, {
    errorCode: data.errorCode || 'GENERATION_FAILED',
    errorMessage: data.errorMessage,
  });
  const updatedGeneration = await updateGenerationStatus(ownerRef, data.generationId, 'failed', {
    errorCode: data.errorCode || 'GENERATION_FAILED',
    errorMessage: data.errorMessage,
  });
  return { generation: updatedGeneration, job: updatedJob };
}

export async function failLifecycleForRoute(routeContext, input) {
  const data = failSchema.parse(input);
  const ownerRef = await resolveLifecycleOwnerRef(routeContext, data.generationId, data.jobId);
  return failLifecycle(ownerRef, input);
}
