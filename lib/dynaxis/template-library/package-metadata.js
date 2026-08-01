import { z } from 'zod';
import { compatibilityMetadataSchema } from './compatibility.js';
import { licenseMetadataSchema } from './license-contracts.js';

export const appPackContractSchema = z.object({
  packId: z.string().trim().min(1).max(160),
  entryTemplateId: z.string().trim().min(1).max(160),
  includedTemplateIds: z.array(z.string().trim().min(1).max(160)).min(1).max(128),
  assets: z.array(z.string().trim().min(1).max(200)).max(128).default([]),
});

export const blueprintPackageMetadataSchema = z.object({
  packageId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  version: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
      'version must be valid semantic version'
    ),
  summary: z.string().trim().min(1).max(2000),
  compatibility: compatibilityMetadataSchema,
  license: licenseMetadataSchema,
  appPacks: z.array(appPackContractSchema).max(64).default([]),
});

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateBlueprintPackageMetadata(input) {
  const parsed = blueprintPackageMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
