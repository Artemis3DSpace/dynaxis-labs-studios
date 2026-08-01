/**
 * ProviderConnection revocation (WP-7D-06).
 *
 * POST -> requires provider_connection.revoke.
 *
 * `service.revoke` records the revoking actor and timestamp, clears default
 * routing, writes audit, and returns the redacted projection. Revoked
 * connections fail closed at the dispatch boundary. No secret material is
 * involved in this operation.
 */

import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  assertCanonicalPrincipal,
  getProviderConnectionService,
} from '@/lib/dynaxis/provider-connections/index.js';

export async function POST(request, ctx) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);
      const { connectionId } = await ctx.params;

      const connection = await getProviderConnectionService().revoke(authContext, connectionId);
      return jsonOk({ connection });
    } catch (err) {
      return jsonError(err);
    }
  });
}
