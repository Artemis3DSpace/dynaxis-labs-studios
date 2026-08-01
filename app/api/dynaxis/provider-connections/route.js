/**
 * ProviderConnection health list (WP-7D-06).
 *
 * Authorization is enforced by the ProviderConnection layer, not by
 * `requireRoutePermission`: the `provider_connection.*` vocabulary lives in the
 * Phase 7D registry (see the WP-7D-04 handoff), so the canonical evaluator
 * would return UNKNOWN_PERMISSION. `listConnectionHealth` applies
 * `provider_connection.read` per row and filters unreadable rows, so a foreign
 * `organizationId` yields an empty list rather than confirming existence.
 *
 * Responses carry only the allowlist health projection — never `secretRef`,
 * `keyRef`, envelope metadata, or any secret material.
 */

import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  assertCanonicalPrincipal,
  getProviderConnectionService,
  listConnectionHealth,
} from '@/lib/dynaxis/provider-connections/index.js';

export async function GET(request) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);

      const { searchParams } = new URL(request.url);
      const ownerType = searchParams.get('ownerType') === 'user' ? 'user' : 'workspace';

      const connections = await listConnectionHealth(authContext, {
        service: getProviderConnectionService(),
        ownerType,
        // Scope is taken from the authenticated context, never from the query
        // string, so a client cannot point the listing at another Workspace.
        organizationId: authContext?.workspace?.organizationId || null,
        ownerUserId: authContext?.principal?.userId || null,
      });

      return jsonOk({ connections });
    } catch (err) {
      return jsonError(err);
    }
  });
}
