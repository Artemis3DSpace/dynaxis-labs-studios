/**
 * Generation Gateway contract/service.
 *
 * Phase 7B boundary only: this resolves providers and invokes adapters when a
 * caller explicitly asks it to. It is not the Phase 7E durable queue/worker
 * execution engine.
 */

import { z } from 'zod';
import { normalizeProviderId, PROVIDER_MUAPI } from '../types.js';
import { normalizeGenerationCapability } from '../providers/capabilities.js';
import { extractOutputUrls, isHttpOutputUrl, safeProviderPayload } from '../providers/common.js';
import { DynaxisProviderError } from '../providers/errors.js';
import { getProductionProviderRegistry } from '../providers/index.js';

const uuid = z.string().uuid();

const domainProvenanceSchema = z
  .object({
    characterId: uuid.optional().nullable(),
    characterRevisionId: uuid.optional().nullable(),
    productId: uuid.optional().nullable(),
    productRevisionId: uuid.optional().nullable(),
    brandId: uuid.optional().nullable(),
    brandRevisionId: uuid.optional().nullable(),
    campaignId: uuid.optional().nullable(),
    campaignRevisionId: uuid.optional().nullable(),
  })
  .default({});

export const generationGatewayRequestSchema = z.object({
  projectId: uuid.optional().nullable(),
  featureId: z.string().max(100).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  capability: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => normalizeGenerationCapability(v)),
  provider: z.string().max(100).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
  prompt: z.string().max(50000).optional().nullable(),
  endpoint: z.string().max(300).optional().nullable(),
  operation: z.string().max(120).optional().nullable(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  inputAssets: z
    .array(
      z.object({
        assetId: uuid,
        role: z.string().max(100).optional().nullable(),
      })
    )
    .default([]),
  provenance: domainProvenanceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const generationGatewayResultSchema = z.object({
  provider: z.string().min(1),
  providerJobId: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  outputs: z.array(z.string().url()).default([]),
  primaryUrl: z.string().url().optional().nullable(),
  raw: z.record(z.string(), z.unknown()).default({}),
});

/**
 * @param {unknown} input
 */
export function parseGenerationGatewayRequest(input) {
  const parsed = generationGatewayRequestSchema.parse(input);
  const providerId = normalizeProviderId(parsed.provider || PROVIDER_MUAPI);
  if (!providerId) {
    throw new DynaxisProviderError('Invalid generation provider identifier', {
      code: 'PROVIDER_INVALID_REQUEST',
      providerId: String(parsed.provider || ''),
      operation: 'gateway.validate',
      retryable: false,
    });
  }
  return Object.freeze({
    ...parsed,
    provider: providerId,
    parameters: Object.freeze(safeProviderPayload(parsed.parameters || {})),
    metadata: Object.freeze(safeProviderPayload(parsed.metadata || {})),
    provenance: Object.freeze({ ...(parsed.provenance || {}) }),
    inputAssets: Object.freeze([...(parsed.inputAssets || [])]),
  });
}

/**
 * @param {unknown} input
 */
export function parseGenerationGatewayResult(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const outputs = extractOutputUrls(safe);
  return generationGatewayResultSchema.parse({
    provider: normalizeProviderId(safe.provider) || PROVIDER_MUAPI,
    providerJobId: safe.providerJobId == null ? null : String(safe.providerJobId),
    status: safe.status == null ? null : String(safe.status),
    outputs,
    primaryUrl: isHttpOutputUrl(safe.primaryUrl) ? safe.primaryUrl : outputs[0] || null,
    raw: safeProviderPayload(safe.raw || safe),
  });
}

export class GenerationGateway {
  /**
   * @param {{ providerRegistry?: import('../providers/registry.js').ProviderRegistry }} [opts]
   */
  constructor(opts = {}) {
    this.providerRegistry = opts.providerRegistry || getProductionProviderRegistry();
  }

  /**
   * @param {unknown} input
   */
  prepareRequest(input) {
    const request = parseGenerationGatewayRequest(input);
    const provider = this.providerRegistry.require(request.provider);
    return { request, provider };
  }

  /**
   * Submit directly through a provider adapter. This is an invocation primitive,
   * not durable queue execution.
   * @param {unknown} input
   * @param {unknown} providerInput
   */
  async submit(input, providerInput = {}) {
    const { request, provider } = this.prepareRequest(input);
    const result = await provider.submit({
      ...providerInput,
      endpoint: providerInput.endpoint || request.endpoint || request.operation,
      payload: providerInput.payload || request.parameters || {},
      request,
    });
    return parseGenerationGatewayResult(result);
  }

  /**
   * @param {{ provider: string, providerJobId: string }} input
   * @param {unknown} providerInput
   */
  async retrieve(input, providerInput = {}) {
    const providerId = normalizeProviderId(input?.provider || PROVIDER_MUAPI);
    const provider = this.providerRegistry.require(providerId);
    const result = await provider.retrieve({
      ...providerInput,
      providerJobId: input.providerJobId,
    });
    return parseGenerationGatewayResult(result);
  }

  /**
   * @param {{ provider: string, providerJobId: string }} input
   * @param {unknown} providerInput
   */
  async cancel(input, providerInput = {}) {
    const providerId = normalizeProviderId(input?.provider || PROVIDER_MUAPI);
    const provider = this.providerRegistry.require(providerId);
    return provider.cancel({
      ...providerInput,
      providerJobId: input.providerJobId,
    });
  }
}

export function createGenerationGateway(opts = {}) {
  return new GenerationGateway(opts);
}

export const generationGatewayServiceImpl = {
  create: createGenerationGateway,
  parseRequest: parseGenerationGatewayRequest,
  parseResult: parseGenerationGatewayResult,
};
