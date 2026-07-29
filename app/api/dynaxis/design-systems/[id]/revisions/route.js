import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createDesignSystemRevision,
  getDesignSystem,
} from '@/lib/dynaxis/services/design-systems.js';
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
      const { id } = await params;
      const result = await getDesignSystem(ownerRef, id);
      return jsonOk({ revisions: result.revisions });
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.read', requireWorkspace: true }
  );
}

export async function POST(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const { id } = await params;
      const body = await request.json();
      const result = await createDesignSystemRevision(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.create', requireWorkspace: true }
  );
}
