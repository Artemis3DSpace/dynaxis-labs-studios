import { z } from 'zod';
import { TEMPLATE_CATEGORIES } from './template-contracts.js';

const searchSecretValuePattern =
  /(bearer\s+[a-z0-9_\-.=:+/]+|sk-[a-z0-9]+|xox[baprs]-[a-z0-9-]+|api[-_]?key|client[-_]?secret)/i;

export const searchableLibraryIndexEntrySchema = z.object({
  id: z.string().trim().min(1).max(160),
  kind: z.enum(['template', 'blueprint', 'app_pack']),
  title: z.string().trim().min(1).max(200),
  category: z.enum(TEMPLATE_CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(80)).max(32).default([]),
  capabilityIds: z.array(z.string().trim().min(1).max(160)).max(64).default([]),
  version: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
      'version must be valid semantic version'
    ),
});

export const searchableLibraryIndexSchema = z.object({
  indexVersion: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
      'indexVersion must be valid semantic version'
    ),
  entries: z.array(searchableLibraryIndexEntrySchema).max(2048).default([]),
});

export const librarySearchFiltersSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    category: z.enum(TEMPLATE_CATEGORIES).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(16).optional(),
    capabilityIds: z.array(z.string().trim().min(1).max(160)).max(16).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.query && searchSecretValuePattern.test(value.query)) {
      ctx.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'query contains forbidden secret-like value',
      });
    }
    for (const [index, tag] of (value.tags || []).entries()) {
      if (searchSecretValuePattern.test(tag)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tags', index],
          message: 'tag contains forbidden secret-like value',
        });
      }
    }
  });

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateSearchFilters(input) {
  const parsed = librarySearchFiltersSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
