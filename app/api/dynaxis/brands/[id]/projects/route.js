import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  listBrandProjects,
  linkBrandToProject,
  unlinkBrandFromProject,
  resolveRouteServiceContext,
  brandOwnershipRepository,
} from '@/lib/dynaxis/services/brands.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        return jsonOk(await listBrandProjects(ctx, id));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.read', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        await requireRoutePermission(routeContext, {
          permission: 'brand.update',
          projectId: body.projectId,
          resource: {
            type: 'project_brand',
            id: `${body.projectId}:${id}`,
            projectId: body.projectId,
          },
          ...LEGACY_ROUTE,
        });
        return jsonOk(await linkBrandToProject(ctx, id, body), 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.update', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
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
        await requireRoutePermission(routeContext, {
          permission: 'brand.update',
          projectId,
          resource: {
            type: 'project_brand',
            id: `${projectId}:${id}`,
            projectId,
          },
          ...LEGACY_ROUTE,
        });
        return jsonOk(await unlinkBrandFromProject(ctx, id, projectId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.update', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
  );
}
