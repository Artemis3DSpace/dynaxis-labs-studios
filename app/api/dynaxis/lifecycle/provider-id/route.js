import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { attachProviderJobIdForRoute } from '@/lib/dynaxis/services/lifecycle.js';
import {
  findTrustedGenerationOwnership,
  isLegacyRouteCompatibility,
} from '@/lib/dynaxis/services/generations.js';

function notFound() {
  return Object.assign(new Error('Generation not found'), {
    status: 404,
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.NOT_FOUND,
  });
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const body = await request.json();
        const generationId = body?.generationId;

        if (!isLegacyRouteCompatibility(routeContext)) {
          const ownership = await findTrustedGenerationOwnership(generationId);
          if (!ownership) {
            return jsonError(notFound());
          }
          await requireRoutePermission(routeContext, {
            permission: 'generation.create',
            projectId: ownership.projectId,
            resource: ownership,
            resourceType: 'generation',
            resourceId: generationId,
          });
        }

        const result = await attachProviderJobIdForRoute(routeContext, body);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
