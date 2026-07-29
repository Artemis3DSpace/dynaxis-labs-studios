import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listBrandRevisions,
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
        return jsonOk(await listBrandRevisions(ctx, id));
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'brand.read', resourceId: id, resourceType: 'brand', resourceRepository: brandOwnershipRepository, ...LEGACY_ROUTE }
  );
}
