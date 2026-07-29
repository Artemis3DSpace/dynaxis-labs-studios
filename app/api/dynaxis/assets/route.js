import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  listAssetsForRoute,
  registerAssetForRoute,
} from '@/lib/dynaxis/services/assets.js';
import { isLegacyRouteCompatibility } from '@/lib/dynaxis/services/projects.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId') || undefined;
        const generationId = searchParams.get('generationId') || undefined;
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

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
            permission: 'asset.read',
            projectId,
          });
        }

        const assets = await listAssetsForRoute(routeContext, {
          projectId,
          generationId,
          limit,
        });
        return jsonOk({ assets });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}

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
            permission: 'asset.create',
            projectId,
          });
        }

        const asset = await registerAssetForRoute(routeContext, body, { projectId });
        return jsonOk({ asset }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
