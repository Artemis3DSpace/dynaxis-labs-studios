import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getProduct,
  updateProduct,
  archiveProduct,
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
        const { searchParams } = new URL(request.url);
              const includeAssets = searchParams.get('includeAssets') !== 'false';
              const result = await getProduct(ctx, id, { includeAssets });
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.read', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
              const result = await updateProduct(ctx, id, body);
              return jsonOk(result);
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
        const result = await archiveProduct(ctx, id);
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.update', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}
