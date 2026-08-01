import { JobEngineError, JOB_ENGINE_ERROR_CODES } from './errors.js';

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export function normalizeIdempotencyKey(input) {
  if (typeof input !== 'string') {
    throw new JobEngineError('Idempotency key must be a string.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
    });
  }
  const normalized = input.trim().toLowerCase().replace(/\s+/g, '-');
  if (!normalized) {
    throw new JobEngineError('Idempotency key must not be empty.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
    });
  }
  if (normalized.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new JobEngineError('Idempotency key exceeds maximum length.', {
      code: JOB_ENGINE_ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
      details: { maxLength: IDEMPOTENCY_KEY_MAX_LENGTH },
    });
  }
  return normalized;
}

