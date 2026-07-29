import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import { AUTH_CONTEXT_SUBJECT_TYPES } from '@/lib/dynaxis/auth/auth-context';
import {
  createProject,
  listProjects,
  ensureDefaultProject,
  createCanonicalProjectForUser,
  listCanonicalProjectsForUser,
  ensureCanonicalDefaultProject,
} from '@/lib/dynaxis/services/projects.js';

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
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const ensureDefault = searchParams.get('ensureDefault') !== 'false';

        if (isLegacyAuthContext(routeContext.authContext)) {
          const ownerRef = legacyOwnerRef(routeContext.authContext);
          if (ensureDefault) {
            await ensureDefaultProject(ownerRef);
          }
          const projects = await listProjects(ownerRef, { includeArchived });
          return jsonOk({ projects });
        }

        await requireRoutePermission(routeContext, { permission: 'workspace.read' });
        const { authContext } = routeContext;
        const organizationId = authContext.workspace.organizationId;
        const userId = authContext.principal.userId;
        if (ensureDefault) {
          await ensureCanonicalDefaultProject({ organizationId, userId });
        }
        const projects = await listCanonicalProjectsForUser({
          organizationId,
          userId,
          includeArchived,
        });
        return jsonOk({ projects });
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
          const project = await createProject(ownerRef, body);
          return jsonOk({ project }, 201);
        }

        await requireRoutePermission(routeContext, { permission: 'project.create' });
        const { authContext } = routeContext;
        const project = await createCanonicalProjectForUser({
          organizationId: authContext.workspace.organizationId,
          userId: authContext.principal.userId,
          input: body,
        });
        return jsonOk({ project }, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    ROUTE_AUTH_OPTS
  );
}
