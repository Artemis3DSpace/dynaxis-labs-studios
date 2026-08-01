import { z } from 'zod';
import { blueprintPackageMetadataSchema } from './package-metadata.js';
import { templateMetadataSchema } from './template-contracts.js';

export const blueprintLibraryEntrySchema = z.object({
  blueprint: blueprintPackageMetadataSchema,
  templates: z.array(templateMetadataSchema).min(1).max(256),
});

export const blueprintLibrarySchema = z.object({
  libraryVersion: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
      'libraryVersion must be valid semantic version'
    ),
  entries: z.array(blueprintLibraryEntrySchema).max(512).default([]),
});

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateBlueprintLibrary(input) {
  const parsed = blueprintLibrarySchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
