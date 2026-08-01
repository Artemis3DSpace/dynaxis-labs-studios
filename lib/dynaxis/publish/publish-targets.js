import { z } from 'zod';
import { assertNoRawSecretLikeValues } from './validation-gates.js';

export const PUBLISH_TARGET_TYPES = Object.freeze([
  'github_release',
  'vercel_deploy',
  'railway_deploy',
  'fly_deploy',
  'netlify_deploy',
  'package_registry',
]);

export const PUBLISH_TARGET_MODES = Object.freeze(['placeholder_only']);

export const DEPLOYMENT_BOUNDARY_MODES = Object.freeze(['placeholder_only']);

export const publishTargetPlaceholderSchema = z
  .object({
    targetId: z.string().trim().min(1).max(200),
    targetType: z.enum(PUBLISH_TARGET_TYPES),
    mode: z.enum(PUBLISH_TARGET_MODES),
    executionEnabled: z.literal(false),
    notes: z.array(z.string().trim().min(1).max(1000)).default([]),
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

export const deploymentBoundaryPlaceholderSchema = z.object({
  mode: z.enum(DEPLOYMENT_BOUNDARY_MODES),
  deploymentExecutionEnabled: z.literal(false),
  publishTargetIds: z.array(z.string().trim().min(1).max(200)).default([]),
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

export function validatePublishTargetPlaceholder(input) {
  const parsed = publishTargetPlaceholderSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}

export function validateDeploymentBoundaryPlaceholder(input) {
  const parsed = deploymentBoundaryPlaceholderSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
