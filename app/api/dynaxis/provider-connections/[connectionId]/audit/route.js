/**
 * ProviderConnection audit visibility (WP-7D-06).
 *
 * GET -> requires provider_connection.audit.read.
 *
 * Events are re-scrubbed on read through the audit-view allowlist, so no raw
 * credential, `secretRef`, `keyRef`, envelope internal, IV, authTag, AAD, or
 * ciphertext can reach the browser even if a sink were populated by other
 * means. Correlation ids are preserved because they are safe by policy.
 */

import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getProviderConnectionService,
  readProviderConnectionAudit,
} from '@/lib/dynaxis/provider-connections/index.js';
import { assertCanonicalPrincipal } from '../../route.js';

export async function GET(request, ctx) {
  return withAuthContextRoute(request, async (routeContext) => {
    try {
      const { authContext } = routeContext;
      assertCanonicalPrincipal(authContext);
      const { connectionId } = await ctx.params;

      const { searchParams } = new URL(request.url);
      const event = searchParams.get('event');
      const limitParam = Number.parseInt(searchParams.get('limit') || '', 10);

      const events = await readProviderConnectionAudit(authContext, {
        service: getProviderConnectionService(),
        connectionId,
        event,
        limit: Number.isInteger(limitParam) ? limitParam : 100,
      });
      return jsonOk({ events });
    } catch (err) {
      return jsonError(err);
    }
  });
}
