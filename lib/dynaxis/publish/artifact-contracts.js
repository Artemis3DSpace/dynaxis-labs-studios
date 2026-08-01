import { z } from 'zod';
import { assertNoRawSecretLikeValues } from './validation-gates.js';

export const PACKAGE_ARTIFACT_TYPES = Object.freeze([
  'app_ir',
  'template_bundle',
  'component_bundle',
  'manifest',
  'audit_report',
]);

export const ARTIFACT_MANIFEST_MODES = Object.freeze(['placeholder_only']);

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
const sha256Pattern = /^[A-Fa-f0-9]{64}$/;

export const artifactProvenanceSchema = z.object({
  source: z.enum(['manual', 'curated', 'generated', 'imported']),
  sourceId: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: z.string().trim().min(1).max(200),
});

export const packageArtifactMetadataSchema = z
  .object({
    artifactId: z.string().trim().min(1).max(200),
    artifactType: z.enum(PACKAGE_ARTIFACT_TYPES),
    packageId: z.string().trim().min(1).max(200),
    packageVersion: z.string().trim().regex(semverPattern, 'packageVersion must be semantic version'),
    checksumSha256: z.string().regex(sha256Pattern, 'checksumSha256 must be 64-char hex'),
    sizeBytes: z.number().int().nonnegative(),
    provenance: artifactProvenanceSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoRawSecretLikeValues(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: error.message,
      });
    }
  });

export const artifactManifestEntrySchema = z.object({
  stableId: z.string().trim().min(1).max(200),
  type: z.enum(PACKAGE_ARTIFACT_TYPES),
  artifactId: z.string().trim().min(1).max(200),
  provenance: artifactProvenanceSchema,
});

export const artifactManifestPlaceholderSchema = z
  .object({
    manifestId: z.string().trim().min(1).max(200),
    mode: z.enum(ARTIFACT_MANIFEST_MODES),
    entries: z.array(artifactManifestEntrySchema).min(1),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoRawSecretLikeValues(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
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

export function validatePackageArtifactMetadata(input) {
  const parsed = packageArtifactMetadataSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}

export function validateArtifactManifestPlaceholder(input) {
  const parsed = artifactManifestPlaceholderSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
