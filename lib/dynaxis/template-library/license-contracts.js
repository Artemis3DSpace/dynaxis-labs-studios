import { z } from 'zod';

export const ALLOWED_TEMPLATE_LICENSES = Object.freeze([
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'Proprietary',
  'Internal-Only',
]);

export const ALLOWED_USAGE_MODES = Object.freeze([
  'commercial',
  'non_commercial',
  'internal_only',
  'evaluation',
]);

export const licenseMetadataSchema = z.object({
  license: z.enum(ALLOWED_TEMPLATE_LICENSES),
  usage: z.enum(ALLOWED_USAGE_MODES),
  attributionRequired: z.boolean().default(false),
  redistributionAllowed: z.boolean().default(false),
  termsUrl: z.string().url().optional().nullable(),
});

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
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
