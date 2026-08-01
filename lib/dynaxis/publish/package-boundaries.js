import { z } from 'zod';

export const PUBLISH_EXPORT_FORBIDDEN_PATH_PATTERNS = Object.freeze([
  'lib/dynaxis/provider-connections/',
  'lib/dynaxis/secrets/',
  'drizzle/',
  'schema/',
  'migrations/',
]);

function normalizePath(path) {
  return String(path || '')
    .replaceAll('\\', '/')
    .toLowerCase();
}

function pathHitsForbiddenPattern(path) {
  const normalized = normalizePath(path);
  return PUBLISH_EXPORT_FORBIDDEN_PATH_PATTERNS.some((pattern) =>
    normalized.includes(normalizePath(pattern))
  );
}

export const packageBoundaryRuleSchema = z.object({
  packageName: z.string().trim().min(1).max(200),
  allowedPaths: z.array(z.string().trim().min(1).max(2000)).min(1),
  forbiddenPaths: z
    .array(z.string().trim().min(1).max(2000))
    .default([...PUBLISH_EXPORT_FORBIDDEN_PATH_PATTERNS]),
});

export function validatePackageBoundaryRules(input) {
  const parsed = packageBoundaryRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path?.length ? issue.path.join('.') : '$',
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  const issues = [];
  for (const allowedPath of parsed.data.allowedPaths) {
    if (pathHitsForbiddenPattern(allowedPath)) {
      issues.push({
        path: 'allowedPaths',
        message: `forbidden path pattern detected in allowedPaths: ${allowedPath}`,
        code: 'forbidden_path',
      });
    }
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, issues: [], value: parsed.data };
}
