import { z } from 'zod';
import { licenseMetadataSchema } from './license-contracts.js';
import { mediaMetadataSchema, MEDIA_TYPE_CATEGORIES } from './media-metadata.js';
import {
  assetValidationResultSchema,
  provenanceMetadataSchema,
  usageMetadataSchema,
} from './usage-contracts.js';

export const ASSET_KINDS = Object.freeze(MEDIA_TYPE_CATEGORIES);

const SECRET_LIKE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /provider[_-]?connection/i,
  /begin\s+private\s+key/i,
  /sk-[a-z0-9]/i,
  /xox[baprs]-/i,
  /bearer\s+[a-z0-9_\-.=:+/]+/i,
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function valueLooksSecretLike(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

function collectSecretLikePaths(value, path = []) {
  const violations = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      violations.push(...collectSecretLikePaths(value[i], [...path, String(i)]));
    }
    return violations;
  }
  if (!isPlainObject(value)) {
    if (valueLooksSecretLike(value)) {
      violations.push(path.join('.') || '$');
    }
    return violations;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (valueLooksSecretLike(key)) {
      violations.push(nextPath.join('.'));
    }
    violations.push(...collectSecretLikePaths(child, nextPath));
  }
  return violations;
}

export function assertNoSecretLikeValues(value) {
  const violations = collectSecretLikePaths(value);
  if (violations.length > 0) {
    const err = new Error(`secret-like fields are forbidden: ${violations.join(', ')}`);
    err.code = 'ASSET_SECRET_LIKE_VALUE_FORBIDDEN';
    err.violations = violations;
    throw err;
  }
}

export function toPublicAssetProjection(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => toPublicAssetProjection(entry));
  }
  if (!isPlainObject(value)) {
    return valueLooksSecretLike(value) ? '[REDACTED]' : value;
  }
  const projected = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('_')) {
      continue;
    }
    if (valueLooksSecretLike(key)) {
      projected[key] = '[REDACTED]';
      continue;
    }
    projected[key] = toPublicAssetProjection(child);
  }
  return projected;
}

const assetIdSchema = z.string().trim().min(1).max(160);

export const assetContractSchema = z
  .object({
    id: assetIdSchema,
    kind: z.enum(ASSET_KINDS),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(80)).max(128).default([]),
    media: mediaMetadataSchema,
    provenance: provenanceMetadataSchema,
    usage: usageMetadataSchema,
    license: licenseMetadataSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((asset, ctx) => {
    try {
      assertNoSecretLikeValues(asset);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metadata'],
        message: error.message,
      });
    }
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

export function validateAssetContract(input) {
  const parsed = assetContractSchema.safeParse(input);
  const result = parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
  assetValidationResultSchema.parse(result);
  return result;
}
