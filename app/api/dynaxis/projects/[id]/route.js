import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '@/lib/dynaxis/auth/auth-context';
import {
  getProject,
  updateProject,
  archiveProject,
  getCanonicalProjectInWorkspace,
  updateCanonicalProjectInWorkspace,
  archiveCanonicalProjectInWorkspace,
} from '@/lib/dynaxis/services/projects.js';

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
          const project = await getProject(ownerRef, id);
          if (!project) {
            return jsonError(
              Object.assign(new Error('Project not found'), {
                status: 404,
                code: 'NOT_FOUND',
              })
            );
          }
          return jsonOk({ project });
        }

        await requireRoutePermission(routeContext, {
          permission: 'project.read',
          projectId: id,
        });
        const project = await getCanonicalProjectInWorkspace({
          organizationId: routeContext.authContext.workspace.organizationId,
          projectId: id,
        });
        if (!project) {
          return jsonError(
            Object.assign(new Error('Project not found'), {
              status: 404,
              code: 'NOT_FOUND',
            })
          );
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
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

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          if (archiveOnly) {
            const project = await archiveProject(ownerRef, id);
            if (!project) {
              return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
            }
            return jsonOk({ project });
          }
          const project = await updateProject(ownerRef, id, body);
          if (!project) {
            return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
          }
          return jsonOk({ project });
        }

        await requireRoutePermission(routeContext, {
          permission: archiveOnly ? 'project.archive' : 'project.update',
          projectId: id,
        });
        const organizationId = routeContext.authContext.workspace.organizationId;
        const project = archiveOnly
          ? await archiveCanonicalProjectInWorkspace({ organizationId, projectId: id })
          : await updateCanonicalProjectInWorkspace({ organizationId, projectId: id, input: body });
        if (!project) {
          return jsonError(Object.assign(new Error('Project not found'), { status: 404 }));
        }
        return jsonOk({ project });
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}
