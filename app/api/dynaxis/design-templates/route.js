import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listDesignTemplates,
  createDesignTemplate,
  createTemplateFromComposition,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/templates.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const { searchParams } = new URL(request.url);
        const result = await listDesignTemplates(ownerRef, {
          status: searchParams.get('status') || undefined,
          category: searchParams.get('category') || undefined,
          includeArchived: searchParams.get('includeArchived') === 'true',
          limit: Number(searchParams.get('limit') || 100),
          q: searchParams.get('q') || undefined,
        });
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_template.read', requireWorkspace: true }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const body = await request.json();
        if (body?.fromComposition || body?.compositionId) {
          const result = await createTemplateFromComposition(ownerRef, body);
          return jsonOk(result, 201);
        }
        const result = await createDesignTemplate(ownerRef, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { ...DESIGN_ROUTE_LEGACY_COMPAT, permission: 'design_template.create', requireWorkspace: true }
  );
}
