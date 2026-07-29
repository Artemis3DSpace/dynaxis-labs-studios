import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  findTrustedGenerationOwnership,
  getGenerationForRoute,
  isLegacyRouteCompatibility,
} from '@/lib/dynaxis/services/generations.js';
import { listAssetsForGeneration } from '@/lib/dynaxis/services/assets.js';

function notFound() {
  return Object.assign(new Error('Generation not found'), {
    status: 404,
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.NOT_FOUND,
  });
}

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { id } = await params;

        if (!isLegacyRouteCompatibility(routeContext)) {
          const ownership = await findTrustedGenerationOwnership(id);
          if (!ownership) {
            return jsonError(notFound());
          }
          await requireRoutePermission(routeContext, {
            permission: 'generation.read',
            projectId: ownership.projectId,
            resource: ownership,
            resourceType: 'generation',
            resourceId: id,
          });
        }

        const generation = await getGenerationForRoute(routeContext, id);
        if (!generation) {
          return jsonError(notFound());
        }
        const assets = await listAssetsForGeneration(id);
        return jsonOk({ generation, assets });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
