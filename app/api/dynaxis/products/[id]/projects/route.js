import {
  withAuthContextRoute,
  requireRoutePermission,
  jsonOk,
  jsonError,
} from '@/lib/dynaxis/api';
import {
  listProductProjects,
  linkProductToProject,
  unlinkProductFromProject,
  resolveRouteServiceContext,
  productOwnershipRepository,
} from '@/lib/dynaxis/services/products.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await listProductProjects(ctx, id);
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.read', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
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
          permission: 'product.update',
          projectId: body.projectId,
          resource: {
            type: 'project_product',
            id: `${body.projectId}:${id}`,
            projectId: body.projectId,
          },
          ...LEGACY_ROUTE,
        });
        const result = await linkProductToProject(ctx, id, body);
              return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.update', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
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
          permission: 'product.update',
          projectId,
          resource: {
            type: 'project_product',
            id: `${projectId}:${id}`,
            projectId,
          },
          ...LEGACY_ROUTE,
        });
        const result = await unlinkProductFromProject(ctx, id, projectId);
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.update', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}
