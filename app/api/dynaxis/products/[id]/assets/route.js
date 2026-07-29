import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  addProductAsset,
  removeProductAsset,
  listProductAssets,
  promoteAssetToProductReference,
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
        const result = await listProductAssets(ctx, id);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'product.read',
      resourceId: id,
      resourceType: 'product',
      resourceRepository: productOwnershipRepository,
      ...LEGACY_ROUTE,
    }
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
        if (body?.promote) {
          const result = await promoteAssetToProductReference(ctx, id, body);
          return jsonOk(result, 201);
        }
        const result = await addProductAsset(ctx, id, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'product.update',
      resourceId: id,
      resourceType: 'product',
      resourceRepository: productOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const assetId = new URL(request.url).searchParams.get('assetId');
  if (!assetId) {
    return jsonError(
      Object.assign(new Error('assetId query required'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      })
    );
  }
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await removeProductAsset(ctx, id, assetId);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'product.update',
      resourceId: id,
      resourceType: 'product',
      resourceRepository: productOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
