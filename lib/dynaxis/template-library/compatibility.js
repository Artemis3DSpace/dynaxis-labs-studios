import { z } from 'zod';

export const DESIGN_SYSTEM_COMPATIBILITY_LEVELS = Object.freeze([
  'agnostic',
  'token_compatible',
  'strict',
]);

export const LAYOUT_COMPATIBILITY_MODES = Object.freeze([
  'auto_layout_v1',
  'responsive_constraints_v1',
  'fixed_grid_v1',
]);

export const designSystemCompatibilityReferenceSchema = z.object({
  designSystemId: z.string().trim().min(1).max(160),
  compatibilityLevel: z.enum(DESIGN_SYSTEM_COMPATIBILITY_LEVELS),
  minimumDesignSystemVersion: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
      'minimumDesignSystemVersion must be semantic version'
    ),
  requiredTokens: z.array(z.string().trim().min(1).max(120)).max(128).default([]),
});

export const layoutCompatibilityReferenceSchema = z.object({
  layoutModel: z.enum(LAYOUT_COMPATIBILITY_MODES),
  supportedBreakpoints: z
    .array(z.enum(['mobile', 'tablet', 'desktop', 'wide']))
    .min(1)
    .max(4),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const compatibilityMetadataSchema = z.object({
  designSystem: designSystemCompatibilityReferenceSchema,
  layout: layoutCompatibilityReferenceSchema,
});

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateCompatibilityMetadata(input) {
  const parsed = compatibilityMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
