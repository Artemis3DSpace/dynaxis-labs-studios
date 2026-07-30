/**
 * Client-side platform fetch error normalization for TanStack Query boundaries.
 */

export const AUTH_ERROR_CODES = new Set([
  'DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED',
  'DYNAXIS_ROUTE_AUTH_WORKSPACE_REQUIRED',
]);

export const FORBIDDEN_ERROR_CODES = new Set([
  'DYNAXIS_ROUTE_AUTH_FORBIDDEN',
  'DYNAXIS_ROUTE_AUTH_NOT_FOUND',
]);

/**
 * @param {unknown} error
 */
export function normalizePlatformClientError(error) {
  const err = error && typeof error === 'object' ? error : {};
  const status = typeof err.status === 'number' ? err.status : undefined;
  const code = typeof err.code === 'string' ? err.code : undefined;
  const message =
    typeof err.message === 'string' && err.message.trim()
      ? err.message
      : 'Platform request failed';

  const isAuth =
    status === 401 || (code != null && AUTH_ERROR_CODES.has(code));
  const isForbidden =
    status === 403 || (code != null && FORBIDDEN_ERROR_CODES.has(code));
  const isStaleAuthContext = code === 'DYNAXIS_ROUTE_AUTH_INVALID_REQUEST';

  return {
    status,
    code,
    message,
    isAuth,
    isForbidden,
    isStaleAuthContext,
    shouldRetry: !isAuth && !isForbidden && !isStaleAuthContext && status !== 404,
    shouldInvalidateSession: isAuth || isStaleAuthContext,
    shouldInvalidateWorkspace: isForbidden,
    raw: err,
  };
}

/**
 * @param {unknown} error
 */
export function isPlatformAuthError(error) {
  return normalizePlatformClientError(error).isAuth;
}

/**
 * @param {unknown} error
 */
export function isPlatformForbiddenError(error) {
  return normalizePlatformClientError(error).isForbidden;
}

/**
 * Optimistic rollback boundary: auth/forbidden failures must not leave optimistic state.
 * @param {unknown} error
 */
export function shouldRollbackOptimisticUpdate(error) {
  const normalized = normalizePlatformClientError(error);
  return normalized.isAuth || normalized.isForbidden || normalized.isStaleAuthContext;
}
