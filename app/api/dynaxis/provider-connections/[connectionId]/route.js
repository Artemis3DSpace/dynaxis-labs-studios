/**
 * ProviderConnection detail and soft-delete (WP-7D-06).
 *
 * GET    -> redacted health projection (requires provider_connection.read)
 * DELETE -> tombstone the connection   (requires provider_connection.delete)
 *
 * Authorization is enforced inside the ProviderConnection layer; see the sibling
 * `route.js` for why `requireRoutePermission` is not used here.
 */

import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getConnectionHealth,
  getProviderConnectionService,
} from '@/lib/dynaxis/provider-connections/index.js';
import { assertCanonicalPrincipal } from '../route.js';

export async function GET(request, ctx) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);
      const { connectionId } = await ctx.params;

      const connection = await getConnectionHealth(authContext, {
        service: getProviderConnectionService(),
        connectionId,
      });
      return jsonOk({ connection });
    } catch (err) {
      return jsonError(err);
    }
  });
}

export async function DELETE(request, ctx) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);
      const { connectionId } = await ctx.params;

      // `service.remove` enforces provider_connection.delete, tombstones the
      // row, clears default routing, writes audit, and returns a redacted
      // projection.
      const connection = await getProviderConnectionService().remove(authContext, connectionId);
      return jsonOk({ connection });
    } catch (err) {
      return jsonError(err);
    }
  });
}
