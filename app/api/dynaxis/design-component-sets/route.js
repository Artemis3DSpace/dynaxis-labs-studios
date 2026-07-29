import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignComponentSets,
  createDesignComponentSet,
} from '@/lib/dynaxis/services/component-sets.js';
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
      const result = await listDesignComponentSets(ownerRef, {
        status: searchParams.get('status') || undefined,
        category: searchParams.get('category') || undefined,
        q: searchParams.get('q') || undefined,
        includeArchived: searchParams.get('includeArchived') === 'true',
        limit: Number(searchParams.get('limit') || 100),
      });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component_set.read', requireWorkspace: true }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const body = await request.json();
      const result = await createDesignComponentSet(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_component_set.create', requireWorkspace: true }
  );
}
