/**
 * Shared route guard for ProviderConnection API surfaces (WP-7D-07).
 *
 * Previously this lived in `app/api/dynaxis/provider-connections/route.js` and
 * sibling routes imported it across route modules — which works but couples
 * every route to a module that also exports a `GET` handler. Moving it here
 * keeps route files to handlers only and gives the guard a single home in the
 * ProviderConnection layer.
 *
 * This is the first gate on every ProviderConnection route: it runs before any
 * connection is loaded, so a legacy or non-canonical principal cannot reach
 * persisted rows at all.
 *
 * AuthContext is the Phase 7C/7D trust root (WP-7D-07 follow-up 6). Every
 * ProviderConnection authorization decision — this guard, the policy
 * evaluator, and the service layer — derives entirely from the AuthContext
 * produced by Better Auth session resolution. Nothing downstream re-derives
 * identity from request input, provider account metadata, or credential
 * material. A forged AuthContext would therefore defeat these checks, which is
 * why AuthContext construction (WP-7C-12) is the security-critical boundary.
 */

import 'server-only';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '../auth/auth-context.js';
import { PROVIDER_CONNECTION_ERROR_CODES, providerConnectionError } from './errors.js';

/**
 * Rejects legacy `x-api-key` and any non-canonical principal.
 *
 * Legacy compatibility principals are explicitly refused rather than merely
 * failing later: an `x-api-key` value is a provider credential, and a provider
 * credential must never grant ProviderConnection authority.
 */
export function assertCanonicalPrincipal(authContext) {
  if (authContext?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'Legacy x-api-key compatibility does not grant ProviderConnection authority'
    );
  }
  if (authContext?.subject?.type !== AUTH_CONTEXT_SUBJECT_TYPES.USER) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.FORBIDDEN,
      403,
      'A canonical session is required'
    );
  }
  return true;
}
