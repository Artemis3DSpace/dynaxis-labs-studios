import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  linkCharacterToProject,
  unlinkCharacterFromProject,
  listCharacterProjects,
  resolveRouteServiceContext,
  characterOwnershipRepository,
} from '@/lib/dynaxis/services/characters.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const projects = await listCharacterProjects(ctx, id);
        return jsonOk({ projects });
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.read',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        await requireRoutePermission(routeContext, {
          permission: 'character.update',
          projectId: body.projectId,
          resource: {
            type: 'project_character',
            id: `${body.projectId}:${id}`,
            projectId: body.projectId,
          },
          ...LEGACY_ROUTE,
        });
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await linkCharacterToProject(ctx, id, body.projectId);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.update',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return jsonError(
      Object.assign(new Error('projectId query required'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      })
    );
  }
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        await requireRoutePermission(routeContext, {
          permission: 'character.update',
          projectId,
          resource: {
            type: 'project_character',
            id: `${projectId}:${id}`,
            projectId,
          },
          ...LEGACY_ROUTE,
        });
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await unlinkCharacterFromProject(ctx, id, projectId);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'character.update',
      resourceId: id,
      resourceType: 'character',
      resourceRepository: characterOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
