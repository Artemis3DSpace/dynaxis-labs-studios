import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  requireCompositionRoutePermission,
  getComposition,
  updateCompositionDraft,
  archiveComposition,
} from '@/lib/dynaxis/services/compositions.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const result = await getComposition(ownerRef, id);
        await requireCompositionRoutePermission(
          routeContext,
          result.composition,
          'composition.read'
        );
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, requireWorkspace: true }
  );
}

export async function PATCH(request, { params }) {
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
        const result = await updateCompositionDraft(ownerRef, id, body);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, requireWorkspace: true }
  );
}

export async function DELETE(request, { params }) {
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
          'composition.delete'
        );
        const result = await archiveComposition(ownerRef, id);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, requireWorkspace: true }
  );
}
