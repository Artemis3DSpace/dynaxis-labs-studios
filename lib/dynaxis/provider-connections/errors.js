/**
 * ProviderConnection runtime error contract (WP-7D-04).
 *
 * Preserves the logical error codes defined by WP-7D-01. Errors returned to
 * clients are sanitized: no raw provider payloads, no secret material, no
 * envelope internals, no key references.
 */

export const PROVIDER_CONNECTION_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'PROVIDER_CONNECTION_NOT_FOUND',
  FORBIDDEN: 'PROVIDER_CONNECTION_FORBIDDEN',
  OWNER_MISMATCH: 'PROVIDER_CONNECTION_OWNER_MISMATCH',
  UNSUPPORTED_PROVIDER: 'PROVIDER_CONNECTION_UNSUPPORTED_PROVIDER',
  UNSUPPORTED_CREDENTIAL_KIND: 'PROVIDER_CONNECTION_UNSUPPORTED_CREDENTIAL_KIND',
  INACTIVE: 'PROVIDER_CONNECTION_INACTIVE',
  ROTATION_REQUIRED: 'PROVIDER_CONNECTION_ROTATION_REQUIRED',
  REVOKED: 'PROVIDER_CONNECTION_REVOKED',
  DELETED: 'PROVIDER_CONNECTION_DELETED',
  SCOPE_DENIED: 'PROVIDER_CONNECTION_SCOPE_DENIED',
  CAPABILITY_DENIED: 'PROVIDER_CONNECTION_CAPABILITY_DENIED',
  MODEL_DENIED: 'PROVIDER_CONNECTION_MODEL_DENIED',
  SECRET_MISSING: 'PROVIDER_CONNECTION_SECRET_MISSING',
  SECRET_UNAVAILABLE: 'PROVIDER_CONNECTION_SECRET_UNAVAILABLE',
  SECRET_CORRUPT: 'PROVIDER_CONNECTION_SECRET_CORRUPT',
  SECRET_EXPIRED: 'PROVIDER_CONNECTION_SECRET_EXPIRED',
  PROVIDER_HEALTH_FAILED: 'PROVIDER_CONNECTION_PROVIDER_HEALTH_FAILED',
  AUDIT_UNAVAILABLE: 'PROVIDER_CONNECTION_AUDIT_UNAVAILABLE',
  INVALID_INPUT: 'PROVIDER_CONNECTION_INVALID_INPUT',
});

export class ProviderConnectionError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ProviderConnectionError';
    this.code = opts.code || PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN;
    this.status = opts.status || 403;
    if (opts.decision) {
      this.decision = opts.decision;
    }
  }
}

export function providerConnectionError(code, status, message, opts = {}) {
  return new ProviderConnectionError(message, { code, status, ...opts });
}
