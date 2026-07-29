import {
  withAuthContextRoute,
  requireRoutePermission,
  requireRouteWorkspace,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  createProjectForRoute,
  isLegacyRouteCompatibility,
  listProjectsForRoute,
} from '@/lib/dynaxis/services/projects.js';

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        if (!isLegacyRouteCompatibility(routeContext)) {
          await requireRouteWorkspace(routeContext);
        }
        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const ensureDefault = searchParams.get('ensureDefault') !== 'false';
        const projects = await listProjectsForRoute(routeContext, {
          includeArchived,
          ensureDefault,
        });
        return jsonOk({ projects });
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
        if (!isLegacyRouteCompatibility(routeContext)) {
          await requireRoutePermission(routeContext, { permission: 'project.create' });
        }
        const body = await request.json();
        const project = await createProjectForRoute(routeContext, body);
        return jsonOk({ project }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { legacyCompatibility: true }
  );
}
