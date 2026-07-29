import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignComponentSetVariants,
  upsertDesignComponentSetVariant,
} from '@/lib/dynaxis/services/component-sets.js';
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
      const result = await listDesignComponentSetVariants(ownerRef, id);
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component_set.read', requireWorkspace: true }
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
      const result = await upsertDesignComponentSetVariant(ownerRef, id, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component_set.create', requireWorkspace: true }
  );
}
