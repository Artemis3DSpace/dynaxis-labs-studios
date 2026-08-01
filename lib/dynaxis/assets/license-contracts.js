import { z } from 'zod';

export const ALLOWED_ASSET_LICENSES = Object.freeze([
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'Royalty-Free',
  'Rights-Managed',
  'Proprietary',
  'Internal-Only',
]);

export const ALLOWED_ASSET_USAGE_RIGHTS = Object.freeze([
  'commercial',
  'non_commercial',
  'editorial',
  'internal_only',
  'evaluation',
]);

export const ALLOWED_DERIVATIVE_RIGHTS = Object.freeze([
  'allowed',
  'restricted',
  'forbidden',
]);

export const licenseMetadataSchema = z.object({
  license: z.enum(ALLOWED_ASSET_LICENSES),
  usageRights: z.enum(ALLOWED_ASSET_USAGE_RIGHTS),
  derivativeRights: z.enum(ALLOWED_DERIVATIVE_RIGHTS).default('allowed'),
  attributionRequired: z.boolean().default(false),
  redistributionAllowed: z.boolean().default(false),
  termsUrl: z.string().url().optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().trim().min(1).max(2000).optional().nullable(),
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

export function validateLicenseMetadata(input) {
  const parsed = licenseMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
