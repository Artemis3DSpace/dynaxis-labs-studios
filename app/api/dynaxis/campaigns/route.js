import { withAuthContextRoute, jsonOk, jsonError } from '@/lib/dynaxis/api';
import {
  createCampaign,
  listCampaigns,
  resolveRouteServiceContext,
  campaignOwnershipRepository,
} from '@/lib/dynaxis/services/campaigns.js';

const LEGACY_ROUTE = { legacyCompatibility: true };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const { searchParams } = new URL(request.url);
              const projectId = searchParams.get('projectId') || undefined;
              const includeArchived = searchParams.get('includeArchived') === 'true';
              const limit = Number(searchParams.get('limit') || 100);
              const result = await listCampaigns(ctx, {
                projectId,
                includeArchived,
                limit,
              });
              return jsonOk(result);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.read', ...(projectId ? { projectId } : {}), ...LEGACY_ROUTE }
  );
}

export async function POST(request) {
  const body = await request.json();
  return withAuthContextRoute(
    request,
    async (routeContext) => {
      try {
        const ctx = await resolveRouteServiceContext(routeContext);
        const result = await createCampaign(ctx, body);
        return jsonOk(result, 201);
      } catch (err) {
        return jsonError(err);
      }
    },
    { permission: 'campaign.create', projectId: body.projectId, ...LEGACY_ROUTE }
  );
}
