import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listProductBrands,
  linkBrandToProduct,
  unlinkBrandFromProduct,
} from '@/lib/dynaxis/services/brands.js';
import {
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
        return jsonOk(await listProductBrands(ctx, id));
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
        const { id: productId } = await params;
              const body = await request.json();
              const brandId = body?.brandId;
              if (!brandId) {
                const err = new Error('brandId is required');
                err.status = 400;
                throw err;
              }
              return jsonOk(
                await linkBrandToProduct(ctx, brandId, {
                  productId,
                  isPrimary: body?.isPrimary !== false,
                  metadata: body?.metadata,
                }),
                201
              );
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
        const { id: productId } = await params;
              const { searchParams } = new URL(request.url);
              const brandId = searchParams.get('brandId');
              if (!brandId) {
                const err = new Error('brandId query param required');
                err.status = 400;
                throw err;
              }
              return jsonOk(await unlinkBrandFromProduct(ctx, brandId, productId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.update', resourceId: id, resourceType: 'product', resourceRepository: productOwnershipRepository, ...LEGACY_ROUTE }
  );
}
