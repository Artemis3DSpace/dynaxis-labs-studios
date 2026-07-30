import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandAssets,
  addBrandAsset,
  removeBrandAsset,
  promoteAssetToBrandReference,
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
        return jsonOk(await listBrandAssets(ctx, id));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.read', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
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
              const result = body?.promote
                ? await promoteAssetToBrandReference(ctx, id, body)
                : await addBrandAsset(ctx, id, body);
              return jsonOk(result, 201);
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
              const assetId = searchParams.get('assetId');
              if (!assetId) {
                const err = new Error('assetId query param required');
                err.status = 400;
                throw err;
              }
              return jsonOk(await removeBrandAsset(ctx, id, assetId));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.update', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
  );
}
