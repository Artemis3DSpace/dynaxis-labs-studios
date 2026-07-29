import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  adaptComposition,
  batchAdaptComposition,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/templates.js';
import {
  getComposition,
  requireCompositionRoutePermission,
} from '@/lib/dynaxis/services/compositions.js';

export async function POST(request) {
  const body = await request.json();
  const compositionId = body?.compositionId || undefined;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        if (compositionId) {
          const loaded = await getComposition(ownerRef, compositionId);
          await requireCompositionRoutePermission(
            routeContext,
            loaded.composition,
            'composition.update'
          );
        }
        if (Array.isArray(body?.targets)) {
          const result = await batchAdaptComposition(ownerRef, body);
          return jsonOk(result, 201);
        }
        const result = await adaptComposition(ownerRef, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission: 'composition.update',
    }
  );
}
