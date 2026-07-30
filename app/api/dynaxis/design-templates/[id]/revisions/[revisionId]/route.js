import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getTemplateRevision,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/templates.js';

export async function GET(request, { params }) {
  const { id, revisionId } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const result = await getTemplateRevision(ownerRef, id, revisionId);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_template.read', requireWorkspace: true }
  );
}
