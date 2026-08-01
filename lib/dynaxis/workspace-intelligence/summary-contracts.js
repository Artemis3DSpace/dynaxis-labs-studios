import { z } from 'zod';
import { ActivityVisibilitySchema } from './activity-contracts.js';

const isoTimestampSchema = z.string().datetime({ offset: true });

export const WORKSPACE_SUMMARY_KINDS = /** @type {const} */ (['placeholder']);

export const WorkspaceSummaryPlaceholderSchema = z.object({
  kind: z.literal('placeholder'),
  workspaceId: z.string().trim().min(1),
  windowStart: isoTimestampSchema,
  windowEnd: isoTimestampSchema,
  visibility: ActivityVisibilitySchema.default('internal'),
  summaryText: z
    .string()
    .trim()
    .min(1)
    .default('Workspace summary scaffold placeholder.'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Summary contract is intentionally placeholder-only in this phase scaffold.
 *
 * @param {unknown} input
 */
export function validateWorkspaceSummaryPlaceholder(input) {
  return WorkspaceSummaryPlaceholderSchema.parse(input);
}
