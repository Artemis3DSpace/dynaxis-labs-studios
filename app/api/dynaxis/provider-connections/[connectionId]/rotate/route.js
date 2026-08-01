/**
 * ProviderConnection secret rotation (WP-7D-06).
 *
 * POST -> requires provider_connection.rotate.
 *
 * The raw replacement credential is accepted only here, at the server
 * boundary, and is handed straight to `service.rotate`, which seals it into a
 * new AES-256-GCM envelope via the WP-7D-04 secret runtime. It is never
 * logged, audited, cached, persisted in metadata, or echoed back — the
 * response is the redacted public projection.
 *
 * No OAuth refresh flow and no provider-side credential validation: WP-7D-06
 * does not own either, so the new credential is not sent to MuAPI to "check"
 * it.
 */

import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getProviderConnectionService,
  PROVIDER_CONNECTION_ERROR_CODES,
  providerConnectionError,
} from '@/lib/dynaxis/provider-connections/index.js';
import { assertCanonicalPrincipal } from '../../route.js';

/**
 * Clients may submit only the replacement credential. Envelope and key fields
 * are server-owned; accepting them would let a caller steer the secret
 * boundary.
 */
const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  'secretRef',
  'keyRef',
  'secretVersion',
  'encryptedPayload',
  'authTag',
  'iv',
  'aadOwnerType',
  'aadOwnerId',
  'aadProviderId',
  'aadCredentialKind',
  'aadSecretVersion',
  'secretStatus',
  'credentialFingerprint',
]);

export function assertRotationPayload(body) {
  if (!body || typeof body !== 'object') {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
      400,
      'A JSON body is required'
    );
  }
  for (const field of FORBIDDEN_REQUEST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw providerConnectionError(
        PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
        400,
        'Envelope and key fields are server-owned and cannot be supplied'
      );
    }
  }
  const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
  if (!secret) {
    throw providerConnectionError(
      PROVIDER_CONNECTION_ERROR_CODES.SECRET_MISSING,
      400,
      'Replacement credential material is required'
    );
  }
  return secret;
}

export async function POST(request, ctx) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);
      const { connectionId } = await ctx.params;

      let body;
      try {
        body = await request.json();
      } catch {
        throw providerConnectionError(
          PROVIDER_CONNECTION_ERROR_CODES.INVALID_INPUT,
          400,
          'A JSON body is required'
        );
      }
      const secret = assertRotationPayload(body);

      const connection = await getProviderConnectionService().rotate(authContext, connectionId, {
        secret,
      });
      return jsonOk({ connection });
    } catch (err) {
      return jsonError(err);
    }
  });
}
