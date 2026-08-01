import { z } from 'zod';
import { ActivityVisibilitySchema } from './activity-contracts.js';
import { validateIntelligenceValidationResult } from './insight-contracts.js';

export const SECRET_LIKE_FIELD_NAMES = Object.freeze([
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'secret',
  'secretref',
  'secret_ref',
  'credential',
  'credentials',
  'password',
  'privatekey',
  'private_key',
]);

const secretLikeValuePattern = /(sk_[a-z0-9]{8,}|bearer\s+[a-z0-9._-]{10,}|ghp_[a-z0-9]{12,}|xox[baprs]-[a-z0-9-]{10,}|-----begin\s+private\s+key-----)/i;
const redactedValue = '[REDACTED]';

export const PrivacyBoundarySchema = z.object({
  visibility: ActivityVisibilitySchema,
  redactionRequired: z.boolean().default(true),
  allowedFields: z.array(z.string().trim().min(1)).default([]),
  deniedFields: z.array(z.string().trim().min(1)).default([]),
});

/**
 * @param {string} key
 * @returns {boolean}
 */
function isSecretLikeFieldName(key) {
  const normalized = key.replace(/[\s-]/g, '').toLowerCase();
  return SECRET_LIKE_FIELD_NAMES.includes(normalized);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSecretLikeValue(value) {
  if (typeof value !== 'string') return false;
  return secretLikeValuePattern.test(value.trim());
}

/**
 * @param {unknown} input
 * @param {string[]} redactedFields
 * @param {string[]} rejectedFields
 * @param {string} prefix
 * @returns {unknown}
 */
function redactRecursively(input, redactedFields, rejectedFields, prefix) {
  if (Array.isArray(input)) {
    return input.map((entry, index) =>
      redactRecursively(entry, redactedFields, rejectedFields, prefix ? `${prefix}[${index}]` : `[${index}]`)
    );
  }
  if (!input || typeof input !== 'object') {
    return input;
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isSecretLikeFieldName(key) || isSecretLikeValue(value)) {
      out[key] = redactedValue;
      redactedFields.push(path);
      rejectedFields.push(path);
      continue;
    }
    out[key] = redactRecursively(value, redactedFields, rejectedFields, path);
  }
  return out;
}

/**
 * @param {unknown} payload
 */
export function redactSecretLikeFields(payload) {
  const redactedFields = [];
  const rejectedFields = [];
  const redactedPayload = redactRecursively(payload, redactedFields, rejectedFields, '');
  return {
    redactedPayload,
    redactedFields,
  };
}

/**
 * Public projection contract rejects raw secret-like values and fields.
 *
 * @param {unknown} payload
 */
export function assertPublicProjectionHasNoRawSecrets(payload) {
  const redactedFields = [];
  const rejectedFields = [];
  redactRecursively(payload, redactedFields, rejectedFields, '');
  if (rejectedFields.length > 0) {
    throw new Error(`Public projection contains secret-like fields: ${rejectedFields.join(', ')}`);
  }
  return true;
}

/**
 * @param {unknown} boundary
 */
export function validatePrivacyBoundary(boundary) {
  return PrivacyBoundarySchema.parse(boundary);
}

/**
 * @param {unknown} payload
 */
export function validatePublicProjection(payload) {
  const { redactedFields } = redactSecretLikeFields(payload);
  const result = validateIntelligenceValidationResult({
    valid: redactedFields.length === 0,
    violations:
      redactedFields.length > 0 ? ['Public projection contains redacted secret-like fields.'] : [],
    redactedFields,
    contract: 'workspace-intelligence.public-projection',
  });
  if (!result.valid) {
    assertPublicProjectionHasNoRawSecrets(payload);
  }
  return result;
}
