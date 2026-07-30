import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createProduct,
  listProducts,
  resolveRouteServiceContext,
  productOwnershipRepository,
} from '@/lib/dynaxis/services/products.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const { searchParams } = new URL(request.url);
              const includeArchived = searchParams.get('includeArchived') === 'true';
              const limit = Number(searchParams.get('limit') || 100);
              const result = await listProducts(ctx, { includeArchived, limit });
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.read', ...LEGACY_ROUTE }
  );
}

export async function POST(request) {
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const body = await request.json();
              const result = await createProduct(ctx, body);
              return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'product.create', ...LEGACY_ROUTE }
  );
}
