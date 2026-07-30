import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '@/lib/dynaxis/auth/auth-context';
import {
  getAsset,
  getCanonicalAsset,
  assetOwnershipRepository,
} from '@/lib/dynaxis/services/assets.js';

const ROUTE_AUTH_OPTS = Object.freeze({ legacyCompatibility: true });

function isLegacyAuthContext(authContext) {
  return authContext?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY;
}

function legacyOwnerRef(authContext) {
  return authContext?.compatibility?.ownerRef ?? authContext?.subject?.legacyOwnerRef ?? null;
}

export async function GET(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { id } = await params;

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          const asset = await getAsset(ownerRef, id);
          if (!asset) {
            return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
          }
          return jsonOk({ asset });
        }

        await requireRoutePermission(routeContext, {
          permission: 'asset.read',
          resourceId: id,
          resourceType: 'asset',
          resourceRepository: assetOwnershipRepository,
        });
        const asset = await getCanonicalAsset(id);
        if (!asset) {
          return jsonError(Object.assign(new Error('Asset not found'), { status: 404 }));
        }
        return jsonOk({ asset });
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}
