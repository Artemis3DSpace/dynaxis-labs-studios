import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  getCampaign,
  updateCampaign,
  archiveCampaign,
  resolveRouteServiceContext,
  campaignOwnershipRepository,
} from '@/lib/dynaxis/services/campaigns.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const { searchParams } = new URL(request.url);
              const includeRelations = searchParams.get('includeRelations') !== 'false';
              const result = await getCampaign(ctx, id, { includeRelations });
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.read', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
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
              const result = await updateCampaign(ctx, id, body);
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await archiveCampaign(ctx, id);
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.delete', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}
