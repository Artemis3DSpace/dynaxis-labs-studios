import { z } from 'zod';
import {
  designSystemCompatibilityReferenceSchema,
  layoutCompatibilityReferenceSchema,
} from './compatibility.js';
import { appPackContractSchema } from './package-metadata.js';

export const TEMPLATE_CATEGORIES = Object.freeze([
  'saas',
  'ecommerce',
  'marketing',
  'internal_tool',
  'portfolio',
  'landing_page',
  'content',
  'education',
]);

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

const secretKeyPattern =
  /(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|client[-_]?secret|password|secret|credential)/i;
const secretValuePattern = /(bearer\s+[a-z0-9_\-.=:+/]+|sk-[a-z0-9]+|xox[baprs]-[a-z0-9-]+)/i;

export const requiredCapabilityReferenceSchema = z.object({
  capabilityId: z.string().trim().min(1).max(160),
  minimumLevel: z.enum(['optional', 'required', 'critical']).default('required'),
  rationale: z.string().trim().min(1).max(500),
});

export const provenanceSchema = z.object({
  source: z.enum(['manual', 'curated', 'imported', 'generated']),
  sourceId: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: z.string().trim().min(1).max(200),
});

function collectSecretViolations(value, path = []) {
  const violations = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      violations.push(...collectSecretViolations(value[i], [...path, String(i)]));
    }
    return violations;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && secretValuePattern.test(value)) {
      violations.push(path.join('.') || '<root>');
    }
    return violations;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyPath = [...path, key];
    if (secretKeyPattern.test(key)) {
      violations.push(keyPath.join('.'));
    }
    violations.push(...collectSecretViolations(child, keyPath));
  }
  return violations;
}

export function assertNoSecretLikeValues(input) {
  const violations = collectSecretViolations(input);
  if (violations.length > 0) {
    throw Object.assign(
      new Error(`template contract contains forbidden secret-like content: ${violations.join(', ')}`),
      { code: 'TEMPLATE_LIBRARY_SECRET_VALUE_FORBIDDEN', violations }
    );
  }
}

export const templateMetadataSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(2000),
    category: z.enum(TEMPLATE_CATEGORIES),
    version: z.string().trim().regex(SEMVER_PATTERN, 'version must be valid semantic version'),
    tags: z.array(z.string().trim().min(1).max(80)).max(32).default([]),
    provenance: provenanceSchema,
    requiredCapabilities: z.array(requiredCapabilityReferenceSchema).min(1).max(64),
    designSystemCompatibility: designSystemCompatibilityReferenceSchema,
    layoutCompatibility: layoutCompatibilityReferenceSchema,
    appPack: appPackContractSchema.optional().nullable(),
    customMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoSecretLikeValues(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['customMetadata'],
        message: error.message,
      });
    }
  });

export const templateValidationIssueSchema = z.object({
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
});

export const templateValidationResultSchema = z.object({
  ok: z.boolean(),
  issues: z.array(templateValidationIssueSchema),
});

function normalizeIssues(error) {
  if (!error?.issues) return [{ path: '$', message: String(error?.message || 'validation failed') }];
  return error.issues.map((issue) => ({
    path: issue.path?.length ? issue.path.join('.') : '$',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateTemplateMetadata(input) {
  const parsed = templateMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
