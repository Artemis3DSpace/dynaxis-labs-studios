import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignComponents,
  createDesignComponent,
  createComponentFromLayers,
} from '@/lib/dynaxis/services/components.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/components.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const category = searchParams.get('category') || undefined;
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const limit = Number(searchParams.get('limit') || 100);
      const result = await listDesignComponents(ownerRef, {
        status,
        category,
        includeArchived,
        limit,
      });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component.read', requireWorkspace: true }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const body = await request.json();
      if (body?.fromLayers || (body?.compositionId && body?.layerIds)) {
        const result = await createComponentFromLayers(ownerRef, {
          ...body,
          replaceSelectedLayers: Boolean(body.replaceSelectedLayers),
        });
        return jsonOk(result, 201);
      }
      const result = await createDesignComponent(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component.create', requireWorkspace: true }
  );
}
