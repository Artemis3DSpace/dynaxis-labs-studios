import { z } from 'zod';

export const PUBLISH_VALIDATION_GATE_STATUSES = Object.freeze(['pass', 'fail', 'blocker']);

const secretKeyPattern =
  /(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|client[-_]?secret|password|secret|credential)/i;
const secretValuePattern =
  /(bearer\s+[a-z0-9_\-.=:+/]+|sk-[a-z0-9]+|pk_[a-z0-9]+|xox[baprs]-[a-z0-9-]+)/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    violations.push(...collectSecretLikePaths(child, keyPath));
  }

  return violations;
}

function redactSecretLikeFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretLikeFields(item));
  }

  if (!isPlainObject(value)) {
    if (typeof value === 'string' && secretValuePattern.test(value)) {
      return '[REDACTED]';
    }
    return value;
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (secretKeyPattern.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSecretLikeFields(child);
    }
  }
  return output;
}

export function assertNoRawSecretLikeValues(value) {
  const violations = collectSecretLikePaths(value);
  if (violations.length > 0) {
    throw Object.assign(
      new Error(`publish/export contract contains forbidden secret-like content: ${violations.join(', ')}`),
      {
        code: 'DYNAXIS_PUBLISH_SECRET_VALUE_FORBIDDEN',
        violations,
      }
    );
  }
}

export function createPublicProjection(value) {
  return redactSecretLikeFields(value);
}

export const validationGateIssueSchema = z.object({
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
});

export const validationGateContractSchema = z
  .object({
    gateId: z.string().trim().min(1).max(200),
    gateName: z.string().trim().min(1).max(200),
    status: z.enum(PUBLISH_VALIDATION_GATE_STATUSES),
    evidence: z.array(z.string().trim().min(1).max(2000)).default([]),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'fail' || value.status === 'blocker') && value.evidence.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'failed or blocker gate must include evidence',
      });
    }
  });

export const publishExportValidationResultSchema = z
  .object({
    requestId: z.string().trim().min(1).max(200),
    status: z.enum(PUBLISH_VALIDATION_GATE_STATUSES),
    gates: z.array(validationGateContractSchema).min(1),
    issues: z.array(validationGateIssueSchema).default([]),
    publicProjection: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoRawSecretLikeValues(value.publicProjection);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['publicProjection'],
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

export function validateValidationGateContract(input) {
  const parsed = validationGateContractSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}

export function validatePublishExportValidationResult(input) {
  const parsed = publishExportValidationResultSchema.safeParse(input);
  return parsed.success
    ? { ok: true, issues: [], value: parsed.data }
    : { ok: false, issues: normalizeIssues(parsed.error) };
}
