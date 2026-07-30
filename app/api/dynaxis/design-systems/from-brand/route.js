import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { createDesignSystemFromBrand } from '@/lib/dynaxis/services/design-systems.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/design-systems.js';

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const body = await request.json();
      const result = await createDesignSystemFromBrand(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.create', requireWorkspace: true }
  );
}
