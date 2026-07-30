import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignSystems,
  createDesignSystem,
} from '@/lib/dynaxis/services/design-systems.js';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/design-systems.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const { searchParams } = new URL(request.url);
      const result = await listDesignSystems(ownerRef, {
        status: searchParams.get('status') || undefined,
        brandId: searchParams.get('brandId') || undefined,
        q: searchParams.get('q') || undefined,
        includeArchived: searchParams.get('includeArchived') === 'true',
        limit: Number(searchParams.get('limit') || 100),
      });
      return jsonOk(result);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.read', requireWorkspace: true }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const ownerRef = resolveRouteOwnerRef(routeContext);
    try {
      const body = await request.json();
      const result = await createDesignSystem(ownerRef, body);
      return jsonOk(result, 201);
    } catch (err) {
      return jsonError(err);
    }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_system.create', requireWorkspace: true }
  );
}
