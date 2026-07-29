import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listComponentRevisions,
  createComponentRevision,
} from '@/lib/dynaxis/services/components.js';
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
      const { id } = await params;
      const result = await listComponentRevisions(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component.read', requireWorkspace: true }
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
      const result = await createComponentRevision(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component.create', requireWorkspace: true }
  );
}
