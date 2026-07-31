/**
 * Secret envelope and key-management error contract (WP-7D-04).
 *
 * Every failure here is fail-closed: there is no fallback to weaker
 * encryption, no plaintext path, and no retry with corrupted material.
 * Error messages are sanitized and never carry secret material, key
 * material, ciphertext, IVs, or auth tags.
 */

export const DYNAXIS_SECRET_ERROR_CODES = Object.freeze({
  KEY_UNAVAILABLE: 'DYNAXIS_SECRET_KEY_UNAVAILABLE',
  KEY_REF_INVALID: 'DYNAXIS_SECRET_KEY_REF_INVALID',
  KEY_PROVIDER_UNCONFIGURED: 'DYNAXIS_SECRET_KEY_PROVIDER_UNCONFIGURED',
  KEY_PROVIDER_FORBIDDEN_ENVIRONMENT: 'DYNAXIS_SECRET_KEY_PROVIDER_FORBIDDEN_ENVIRONMENT',
  UNSUPPORTED_ALGORITHM: 'DYNAXIS_SECRET_UNSUPPORTED_ALGORITHM',
  AAD_MISMATCH: 'DYNAXIS_SECRET_AAD_MISMATCH',
  ENVELOPE_CORRUPT: 'DYNAXIS_SECRET_ENVELOPE_CORRUPT',
  ENVELOPE_INVALID: 'DYNAXIS_SECRET_ENVELOPE_INVALID',
  PLAINTEXT_REQUIRED: 'DYNAXIS_SECRET_PLAINTEXT_REQUIRED',
});

export class DynaxisSecretError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'DynaxisSecretError';
    this.code = opts.code || DYNAXIS_SECRET_ERROR_CODES.ENVELOPE_INVALID;
    this.status = opts.status || 500;
  }
}

export function secretError(code, status, message) {
  return new DynaxisSecretError(message, { code, status });
}
