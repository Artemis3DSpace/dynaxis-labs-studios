import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
  listCompositions,
  createCompositionFromAsset,
} from '@/lib/dynaxis/services/compositions.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const campaignId = searchParams.get('campaignId') || undefined;
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const limit = Number(searchParams.get('limit') || 100);
        const result = await listCompositions(ownerRef, {
          projectId,
          campaignId,
          includeArchived,
          limit,
        });
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission: 'composition.read',
      ...(projectId ? { projectId } : {}),
    }
  );
}

export async function POST(request) {
  const body = await request.json();
  const projectId = body?.projectId || undefined;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const result = await createCompositionFromAsset(ownerRef, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission: 'composition.create',
      ...(projectId ? { projectId } : {}),
    }
  );
}
