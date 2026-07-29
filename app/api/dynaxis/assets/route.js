import { withAuthContextRoute, requireRoutePermission, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listAssetsForAuthContext,
  registerAssetForAuthContext,
} from '@/lib/dynaxis/services/assets.js';
import { resolveProjectForAuthContext } from '@/lib/dynaxis/services/projects.js';

function isLegacyAuthContext(authContext) {
  return authContext?.subject?.type === 'legacy';
}

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const { authContext } = routeContext;
      try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId') || undefined;
        const generationId = searchParams.get('generationId') || undefined;
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
        if (!isLegacyAuthContext(authContext)) {
          await requireRoutePermission(routeContext, {
            permission: projectId ? 'project.read' : 'workspace.read',
            projectId,
          });
        }
        const assets = await listAssetsForAuthContext(authContext, { projectId, generationId, limit });
        return jsonOk({ assets });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const { authContext } = routeContext;
      try {
        const body = await request.json();
        let projectId = body?.projectId;
        if (!isLegacyAuthContext(authContext)) {
          const project = await resolveProjectForAuthContext(authContext, projectId);
          projectId = project.id;
          await requireRoutePermission(routeContext, {
            permission: 'asset.create',
            projectId,
          });
        }
        const assetInput =
          body && typeof body === 'object' && projectId ? { ...body, projectId } : body;
        const asset = await registerAssetForAuthContext(authContext, assetInput);
        return jsonOk({ asset }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}
