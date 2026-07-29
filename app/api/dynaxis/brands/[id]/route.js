import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getBrand,
  updateBrand,
  archiveBrand,
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
        const { searchParams } = new URL(request.url);
        const includeAssets = searchParams.get('includeAssets') !== 'false';
        const result = await getBrand(ctx, id, { includeAssets });
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'brand.read',
      resourceId: id,
      resourceType: 'brand',
      resourceRepository: brandOwnershipRepository,
      ...LEGACY_ROUTE,
    }
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
        const result = await updateBrand(ctx, id, body);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'brand.update',
      resourceId: id,
      resourceType: 'brand',
      resourceRepository: brandOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await archiveBrand(ctx, id);
        return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    {
      permission: 'brand.delete',
      resourceId: id,
      resourceType: 'brand',
      resourceRepository: brandOwnershipRepository,
      ...LEGACY_ROUTE,
    }
  );
}
