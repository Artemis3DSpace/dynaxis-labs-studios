import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  requireCompositionRoutePermission,
  getComposition,
  setDeliverableFinalAsset,
  prepareCleanBackgroundRegeneration,
  applyCompositionBackgroundAsset,
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
          'composition.update'
        );
        const body = await request.json();
        const action = body?.action;
        if (action === 'setFinalAsset') {
          const result = await setDeliverableFinalAsset(ownerRef, id, body);
          return jsonOk(result);
        }
        if (action === 'prepareCleanBackground') {
          const result = await prepareCleanBackgroundRegeneration(ownerRef, id);
          return jsonOk(result);
        }
        if (action === 'applyBackground') {
          const result = await applyCompositionBackgroundAsset(ownerRef, id, body);
          return jsonOk(result);
        }
        return jsonError(
          Object.assign(new Error(`Unknown action: ${action}`), {
            code: 'INVALID_ACTION',
            status: 400,
          })
        );
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, requireWorkspace: true }
  );
}
