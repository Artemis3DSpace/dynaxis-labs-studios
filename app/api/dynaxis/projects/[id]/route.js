import {
  DYNAXIS_ROUTE_AUTH_ERROR_CODES,
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  archiveProjectForRoute,
  getProjectForRoute,
  isLegacyRouteCompatibility,
  updateProjectForRoute,
} from '@/lib/dynaxis/services/projects.js';

function notFound() {
  return Object.assign(new Error('Project not found'), {
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
          await requireRoutePermission(routeContext, {
            permission: 'project.read',
            projectId: id,
          });
        }
        const project = await getProjectForRoute(routeContext, id);
        if (!project) {
          return jsonError(notFound());
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}

export async function PATCH(request, { params }) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const { id } = await params;
        const body = await request.json();
        const archiveOnly = body?.status === 'archived' && Object.keys(body).length === 1;

        if (!isLegacyRouteCompatibility(routeContext)) {
          await requireRoutePermission(routeContext, {
            permission: archiveOnly ? 'project.archive' : 'project.update',
            projectId: id,
          });
        }

        if (archiveOnly) {
          const project = await archiveProjectForRoute(routeContext, id);
          if (!project) {
            return jsonError(notFound());
          }
          return jsonOk({ project });
        }

        const project = await updateProjectForRoute(routeContext, id, body);
        if (!project) {
          return jsonError(notFound());
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
