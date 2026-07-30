import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '@/lib/dynaxis/auth/auth-context';
import {
  listAssets,
  registerAsset,
  listCanonicalAssetsForProject,
  registerCanonicalAsset,
} from '@/lib/dynaxis/services/assets.js';

const ROUTE_AUTH_OPTS = Object.freeze({ legacyCompatibility: true });

function isLegacyAuthContext(authContext) {
  return authContext?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY;
}

function legacyOwnerRef(authContext) {
  return authContext?.compatibility?.ownerRef ?? authContext?.subject?.legacyOwnerRef ?? null;
}

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId') || undefined;
        const generationId = searchParams.get('generationId') || undefined;
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          const assets = await listAssets(ownerRef, { projectId, generationId, limit });
          return jsonOk({ assets });
        }

        if (!projectId) {
          return jsonError(
            Object.assign(new Error('projectId is required'), {
              status: 400,
              code: 'VALIDATION_ERROR',
            })
          );
        }

        await requireRoutePermission(routeContext, {
          permission: 'project.read',
          projectId,
        });
        const assets = await listCanonicalAssetsForProject({ projectId, generationId, limit });
        return jsonOk({ assets });
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const body = await request.json();

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          const asset = await registerAsset(ownerRef, body);
          return jsonOk({ asset }, 201);
        }

        const projectId = body?.projectId;
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
        const { authContext } = routeContext;
        const asset = await registerCanonicalAsset(
          {
            organizationId: authContext.workspace.organizationId,
            userId: authContext.principal.userId,
            projectId,
          },
          body
        );
        return jsonOk({ asset }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}
