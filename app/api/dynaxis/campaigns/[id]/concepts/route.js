import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import { getApiKeyFromRequest } from '@/lib/dynaxis/ownership.js';
import {
  listCampaignConcepts,
  generateCampaignConcepts,
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
        return jsonOk(await listCampaignConcepts(ctx, id));
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
        const apiKey = routeContext.legacyCompatibility?.used
          ? getApiKeyFromRequest(request)
          : undefined;
        // Body empty is ok; apiKey comes from auth context.
              try {
                await request.json();
              } catch {
                // ignore empty / non-JSON body
              }
              const result = await generateCampaignConcepts(ctx, id, { apiKey });
              return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.update', resourceId: id, resourceType: 'campaign', resourceRepository: campaignOwnershipRepository, ...LEGACY_ROUTE }
  );
}
