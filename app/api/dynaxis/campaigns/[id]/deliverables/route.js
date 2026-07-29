import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  listCampaignDeliverables,
  createCampaignDeliverables,
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
              const conceptId = searchParams.get('conceptId') || undefined;
              const status = searchParams.get('status') || undefined;
              const limit = Number(searchParams.get('limit') || 100);
              return jsonOk(
                await listCampaignDeliverables(ctx, id, {
                  conceptId,
                  status,
                  limit,
                })
              );
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.read', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
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
              const result = await createCampaignDeliverables(ctx, id, {
                conceptId: body.conceptId,
                formatIds: body.formatIds,
                includeBrandLogo: body.includeBrandLogo,
              });
              return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}
