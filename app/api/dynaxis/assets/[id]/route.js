import { withAuthContextRoute, requireRoutePermission, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  findAssetOwnershipResource,
  getAssetForAuthContext,
} from '@/lib/dynaxis/services/assets.js';

function isLegacyAuthContext(authContext) {
  return authContext?.subject?.type === 'legacy';
}

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const { authContext } = routeContext;
      try {
        const { id } = await params;
        if (!isLegacyAuthContext(authContext)) {
          const resource = await findAssetOwnershipResource(id);
          await requireRoutePermission(routeContext, {
            permission: 'asset.read',
            projectId: resource?.projectId,
            resource: resource || null,
            resourceType: 'asset',
            resourceId: id,
          });
        }
        const asset = await getAssetForAuthContext(authContext, id);
        if (!asset) {
          return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
        }
        return jsonOk({ asset });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}
