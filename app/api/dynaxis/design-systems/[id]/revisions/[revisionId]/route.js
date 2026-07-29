import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getDesignSystemRevision } from '@/lib/dynaxis/services/design-systems.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/design-systems.js';

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const { revisionId } = await params;
      const result = await getDesignSystemRevision(ownerRef, revisionId);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.read', requireWorkspace: true }
  );
}
