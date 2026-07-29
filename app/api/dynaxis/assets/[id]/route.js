import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  findTrustedAssetOwnership,
  getAssetForRoute,
} from '@/lib/dynaxis/services/assets.js';
import { isLegacyRouteCompatibility } from '@/lib/dynaxis/services/projects.js';

function notFound() {
  return Object.assign(new Error('Asset not found'), {
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
          const ownership = await findTrustedAssetOwnership(id);
          if (!ownership) {
            return jsonError(notFound());
          }
          await requireRoutePermission(routeContext, {
            permission: 'asset.read',
            projectId: ownership.projectId,
            resource: ownership,
            resourceType: 'asset',
            resourceId: id,
          });
        }

        const asset = await getAssetForRoute(routeContext, id);
        if (!asset) {
          return jsonError(notFound());
        }
        return jsonOk({ asset });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
