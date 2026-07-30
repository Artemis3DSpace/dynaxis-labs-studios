import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getDesignComponentRevision } from '@/lib/dynaxis/services/components.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/components.js';

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const { id, revisionId } = await params;
      const result = await getDesignComponentRevision(ownerRef, id, revisionId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component.read', requireWorkspace: true }
  );
}
