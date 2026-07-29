import { withAuthContextRoute, requireRoutePermission, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createProjectForAuthContext,
  listProjectsForAuthContext,
} from '@/lib/dynaxis/services/projects.js';

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
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const ensureDefault = searchParams.get('ensureDefault') !== 'false';
        if (!isLegacyAuthContext(authContext)) {
          await requireRoutePermission(routeContext, {
            permission: 'workspace.read',
          });
        }
        const projects = await listProjectsForAuthContext(authContext, {
          includeArchived,
          ensureDefault,
        });
        return jsonOk({ projects });
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
        if (!isLegacyAuthContext(authContext)) {
          await requireRoutePermission(routeContext, {
            permission: 'project.create',
          });
        }
        const body = await request.json();
        const project = await createProjectForAuthContext(authContext, body);
        return jsonOk({ project }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      legacyCompatibility: true,
    }
  );
}
