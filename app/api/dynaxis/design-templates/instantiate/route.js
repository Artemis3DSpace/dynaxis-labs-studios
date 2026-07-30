import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  instantiateDesignTemplate,
  DESIGN_ROUTE_LEGACY_COMPAT,
  resolveRouteOwnerRef,
} from '@/lib/dynaxis/services/templates.js';

export async function POST(request) {
  const body = await request.json();
  const projectId = body?.projectId || body?.binding?.projectId || undefined;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ownerRef = resolveRouteOwnerRef(routeContext);
        const result = await instantiateDesignTemplate(ownerRef, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      ...DESIGN_ROUTE_LEGACY_COMPAT,
      permission: 'design_template.read',
      requireWorkspace: true,
      ...(projectId ? { projectId } : {}),
    }
  );
}
