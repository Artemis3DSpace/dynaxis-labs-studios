import { z } from 'zod';

export const ASSET_USAGE_CONTEXTS = Object.freeze([
  'composer.timeline',
  'composer.clip',
  'design-system.token',
  'design-system.component',
  'template-library.template',
  'template-library.package',
  'app-ir.asset-slot',
]);

export const ASSET_USAGE_SCOPES = Object.freeze([
  'public',
  'workspace',
  'project',
  'private',
]);

export const ASSET_USAGE_INTENTS = Object.freeze([
  'render',
  'reference',
  'preview',
  'training',
  'documentation',
  'internal',
]);

export const provenanceMetadataSchema = z.object({
  source: z.enum(['upload', 'import', 'generated', 'curated', 'external_reference', 'manual']),
  sourceId: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: z.string().trim().min(1).max(200),
  traceId: z.string().trim().min(1).max(200).optional().nullable(),
});

export const usageMetadataSchema = z.object({
  scope: z.enum(ASSET_USAGE_SCOPES),
  intents: z.array(z.enum(ASSET_USAGE_INTENTS)).min(1).max(16),
  allowedContexts: z.array(z.enum(ASSET_USAGE_CONTEXTS)).min(1).max(64),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  embargoUntil: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().trim().min(1).max(2000).optional().nullable(),
});

export const assetValidationIssueSchema = z.object({
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
});

export const assetValidationResultSchema = z.object({
  ok: z.boolean(),
  issues: z.array(assetValidationIssueSchema),
  value: z.unknown().optional(),
});
