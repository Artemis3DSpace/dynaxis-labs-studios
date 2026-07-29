import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  createCompositionFromDeliverable,
} from '@/lib/dynaxis/services/compositions.js';

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const body = await request.json();
        const result = await createCompositionFromDeliverable(ownerRef, body);
        return jsonOk(result, result.created ? 201 : 200);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission: 'composition.create',
    }
  );
}
