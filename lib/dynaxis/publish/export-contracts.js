import { z } from 'zod';
import { assertNoRawSecretLikeValues } from './validation-gates.js';

export const EXPORT_FORMAT_CATEGORIES = Object.freeze([
  'app_ir_bundle',
  'template_bundle',
  'component_bundle',
  'artifact_manifest',
  'compliance_snapshot',
]);

export const EXPORT_REQUEST_MODES = Object.freeze(['contract_only']);

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

export const exportProvenanceSchema = z.object({
  source: z.enum(['manual', 'curated', 'generated', 'imported']),
  sourceId: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: z.string().trim().min(1).max(200),
});

export const exportRequestSchema = z
  .object({
    mode: z.enum(EXPORT_REQUEST_MODES).default('contract_only'),
    requestId: z.string().trim().min(1).max(200),
    packageId: z.string().trim().min(1).max(200),
    packageVersion: z.string().trim().regex(semverPattern, 'packageVersion must be semantic version'),
    formatCategory: z.enum(EXPORT_FORMAT_CATEGORIES),
    requestedByWorkspaceId: z.string().trim().min(1).max(200),
    initiatedAt: z.string().datetime({ offset: true }),
    provenance: exportProvenanceSchema,
    options: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoRawSecretLikeValues(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
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

export function validateExportRequest(input) {
  const parsed = exportRequestSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
