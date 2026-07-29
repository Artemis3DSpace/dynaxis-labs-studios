import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { startLifecycleForRoute } from '@/lib/dynaxis/services/lifecycle.js';
import { isLegacyRouteCompatibility } from '@/lib/dynaxis/services/generations.js';

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const body = await request.json();
        const projectId = body?.projectId || undefined;

        if (!isLegacyRouteCompatibility(routeContext)) {
          if (!projectId) {
            return jsonError(
              Object.assign(new Error('projectId is required'), {
                status: 400,
                code: 'VALIDATION_ERROR',
              })
            );
          }
          await requireRoutePermission(routeContext, {
            permission: 'generation.create',
            projectId,
          });
        }

        const result = await startLifecycleForRoute(routeContext, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
