import { withAuthContextRoute, requireRoutePermission, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  archiveProjectForAuthContext,
  getProjectForAuthContext,
  updateProjectForAuthContext,
} from '@/lib/dynaxis/services/projects.js';

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
          await requireRoutePermission(routeContext, {
            permission: 'project.read',
            projectId: id,
          });
        }
        const project = await getProjectForAuthContext(authContext, id);
        if (!project) {
          return jsonError(
            Object.assign(new Error('Project not found'), { status: 404, code: 'NOT_FOUND' })
          );
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}

export async function PATCH(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      const { authContext } = routeContext;
      try {
        const { id } = await params;
        const body = await request.json();
        const archiveOnly = body?.status === 'archived' && Object.keys(body).length === 1;
        if (!isLegacyAuthContext(authContext)) {
          await requireRoutePermission(routeContext, {
            permission: archiveOnly ? 'project.archive' : 'project.update',
            projectId: id,
          });
        }
        const project = archiveOnly
          ? await archiveProjectForAuthContext(authContext, id)
          : await updateProjectForAuthContext(authContext, id, body);
        if (!project) {
          return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}
