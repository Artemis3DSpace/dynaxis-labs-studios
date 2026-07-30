import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  requireCompositionRoutePermission,
  getComposition,
  exportComposition,
} from '@/lib/dynaxis/services/compositions.js';

export async function POST(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const loaded = await getComposition(ownerRef, id);
        await requireCompositionRoutePermission(
          routeContext,
          loaded.composition,
          'composition.read'
        );
        const result = await exportComposition(ownerRef, id);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, requireWorkspace: true }
  );
}
