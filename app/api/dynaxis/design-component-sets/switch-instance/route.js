import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { switchComponentInstanceVariant } from '@/lib/dynaxis/services/component-sets.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/components.js';

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const body = await request.json();
      const { compositionId, ...rest } = body || {};
      const result = await switchComponentInstanceVariant(ownerRef, compositionId, rest);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'composition.update', requireWorkspace: true }
  );
}
