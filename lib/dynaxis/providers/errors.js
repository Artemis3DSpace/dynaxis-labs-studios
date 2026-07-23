/**
 * Provider-neutral error taxonomy.
 */

import { safeProviderPayload } from './common.js';

export const PROVIDER_ERROR_CODES = /** @type {const} */ ([
  'PROVIDER_NOT_FOUND',
  'PROVIDER_INVALID_REQUEST',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_SUBMIT_FAILED',
  'PROVIDER_RETRIEVE_FAILED',
  'PROVIDER_CANCEL_FAILED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_REGISTRATION_INVALID',
]);

const PROVIDER_ERROR_CODE_SET = new Set(PROVIDER_ERROR_CODES);

const SAFE_PROVIDER_ERROR_MESSAGES = Object.freeze({
  PROVIDER_AUTH_FAILED: 'Provider authentication failed',
  PROVIDER_RATE_LIMITED: 'Provider rate limit exceeded',
  PROVIDER_SUBMIT_FAILED: 'Provider submit failed',
  PROVIDER_RETRIEVE_FAILED: 'Provider retrieve failed',
  PROVIDER_CANCEL_FAILED: 'Provider cancel failed',
  PROVIDER_TIMEOUT: 'Provider timeout',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
});

export class DynaxisProviderError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code: string,
   *   providerId?: string|null,
   *   operation?: string|null,
   *   status?: number|null,
   *   statusText?: string|null,
   *   retryable?: boolean,
   *   providerPayload?: unknown,
   *   cause?: unknown,
   *   legacyCode?: string|null,
   * }} opts
   */
  constructor(message, opts) {
    super(message);
    this.name = 'DynaxisProviderError';
    this.code = opts.code;
    this.providerId = opts.providerId ?? null;
    this.operation = opts.operation ?? null;
    this.status = opts.status ?? null;
    this.statusText = opts.statusText ?? null;
    this.retryable = Boolean(opts.retryable);
    this.providerPayload = safeProviderPayload(opts.providerPayload || {});
    this.legacyCode = opts.legacyCode ?? null;
    if (opts.cause) {
      Object.defineProperty(this, 'cause', {
        value: opts.cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }
}

/**
 * @param {unknown} err
 * @param {{
 *   providerId?: string,
 *   operation?: string,
 *   fallbackCode?: string,
 *   fallbackMessage?: string,
 * }} [opts]
 */
export function toProviderError(err, opts = {}) {
  if (err instanceof DynaxisProviderError) return err;
  const status = typeof err?.status === 'number' ? err.status : null;
  let code = PROVIDER_ERROR_CODE_SET.has(err?.dynaxisProviderCode)
    ? err.dynaxisProviderCode
    : opts.fallbackCode || 'PROVIDER_UNAVAILABLE';
  if (status === 401 || status === 403) code = 'PROVIDER_AUTH_FAILED';
  else if (status === 429) code = 'PROVIDER_RATE_LIMITED';
  else if (!PROVIDER_ERROR_CODE_SET.has(err?.dynaxisProviderCode)) {
    if (opts.operation === 'submit') code = 'PROVIDER_SUBMIT_FAILED';
    else if (opts.operation === 'retrieve') code = 'PROVIDER_RETRIEVE_FAILED';
    else if (opts.operation === 'cancel') code = 'PROVIDER_CANCEL_FAILED';
  }

  const message = SAFE_PROVIDER_ERROR_MESSAGES[code] || 'Provider unavailable';
  return new DynaxisProviderError(message, {
    code,
    providerId: opts.providerId || err?.providerId || null,
    operation: opts.operation || err?.operation || null,
    status,
    retryable: Boolean(err?.retryable || status === 429 || (status != null && status >= 500)),
    providerPayload: err?.providerPayload || {},
    legacyCode: err?.code || null,
  });
}

/**
 * @param {string} providerId
 */
export function providerNotFoundError(providerId) {
  const err = new DynaxisProviderError(`Generation provider not registered: ${providerId}`, {
    code: 'PROVIDER_NOT_FOUND',
    providerId,
    operation: 'registry.require',
    retryable: false,
  });
  err.status = 400;
  return err;
}
