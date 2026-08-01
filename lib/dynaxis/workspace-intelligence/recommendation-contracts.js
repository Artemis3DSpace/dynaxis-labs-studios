import { z } from 'zod';
import { ActivityVisibilitySchema } from './activity-contracts.js';

export const RECOMMENDATION_KINDS = /** @type {const} */ (['placeholder']);

export const RecommendationPlaceholderSchema = z.object({
  kind: z.literal('placeholder'),
  workspaceId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  visibility: ActivityVisibilitySchema.default('internal'),
  rationale: z.string().trim().min(1).default('Recommendation scaffold placeholder.'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/**
 * @param {unknown} input
 */
export function validateRecommendationPlaceholder(input) {
  return RecommendationPlaceholderSchema.parse(input);
}
