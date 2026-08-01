import { z } from 'zod';

const provenanceSchema = z.object({
  source: z.enum(['asset_import', 'upload', 'generated', 'external_reference', 'manual']),
  sourceId: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime({ offset: true }),
  capturedBy: z.string().trim().min(1).max(200),
});

export const mediaReferenceSchema = z.object({
  mediaId: z.string().uuid(),
  mediaType: z.enum(['video', 'image', 'audio']),
  locator: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional().nullable(),
  provenance: provenanceSchema,
});

const genericSecretNamePattern =
  /(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|client[-_]?secret|password|secret|credential)/i;

const providerConnectionIdentifierPattern = /provider[_-]?connection/i;

const suspiciousSecretValuePattern =
  /(bearer\s+[a-z0-9_\-.=:+/]+|sk-[a-z0-9]+|pk_[a-z0-9]+|xox[baprs]-[a-z0-9-]+)/i;

/**
 * @param {unknown} value
 * @param {string[]} [path]
 * @returns {string[]}
 */
function collectSecretViolations(value, path = []) {
  const violations = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      violations.push(...collectSecretViolations(value[i], [...path, String(i)]));
    }
    return violations;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && suspiciousSecretValuePattern.test(value)) {
      violations.push(path.join('.') || '<root>');
    }
    return violations;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyPath = [...path, key];
    if (genericSecretNamePattern.test(key) || providerConnectionIdentifierPattern.test(key)) {
      violations.push(keyPath.join('.'));
    }
    violations.push(...collectSecretViolations(child, keyPath));
  }

  return violations;
}

/**
 * Reject accidental embedding of raw ProviderConnection material in generative placeholders.
 * @param {unknown} value
 */
export function assertNoProviderConnectionSecrets(value) {
  const violations = collectSecretViolations(value);
  if (violations.length > 0) {
    throw Object.assign(
      new Error(
        `generative block contains forbidden secret-bearing/provider-connection fields: ${violations.join(', ')}`
      ),
      { code: 'COMPOSER_GENERATIVE_SECRET_FORBIDDEN', violations }
    );
  }
}

export const generativeBlockPlaceholderSchema = z
  .object({
    blockId: z.string().uuid(),
    providerHint: z.string().trim().min(1).max(120).optional().nullable(),
    prompt: z.string().trim().min(1).max(16000),
    referenceMediaIds: z.array(z.string().uuid()).max(64).default([]),
    params: z.record(z.string(), z.unknown()).default({}),
    provenance: provenanceSchema,
  })
  .superRefine((block, ctx) => {
    try {
      assertNoProviderConnectionSecrets(block);
    } catch (err) {
      ctx.addIssue({
        code: 'custom',
        path: ['params'],
        message: err.message,
      });
    }
  });
