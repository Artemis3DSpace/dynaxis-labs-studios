import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandProducts,
  linkBrandToProduct,
  unlinkBrandFromProduct,
  resolveRouteServiceContext,
  productOwnershipRepository,
} from '@/lib/dynaxis/services/brands.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        return jsonOk(await listBrandProducts(ctx, id));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.read', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function POST(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
              return jsonOk(await linkBrandToProduct(ctx, id, body), 201);
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
              const productId = searchParams.get('productId');
              if (!productId) {
                const err = new Error('productId query param required');
                err.status = 400;
                throw err;
              }
              return jsonOk(await unlinkBrandFromProduct(ctx, id, productId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.update', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}
