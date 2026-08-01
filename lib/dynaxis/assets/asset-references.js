import { z } from 'zod';
import { ASSET_USAGE_CONTEXTS } from './usage-contracts.js';

export const assetIdSchema = z.string().trim().min(1).max(160);
export const assetUsageContextSchema = z.enum(ASSET_USAGE_CONTEXTS);

export const assetUsageReferenceSchema = z.object({
  assetId: assetIdSchema,
  usageContext: assetUsageContextSchema,
  consumerId: z.string().trim().min(1).max(200),
  slot: z.string().trim().min(1).max(120).optional().nullable(),
  revision: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().min(1).max(1000).optional().nullable(),
});

function normalizeIssues(error) {
  if (!error?.issues) {
    return [{ path: '$', message: String(error?.message || 'validation failed') }];
  }
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateAssetUsageReference(input) {
  const parsed = assetUsageReferenceSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
