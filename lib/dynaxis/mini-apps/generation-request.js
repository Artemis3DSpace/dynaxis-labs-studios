/**
 * Dynaxis Mini App generation request contracts.
 */

import { z } from 'zod';
import { ASSET_TYPES } from '../types.js';
import { ASSET_SEMANTIC_ROLES } from './permissions.js';

export const referenceAssetSchema = z.object({
  assetId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  role: z.enum(ASSET_SEMANTIC_ROLES).default('input'),
});

export const miniAppGenerationRequestSchema = z
  .object({
    modelId: z.string().min(1).max(200),
    /** MuAPI endpoint path segment when distinct from modelId */
    endpoint: z.string().max(300).optional(),
    prompt: z.string().max(50000).optional().nullable(),
    parameters: z.record(z.string(), z.unknown()).default({}),
    referenceAssets: z.array(referenceAssetSchema).default([]),
    outputType: z.enum(ASSET_TYPES).default('image'),
    projectId: z.string().uuid().optional().nullable(),
    characterId: z.string().uuid().optional().nullable(),
    characterRevisionId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    productRevisionId: z.string().uuid().optional().nullable(),
    brandId: z.string().uuid().optional().nullable(),
    brandRevisionId: z.string().uuid().optional().nullable(),
    campaignId: z.string().uuid().optional().nullable(),
    campaignRevisionId: z.string().uuid().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    for (const ref of val.referenceAssets) {
      if (!ref.assetId && !ref.url) {
        ctx.addIssue({
          code: 'custom',
          message: 'referenceAssets entries require assetId or url',
          path: ['referenceAssets'],
        });
      }
    }
  });

/** @typedef {z.infer<typeof miniAppGenerationRequestSchema>} MiniAppGenerationRequest */

export function parseGenerationRequest(input) {
  return miniAppGenerationRequestSchema.parse(input);
}
